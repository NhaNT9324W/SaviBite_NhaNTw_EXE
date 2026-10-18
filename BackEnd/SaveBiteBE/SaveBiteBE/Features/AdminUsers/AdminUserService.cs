using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SaveBiteBE.Data;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Features.AdminUsers;

/// <summary>
/// UC19 - Admin quản lý trạng thái tài khoản.
/// </summary>
public sealed class AdminUserService(
    SaviBiteDbContext db)
{
    private async Task EnsureAdminAsync(
        Guid actorUserId,
        CancellationToken cancellationToken)
    {
        var actor = await db.Users
            .AsNoTracking()
            .Where(user =>
                user.Id == actorUserId &&
                user.DeletedAt == null)
            .Select(user => new
            {
                user.Status,
                user.SystemRole
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (actor is null)
        {
            throw new AdminUserFailure(
                401,
                "INVALID_SESSION",
                "Phiên đăng nhập không hợp lệ.");
        }

        if (actor.Status != "ACTIVE")
        {
            throw new AdminUserFailure(
                403,
                "ACCOUNT_INACTIVE",
                "Tài khoản đã bị khóa hoặc ngừng hoạt động.");
        }

        if (actor.SystemRole != "ADMIN")
        {
            throw new AdminUserFailure(
                403,
                "ADMIN_REQUIRED",
                "Chỉ Admin được phép quản lý tài khoản.");
        }
    }

    public async Task<AdminUserPageDto> GetPageAsync(
        Guid actorUserId,
        string? status,
        string? keyword,
        int page,
        int limit,
        CancellationToken cancellationToken)
    {
        await EnsureAdminAsync(
            actorUserId,
            cancellationToken);

        if (
            page < 1 ||
            limit < 1 ||
            limit > 50 ||
            page > int.MaxValue / limit)
        {
            throw new AdminUserFailure(
                400,
                "INVALID_PAGINATION",
                "Trang phải từ 1; số tài khoản mỗi trang từ 1 đến 50.");
        }

        var normalizedStatus =
            status?.Trim().ToUpperInvariant() ?? "ALL";

        if (normalizedStatus.Length == 0)
        {
            normalizedStatus = "ALL";
        }

        if (
            normalizedStatus != "ALL" &&
            normalizedStatus != "ACTIVE" &&
            normalizedStatus != "LOCKED")
        {
            throw new AdminUserFailure(
                400,
                "INVALID_USER_STATUS",
                "Trạng thái tài khoản không hợp lệ.");
        }

        var normalizedKeyword = keyword?.Trim() ?? "";

        if (normalizedKeyword.Length > 150)
        {
            throw new AdminUserFailure(
                400,
                "INVALID_KEYWORD",
                "Từ khóa không được vượt quá 150 ký tự.");
        }

        var query = db.Users
            .AsNoTracking()
            .Where(user => user.DeletedAt == null);

        if (normalizedStatus != "ALL")
        {
            query = query.Where(user =>
                user.Status == normalizedStatus);
        }

        if (normalizedKeyword.Length > 0)
        {
            query = query.Where(user =>
                user.FullName.Contains(normalizedKeyword) ||
                user.Email.Contains(normalizedKeyword) ||
                user.Phone.Contains(normalizedKeyword));
        }

        var total = await query.CountAsync(
            cancellationToken);

        var users = await query
            .OrderByDescending(user => user.CreatedAt)
            .ThenBy(user => user.Id)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync(cancellationToken);

        var items = users
            .Select(user => ToDto(user, actorUserId))
            .ToArray();

        var totalPages = total == 0
            ? 0
            : (int)Math.Ceiling(
                total / (double)limit);

        return new AdminUserPageDto(
            items,
            total,
            page,
            limit,
            totalPages);
    }

    public async Task<AdminUserDetailDto> GetDetailAsync(
        Guid actorUserId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        await EnsureAdminAsync(
            actorUserId,
            cancellationToken);

        var user = await db.Users
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item =>
                    item.Id == userId &&
                    item.DeletedAt == null,
                cancellationToken);

        if (user is null)
        {
            throw new AdminUserFailure(
                404,
                "USER_NOT_FOUND",
                "Không tìm thấy tài khoản.");
        }

        var history = await GetHistoryAsync(
            userId,
            cancellationToken);

        return new AdminUserDetailDto(
            ToDto(user, actorUserId),
            history);
    }

    public Task<AdminUserDetailDto> LockAsync(
        Guid actorUserId,
        Guid userId,
        ChangeUserStatusRequest request,
        CancellationToken cancellationToken)
    {
        return ChangeStatusAsync(
            actorUserId,
            userId,
            request,
            lockAccount: true,
            cancellationToken: cancellationToken);
    }

    public Task<AdminUserDetailDto> UnlockAsync(
        Guid actorUserId,
        Guid userId,
        ChangeUserStatusRequest request,
        CancellationToken cancellationToken)
    {
        return ChangeStatusAsync(
            actorUserId,
            userId,
            request,
            lockAccount: false,
            cancellationToken: cancellationToken);
    }

    private async Task<AdminUserDetailDto> ChangeStatusAsync(
        Guid actorUserId,
        Guid userId,
        ChangeUserStatusRequest request,
        bool lockAccount,
        CancellationToken cancellationToken)
    {
        await EnsureAdminAsync(
            actorUserId,
            cancellationToken);

        var reason = request.Reason?.Trim() ?? "";

        if (reason.Length < 10 || reason.Length > 1000)
        {
            throw new AdminUserFailure(
                400,
                "INVALID_REASON",
                "Lý do cần từ 10 đến 1000 ký tự.");
        }

        if (actorUserId == userId)
        {
            throw new AdminUserFailure(
                403,
                "SELF_STATUS_CHANGE_FORBIDDEN",
                "Bạn không được thay đổi trạng thái tài khoản đang sử dụng.");
        }

        await using var transaction =
            await db.Database.BeginTransactionAsync(
                cancellationToken);

        var user = await db.Users
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item =>
                    item.Id == userId &&
                    item.DeletedAt == null,
                cancellationToken);

        if (user is null)
        {
            throw new AdminUserFailure(
                404,
                "USER_NOT_FOUND",
                "Không tìm thấy tài khoản.");
        }

        if (user.SystemRole != "USER")
        {
            throw new AdminUserFailure(
                403,
                "PROTECTED_ACCOUNT",
                "Tài khoản quản trị được bảo vệ khỏi thao tác khóa và mở khóa.");
        }

        var expectedStatus = lockAccount
            ? "ACTIVE"
            : "LOCKED";

        var nextStatus = lockAccount
            ? "LOCKED"
            : "ACTIVE";

        if (user.Status != expectedStatus)
        {
            throw new AdminUserFailure(
                409,
                "USER_STATUS_CHANGED",
                lockAccount
                    ? "Tài khoản không ở trạng thái hoạt động. Vui lòng tải lại."
                    : "Tài khoản không ở trạng thái bị khóa. Vui lòng tải lại.");
        }

        var now = DateTime.UtcNow;

        var affected = await db.Users
            .Where(item =>
                item.Id == userId &&
                item.DeletedAt == null &&
                item.SystemRole == "USER" &&
                item.Status == expectedStatus &&
                item.UpdatedAt == user.UpdatedAt)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(
                        item => item.Status,
                        nextStatus)
                    .SetProperty(
                        item => item.UpdatedAt,
                        now),
                cancellationToken);

        if (affected != 1)
        {
            throw new AdminUserFailure(
                409,
                "USER_CHANGED",
                "Thông tin hoặc trạng thái tài khoản đã thay đổi. Vui lòng tải lại.");
        }

        // Thu hồi refresh token khi khóa.
        // Mở khóa không khôi phục refresh token đã thu hồi.
        var revokedTokenCount = 0;

        if (lockAccount)
        {
            revokedTokenCount = await db.RefreshTokens
                .Where(token =>
                    token.UserId == userId &&
                    token.RevokedAt == null)
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(
                        token => token.RevokedAt,
                        (DateTime?)now),
                    cancellationToken);
        }

        db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = actorUserId,

            Action = lockAccount
                ? "USER_LOCKED"
                : "USER_UNLOCKED",

            TargetType = "User",
            TargetId = userId,

            OldValuesJson = JsonSerializer.Serialize(new
            {
                status = user.Status,
                updatedAt = user.UpdatedAt
            }),

            NewValuesJson = JsonSerializer.Serialize(new
            {
                status = nextStatus,
                reason,
                revokedTokenCount,
                updatedAt = now
            }),

            CreatedAt = now
        });

        await db.SaveChangesAsync(
            cancellationToken);

        var history = await GetHistoryAsync(
            userId,
            cancellationToken);

        user.Status = nextStatus;
        user.UpdatedAt = now;

        var result = new AdminUserDetailDto(
            ToDto(user, actorUserId),
            history);

        await transaction.CommitAsync(
            cancellationToken);

        return result;
    }

    private async Task<IReadOnlyList<UserStatusHistoryDto>>
        GetHistoryAsync(
            Guid userId,
            CancellationToken cancellationToken)
    {
        var rows = await db.AuditLogs
            .AsNoTracking()
            .Where(log =>
                log.TargetType == "User" &&
                log.TargetId == userId &&
                (
                    log.Action == "USER_LOCKED" ||
                    log.Action == "USER_UNLOCKED"
                ))
            .OrderByDescending(log => log.CreatedAt)
            .ThenByDescending(log => log.Id)
            .Take(50)
            .Select(log => new
            {
                log.Id,
                log.Action,
                ActorName = log.ActorUser.FullName,
                log.NewValuesJson,
                log.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return rows
            .Select(row => new UserStatusHistoryDto(
                row.Id,
                row.Action,
                row.ActorName,
                ReadReason(row.NewValuesJson),
                row.CreatedAt))
            .ToArray();
    }

    private static string ReadReason(string json)
    {
        try
        {
            using var document = JsonDocument.Parse(json);

            if (
                document.RootElement.ValueKind ==
                    JsonValueKind.Object &&
                document.RootElement.TryGetProperty(
                    "reason",
                    out var reason) &&
                reason.ValueKind == JsonValueKind.String)
            {
                return reason.GetString() ?? "";
            }
        }
        catch (JsonException)
        {
            // Vẫn hiển thị lịch sử nếu JSON cũ không hợp lệ.
        }

        return "";
    }

    private static AdminUserDto ToDto(
        User user,
        Guid actorUserId)
    {
        var isCurrentUser = user.Id == actorUserId;

        var canManage =
            !isCurrentUser &&
            user.SystemRole == "USER";

        return new AdminUserDto(
            user.Id,
            user.FullName,
            user.Email,
            user.Phone,
            user.AvatarUrl,
            user.SystemRole,
            user.Status,
            user.CreatedAt,
            user.UpdatedAt,
            isCurrentUser,
            canManage && user.Status == "ACTIVE",
            canManage && user.Status == "LOCKED");
    }
}