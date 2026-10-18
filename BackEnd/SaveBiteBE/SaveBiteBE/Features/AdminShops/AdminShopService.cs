using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SaveBiteBE.Data;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Features.AdminShops;

/// <summary>
/// UC18 - Admin xem và duyệt đăng ký cửa hàng.
/// </summary>
public sealed class AdminShopService(
    SaviBiteDbContext db)
{
    private static readonly HashSet<string> AllowedStatuses =
        new(StringComparer.Ordinal)
        {
            "PENDING",
            "APPROVED",
            "REJECTED",
            "LOCKED"
        };

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
            throw new AdminShopFailure(
                401,
                "INVALID_SESSION",
                "Phiên đăng nhập không hợp lệ.");
        }

        if (actor.Status != "ACTIVE")
        {
            throw new AdminShopFailure(
                403,
                "ACCOUNT_INACTIVE",
                "Tài khoản đã bị khóa hoặc ngừng hoạt động.");
        }

        // Kiểm tra quyền hiện tại trong Database.
        if (actor.SystemRole != "ADMIN")
        {
            throw new AdminShopFailure(
                403,
                "ADMIN_REQUIRED",
                "Chỉ Admin được phép duyệt cửa hàng.");
        }
    }

    public async Task<AdminShopPageDto> GetPageAsync(
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
            throw new AdminShopFailure(
                400,
                "INVALID_PAGINATION",
                "Trang phải từ 1; số cửa hàng mỗi trang từ 1 đến 50.");
        }

        var normalizedStatus = status?
            .Trim()
            .ToUpperInvariant();

        if (
            !string.IsNullOrEmpty(normalizedStatus) &&
            normalizedStatus != "ALL" &&
            !AllowedStatuses.Contains(normalizedStatus))
        {
            throw new AdminShopFailure(
                400,
                "INVALID_SHOP_STATUS",
                "Trạng thái cửa hàng không hợp lệ.");
        }

        var normalizedKeyword = keyword?.Trim() ?? "";

        if (normalizedKeyword.Length > 150)
        {
            throw new AdminShopFailure(
                400,
                "INVALID_KEYWORD",
                "Từ khóa không được vượt quá 150 ký tự.");
        }

        var query = db.Shops
            .AsNoTracking()
            .Where(shop => shop.DeletedAt == null);

        if (
            !string.IsNullOrEmpty(normalizedStatus) &&
            normalizedStatus != "ALL")
        {
            query = query.Where(shop =>
                shop.Status == normalizedStatus);
        }

        if (normalizedKeyword.Length > 0)
        {
            query = query.Where(shop =>
                shop.Name.Contains(normalizedKeyword) ||
                shop.Address.Contains(normalizedKeyword) ||
                shop.Phone.Contains(normalizedKeyword));
        }

        var total = await query.CountAsync(
            cancellationToken);

        var shops = await query
            .OrderByDescending(shop => shop.CreatedAt)
            .ThenBy(shop => shop.Id)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync(cancellationToken);

        var items = shops
            .Select(ToDto)
            .ToArray();

        var totalPages = total == 0
            ? 0
            : (int)Math.Ceiling(
                total / (double)limit);

        return new AdminShopPageDto(
            items,
            total,
            page,
            limit,
            totalPages);
    }

    public async Task<AdminShopDetailDto> GetDetailAsync(
        Guid actorUserId,
        Guid shopId,
        CancellationToken cancellationToken)
    {
        await EnsureAdminAsync(
            actorUserId,
            cancellationToken);

        var shop = await db.Shops
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item =>
                    item.Id == shopId &&
                    item.DeletedAt == null,
                cancellationToken);

        if (shop is null)
        {
            throw new AdminShopFailure(
                404,
                "SHOP_NOT_FOUND",
                "Không tìm thấy cửa hàng.");
        }

        var history = await GetHistoryAsync(
            shopId,
            cancellationToken);

        return new AdminShopDetailDto(
            ToDto(shop),
            history);
    }

    public Task<AdminShopDetailDto> ApproveAsync(
        Guid actorUserId,
        Guid shopId,
        ReviewShopRequest request,
        CancellationToken cancellationToken)
    {
        return ReviewAsync(
            actorUserId,
            shopId,
            request,
            approve: true,
            cancellationToken: cancellationToken);
    }

    public Task<AdminShopDetailDto> RejectAsync(
        Guid actorUserId,
        Guid shopId,
        ReviewShopRequest request,
        CancellationToken cancellationToken)
    {
        return ReviewAsync(
            actorUserId,
            shopId,
            request,
            approve: false,
            cancellationToken: cancellationToken);
    }

    private async Task<AdminShopDetailDto> ReviewAsync(
        Guid actorUserId,
        Guid shopId,
        ReviewShopRequest request,
        bool approve,
        CancellationToken cancellationToken)
    {
        await EnsureAdminAsync(
            actorUserId,
            cancellationToken);

        var note = request.Note?.Trim() ?? "";

        if (note.Length > 1000)
        {
            throw new AdminShopFailure(
                400,
                "INVALID_REVIEW_NOTE",
                "Ghi chú không được vượt quá 1000 ký tự.");
        }

        if (!approve && note.Length < 10)
        {
            throw new AdminShopFailure(
                400,
                "REJECTION_REASON_REQUIRED",
                "Lý do từ chối cần từ 10 đến 1000 ký tự.");
        }

        await using var transaction =
            await db.Database.BeginTransactionAsync(
                cancellationToken);

        var shop = await db.Shops
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item =>
                    item.Id == shopId &&
                    item.DeletedAt == null,
                cancellationToken);

        if (shop is null)
        {
            throw new AdminShopFailure(
                404,
                "SHOP_NOT_FOUND",
                "Không tìm thấy cửa hàng.");
        }

        if (shop.Status != "PENDING")
        {
            throw new AdminShopFailure(
                409,
                "SHOP_NOT_PENDING",
                "Cửa hàng không còn ở trạng thái chờ duyệt. Vui lòng tải lại.");
        }

        var now = DateTime.UtcNow;

        var nextStatus = approve
            ? "APPROVED"
            : "REJECTED";

        var action = approve
            ? "SHOP_APPROVED"
            : "SHOP_REJECTED";

        // Chỉ cập nhật nếu cửa hàng vẫn đang chờ duyệt
        // và chưa bị thay đổi từ lúc đọc.
        var affected = await db.Shops
            .Where(item =>
                item.Id == shopId &&
                item.DeletedAt == null &&
                item.Status == "PENDING" &&
                item.UpdatedAt == shop.UpdatedAt)
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
            throw new AdminShopFailure(
                409,
                "SHOP_CHANGED",
                "Thông tin hoặc trạng thái cửa hàng đã thay đổi. Vui lòng tải lại.");
        }

        var audit = new AuditLog
        {
            ActorUserId = actorUserId,
            Action = action,
            TargetType = "Shop",
            TargetId = shopId,

            OldValuesJson = JsonSerializer.Serialize(new
            {
                status = shop.Status,
                updatedAt = shop.UpdatedAt
            }),

            NewValuesJson = JsonSerializer.Serialize(new
            {
                status = nextStatus,
                note,
                updatedAt = now
            }),

            CreatedAt = now
        };

        db.AuditLogs.Add(audit);

        await db.SaveChangesAsync(
            cancellationToken);

        // Đọc lịch sử trước khi commit để response sẵn sàng.
        var history = await GetHistoryAsync(
            shopId,
            cancellationToken);

        shop.Status = nextStatus;
        shop.UpdatedAt = now;

        var result = new AdminShopDetailDto(
            ToDto(shop),
            history);

        await transaction.CommitAsync(
            cancellationToken);

        return result;
    }

    private async Task<IReadOnlyList<ShopReviewHistoryDto>>
        GetHistoryAsync(
            Guid shopId,
            CancellationToken cancellationToken)
    {
        var rows = await db.AuditLogs
            .AsNoTracking()
            .Where(log =>
                log.TargetType == "Shop" &&
                log.TargetId == shopId &&
                (
                    log.Action == "SHOP_APPROVED" ||
                    log.Action == "SHOP_REJECTED"
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
            .Select(row => new ShopReviewHistoryDto(
                row.Id,
                row.Action,
                row.ActorName,
                ReadNote(row.NewValuesJson),
                row.CreatedAt))
            .ToArray();
    }

    private static string ReadNote(string json)
    {
        try
        {
            using var document =
                JsonDocument.Parse(json);

            if (
                document.RootElement.ValueKind ==
                    JsonValueKind.Object &&
                document.RootElement.TryGetProperty(
                    "note",
                    out var note) &&
                note.ValueKind == JsonValueKind.String)
            {
                return note.GetString() ?? "";
            }
        }
        catch (JsonException)
        {
            // Nhật ký cũ không đúng định dạng:
            // vẫn hiển thị thao tác và thời gian.
        }

        return "";
    }

    private static AdminShopDto ToDto(Shop shop)
    {
        return new AdminShopDto(
            shop.Id,
            shop.Name,
            shop.Description,
            shop.Phone,
            shop.Address,
            shop.Latitude,
            shop.Longitude,
            shop.LogoUrl,
            shop.CoverUrl,
            shop.Status,
            shop.AverageRating,
            shop.CreatedAt,
            shop.UpdatedAt);
    }
}