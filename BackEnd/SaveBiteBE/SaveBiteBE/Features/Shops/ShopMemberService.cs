using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using SaveBiteBE.Data;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Features.Shops;

public class ShopMemberService(
    SaviBiteDbContext db,
    ShopAccessService shopAccess)
{
    private static ShopMemberDto ToDto(
        ShopMember member,
        Guid currentUserId)
    {
        return new ShopMemberDto(
            member.Id,
            member.ShopId,
            member.UserId,
            member.User.FullName,
            member.User.Email,
            member.User.Phone,
            member.MemberRole,
            member.Status,
            member.User.Status,
            member.User.SystemRole,
            DateTime.SpecifyKind(
                member.JoinedAt,
                DateTimeKind.Utc
            ),
            member.UserId == currentUserId
        );
    }

    private async Task<ShopMember> FindMemberAsync(
        Guid shopId,
        Guid memberId,
        CancellationToken cancellationToken)
    {
        var member = await db.ShopMembers
            .AsNoTracking()
            .Include(x => x.User)
            .SingleOrDefaultAsync(
                x =>
                    x.Id == memberId &&
                    x.ShopId == shopId &&
                    x.DeletedAt == null &&
                    x.User.DeletedAt == null,
                cancellationToken
            );

        return member
            ?? throw new ShopOperationFailure(
                404,
                "MEMBER_NOT_FOUND",
                "Không tìm thấy thành viên trong cửa hàng này."
            );
    }

    private static void EnsureStaff(ShopMember member)
    {
        if (member.MemberRole != "STAFF")
        {
            throw new ShopOperationFailure(
                409,
                "OWNER_PROTECTED",
                "Không được khóa hoặc xóa OWNER " +
                "bằng chức năng quản lý nhân viên."
            );
        }
    }

    public async Task<ShopMemberPageDto> GetListAsync(
        Guid currentUserId,
        Guid shopId,
        int page,
        int limit,
        CancellationToken cancellationToken)
    {
        await shopAccess.RequireOwnerAsync(
            currentUserId,
            shopId,
            cancellationToken
        );

        if (
            page < 1 ||
            page > 100000 ||
            limit < 1 ||
            limit > 50
        )
        {
            throw new ShopOperationFailure(
                400,
                "INVALID_PAGINATION",
                "Trang phải từ 1 đến 100000; " +
                "số thành viên mỗi trang phải từ 1 đến 50."
            );
        }

        var query = db.ShopMembers
            .AsNoTracking()
            .Where(x =>
                x.ShopId == shopId &&
                x.DeletedAt == null &&
                x.User.DeletedAt == null
            );

        var total = await query.CountAsync(
            cancellationToken
        );

        var members = await query
            .Include(x => x.User)
            .OrderBy(x =>
                x.MemberRole == "OWNER" ? 0 : 1
            )
            .ThenBy(x => x.User.FullName)
            .ThenBy(x => x.Id)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync(cancellationToken);

        return new ShopMemberPageDto(
            members.Select(x =>
                ToDto(x, currentUserId)
            ).ToList(),
            total,
            page,
            limit,
            (int)Math.Ceiling(total / (double)limit)
        );
    }

    public async Task<ShopMemberDto> AddAsync(
        Guid currentUserId,
        Guid shopId,
        AddShopMemberRequest request,
        CancellationToken cancellationToken)
    {
        await shopAccess.RequireOwnerAsync(
            currentUserId,
            shopId,
            cancellationToken
        );

        var email = request.Email
            .Trim()
            .ToLowerInvariant();

        // Giữ tracking để User hiện có không bị EF thêm lại.
        var targetUser = await db.Users
            .SingleOrDefaultAsync(
                x =>
                    x.Email == email &&
                    x.DeletedAt == null,
                cancellationToken
            );

        if (targetUser == null)
        {
            throw new ShopOperationFailure(
                404,
                "USER_NOT_FOUND",
                "Email chưa có tài khoản. " +
                "Nhân viên cần đăng ký trước."
            );
        }

        if (targetUser.Status != "ACTIVE")
        {
            throw new ShopOperationFailure(
                400,
                "USER_INACTIVE",
                "Tài khoản này đã bị khóa hoặc ngừng hoạt động."
            );
        }

        var member = await db.ShopMembers
            .SingleOrDefaultAsync(
                x =>
                    x.ShopId == shopId &&
                    x.UserId == targetUser.Id,
                cancellationToken
            );

        if (member != null && member.DeletedAt == null)
        {
            throw new ShopOperationFailure(
                409,
                "MEMBER_ALREADY_EXISTS",
                "Tài khoản đã là thành viên của cửa hàng. " +
                "Nếu đang bị khóa, hãy dùng thao tác mở khóa."
            );
        }

        if (member != null && member.MemberRole == "OWNER")
        {
            throw new ShopOperationFailure(
                409,
                "OWNER_PROTECTED",
                "Không thay đổi vai trò OWNER bằng " +
                "chức năng thêm nhân viên."
            );
        }

        if (member == null)
        {
            member = new ShopMember
            {
                ShopId = shopId,
                UserId = targetUser.Id,
                User = targetUser,
                MemberRole = "STAFF",
                Status = "ACTIVE",
                JoinedAt = DateTime.UtcNow
            };

            db.ShopMembers.Add(member);
        }
        else
        {
            member.User = targetUser;
            member.Status = "ACTIVE";
            member.DeletedAt = null;
            member.JoinedAt = DateTime.UtcNow;
        }

        try
        {
            await db.SaveChangesAsync(
                cancellationToken
            );
        }
        catch (DbUpdateException exception)
            when (
                exception.InnerException is SqlException sql &&
                (sql.Number == 2601 || sql.Number == 2627)
            )
        {
            throw new ShopOperationFailure(
                409,
                "MEMBER_ALREADY_EXISTS",
                "Tài khoản đã được thêm vào cửa hàng. " +
                "Vui lòng làm mới danh sách."
            );
        }

        return ToDto(member, currentUserId);
    }

    public async Task<ShopMemberDto> UpdateStatusAsync(
        Guid currentUserId,
        Guid shopId,
        Guid memberId,
        UpdateShopMemberRequest request,
        CancellationToken cancellationToken)
    {
        await shopAccess.RequireOwnerAsync(
            currentUserId,
            shopId,
            cancellationToken
        );

        var member = await FindMemberAsync(
            shopId,
            memberId,
            cancellationToken
        );

        EnsureStaff(member);

        var affected = await db.ShopMembers
            .Where(x =>
                x.Id == memberId &&
                x.ShopId == shopId &&
                x.MemberRole == "STAFF" &&
                x.DeletedAt == null
            )
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(
                    x => x.Status,
                    request.Status
                ),
                cancellationToken
            );

        if (affected == 0)
        {
            throw new ShopOperationFailure(
                404,
                "MEMBER_NOT_FOUND",
                "Thành viên đã bị xóa hoặc thay đổi. " +
                "Vui lòng làm mới danh sách."
            );
        }

        var updatedMember = await FindMemberAsync(
            shopId,
            memberId,
            cancellationToken
        );

        return ToDto(updatedMember, currentUserId);
    }

    public async Task<DeletedShopMemberDto> DeleteAsync(
        Guid currentUserId,
        Guid shopId,
        Guid memberId,
        CancellationToken cancellationToken)
    {
        await shopAccess.RequireOwnerAsync(
            currentUserId,
            shopId,
            cancellationToken
        );

        var member = await FindMemberAsync(
            shopId,
            memberId,
            cancellationToken
        );

        EnsureStaff(member);

        var now = DateTime.UtcNow;

        var affected = await db.ShopMembers
            .Where(x =>
                x.Id == memberId &&
                x.ShopId == shopId &&
                x.MemberRole == "STAFF" &&
                x.DeletedAt == null
            )
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(
                        x => x.Status,
                        "LOCKED"
                    )
                    .SetProperty(
                        x => x.DeletedAt,
                        (DateTime?)now
                    ),
                cancellationToken
            );

        if (affected == 0)
        {
            throw new ShopOperationFailure(
                404,
                "MEMBER_NOT_FOUND",
                "Thành viên đã bị xóa hoặc thay đổi. " +
                "Vui lòng làm mới danh sách."
            );
        }

        return new DeletedShopMemberDto(
            memberId,
            true
        );
    }
}