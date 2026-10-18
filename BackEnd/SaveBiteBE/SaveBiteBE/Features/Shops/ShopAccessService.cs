using Microsoft.EntityFrameworkCore;
using SaveBiteBE.Data;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Features.Shops;

public class ShopOperationFailure(
    int status,
    string code,
    string message)
    : Exception(message)
{
    public int Status { get; } = status;

    public string Code { get; } = code;
}

public record ManagedShopDto(
    Guid Id,
    string Name,
    string Address,
    string Status,
    string MemberRole
);

public class ShopAccessService(SaviBiteDbContext db)
{
    private async Task<User> GetActiveUserAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var user = await db.Users
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x =>
                    x.Id == userId &&
                    x.DeletedAt == null,
                cancellationToken
            );

        if (user == null)
        {
            throw new ShopOperationFailure(
                401,
                "INVALID_SESSION",
                "Phiên đăng nhập không hợp lệ."
            );
        }

        if (user.Status != "ACTIVE")
        {
            throw new ShopOperationFailure(
                403,
                "ACCOUNT_INACTIVE",
                "Tài khoản đã bị khóa hoặc ngừng hoạt động."
            );
        }

        return user;
    }

    private async Task RequireRoleAsync(
        Guid userId,
        Guid shopId,
        bool ownerOnly,
        CancellationToken cancellationToken)
    {
        var user = await GetActiveUserAsync(
            userId,
            cancellationToken
        );

        var shopExists = await db.Shops
            .AnyAsync(
                x =>
                    x.Id == shopId &&
                    x.DeletedAt == null,
                cancellationToken
            );

        if (!shopExists)
        {
            throw new ShopOperationFailure(
                404,
                "SHOP_NOT_FOUND",
                "Không tìm thấy cửa hàng."
            );
        }

        if (user.SystemRole == "ADMIN")
        {
            return;
        }

        var hasPermission = await db.ShopMembers
            .AnyAsync(
                x =>
                    x.UserId == userId &&
                    x.ShopId == shopId &&
                    x.Status == "ACTIVE" &&
                    x.DeletedAt == null &&
                    (
                        x.MemberRole == "OWNER" ||
                        (
                            !ownerOnly &&
                            x.MemberRole == "STAFF"
                        )
                    ),
                cancellationToken
            );

        if (!hasPermission)
        {
            throw new ShopOperationFailure(
                403,
                ownerOnly
                    ? "OWNER_REQUIRED"
                    : "SHOP_FORBIDDEN",
                ownerOnly
                    ? "Chỉ chủ cửa hàng hoặc Admin " +
                      "được quản lý thành viên."
                    : "Bạn không có quyền quản lý cửa hàng này."
            );
        }
    }

    public Task RequireAsync(
        Guid userId,
        Guid shopId,
        CancellationToken cancellationToken)
    {
        return RequireRoleAsync(
            userId,
            shopId,
            false,
            cancellationToken
        );
    }

    public Task RequireOwnerAsync(
        Guid userId,
        Guid shopId,
        CancellationToken cancellationToken)
    {
        return RequireRoleAsync(
            userId,
            shopId,
            true,
            cancellationToken
        );
    }

    public async Task<List<ManagedShopDto>>
        GetManagedShopsAsync(
            Guid userId,
            CancellationToken cancellationToken)
    {
        var user = await GetActiveUserAsync(
            userId,
            cancellationToken
        );

        if (user.SystemRole == "ADMIN")
        {
            return await db.Shops
                .AsNoTracking()
                .Where(x => x.DeletedAt == null)
                .OrderBy(x => x.Name)
                .ThenBy(x => x.Id)
                .Select(x => new ManagedShopDto(
                    x.Id,
                    x.Name,
                    x.Address,
                    x.Status,
                    "ADMIN"
                ))
                .ToListAsync(cancellationToken);
        }

        return await db.ShopMembers
            .AsNoTracking()
            .Where(x =>
                x.UserId == userId &&
                x.Status == "ACTIVE" &&
                x.DeletedAt == null &&
                (
                    x.MemberRole == "OWNER" ||
                    x.MemberRole == "STAFF"
                ) &&
                x.Shop.DeletedAt == null
            )
            .OrderBy(x => x.Shop.Name)
            .ThenBy(x => x.ShopId)
            .Select(x => new ManagedShopDto(
                x.ShopId,
                x.Shop.Name,
                x.Shop.Address,
                x.Shop.Status,
                x.MemberRole
            ))
            .ToListAsync(cancellationToken);
    }
}