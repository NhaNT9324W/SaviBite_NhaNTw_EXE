using Microsoft.EntityFrameworkCore;
using SaveBiteBE.Data;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Features.Orders;

public sealed class ShopOrderService
{
    private readonly SaviBiteDbContext _db;

    private static readonly HashSet<string> AllowedStatuses =
        new(StringComparer.Ordinal)
        {
            "PENDING_PAYMENT",
            "PAID",
            "CONFIRMED",
            "READY",
            "READY_FOR_PICKUP",
            "COMPLETED",
            "CANCELLED",
            "EXPIRED"
        };

    public ShopOrderService(SaviBiteDbContext db)
    {
        _db = db;
    }

    private async Task RequireShopAccessAsync(
        Guid userId,
        Guid shopId,
        CancellationToken cancellationToken)
    {
        var user = await _db.Users
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.Id == userId &&
                     x.DeletedAt == null,
                cancellationToken);

        if (user is null)
        {
            throw new ShopOrderOperationFailure(
                401,
                "INVALID_SESSION",
                "Phiên đăng nhập không hợp lệ.");
        }

        if (user.Status != "ACTIVE")
        {
            throw new ShopOrderOperationFailure(
                403,
                "ACCOUNT_INACTIVE",
                "Tài khoản đã bị khóa hoặc ngừng hoạt động.");
        }

        var shopExists = await _db.Shops
            .AsNoTracking()
            .AnyAsync(
                x => x.Id == shopId &&
                     x.DeletedAt == null,
                cancellationToken);

        if (!shopExists)
        {
            throw new ShopOrderOperationFailure(
                404,
                "SHOP_NOT_FOUND",
                "Không tìm thấy cửa hàng.");
        }

        if (user.SystemRole == "ADMIN")
        {
            return;
        }

        var hasAccess = await _db.ShopMembers
            .AsNoTracking()
            .AnyAsync(
                x => x.ShopId == shopId &&
                     x.UserId == userId &&
                     x.DeletedAt == null &&
                     x.Status == "ACTIVE" &&
                     (
                         x.MemberRole == "OWNER" ||
                         x.MemberRole == "STAFF"
                     ),
                cancellationToken);

        if (!hasAccess)
        {
            throw new ShopOrderOperationFailure(
                403,
                "SHOP_FORBIDDEN",
                "Bạn không có quyền xử lý đơn của cửa hàng này.");
        }
    }

    public async Task<ShopOrderPageDto> GetListAsync(
        Guid userId,
        Guid shopId,
        string? status,
        int page,
        int limit,
        CancellationToken cancellationToken)
    {
        await RequireShopAccessAsync(
            userId,
            shopId,
            cancellationToken);

        if (page < 1 || limit < 1 || limit > 50)
        {
            throw new ShopOrderOperationFailure(
                400,
                "INVALID_PAGINATION",
                "Trang phải từ 1; số đơn mỗi trang từ 1 đến 50.");
        }

        var normalizedStatus =
            status?.Trim().ToUpperInvariant();

        if (
            !string.IsNullOrEmpty(normalizedStatus) &&
            !AllowedStatuses.Contains(normalizedStatus))
        {
            throw new ShopOrderOperationFailure(
                400,
                "INVALID_STATUS",
                "Bộ lọc trạng thái đơn hàng không hợp lệ.");
        }

        var query = _db.Orders
            .AsNoTracking()
            .Where(x => x.ShopId == shopId);

        if (!string.IsNullOrEmpty(normalizedStatus))
        {
            query = query.Where(
                x => x.Status == normalizedStatus);
        }

        var total = await query.CountAsync(
            cancellationToken);

        var totalPages = (int)Math.Ceiling(
            total / (double)limit);

        if (totalPages > 0 && page > totalPages)
        {
            page = totalPages;
        }

        if (totalPages == 0)
        {
            page = 1;
        }

        var orders = await query
            .OrderByDescending(x => x.CreatedAt)
            .ThenByDescending(x => x.Id)
            .Skip((page - 1) * limit)
            .Take(limit)
            .Include(x => x.Items)
            .ToListAsync(cancellationToken);

        return new ShopOrderPageDto(
            orders.Select(MapDto).ToArray(),
            total,
            page,
            limit,
            totalPages);
    }

    public async Task<OrderDto> GetAsync(
        Guid userId,
        Guid shopId,
        Guid orderId,
        CancellationToken cancellationToken)
    {
        await RequireShopAccessAsync(
            userId,
            shopId,
            cancellationToken);

        var order = await FindOrderAsync(
            shopId,
            orderId,
            cancellationToken);

        return MapDto(order);
    }

    public async Task<OrderDto> UpdateStatusAsync(
        Guid userId,
        Guid shopId,
        Guid orderId,
        UpdateShopOrderStatusRequest request,
        CancellationToken cancellationToken)
    {
        await RequireShopAccessAsync(
            userId,
            shopId,
            cancellationToken);

        var targetStatus = request.Status;

        var requiredStatus = targetStatus switch
        {
            "CONFIRMED" => "PAID",
            "READY_FOR_PICKUP" => "CONFIRMED",

            _ => throw new ShopOrderOperationFailure(
                400,
                "INVALID_STATUS",
                "Trạng thái cập nhật không hợp lệ.")
        };

        await using var transaction =
            await _db.Database.BeginTransactionAsync(
                cancellationToken);

        var order = await FindOrderAsync(
            shopId,
            orderId,
            cancellationToken);

        if (order.PaymentStatus != "PAID")
        {
            throw new ShopOrderOperationFailure(
                409,
                "ORDER_NOT_PAID",
                "Chỉ được xử lý đơn đã thanh toán.");
        }

        // Retry cùng thao tác không thay đổi đơn lần nữa.
        if (order.Status == targetStatus)
        {
            await transaction.CommitAsync(
                cancellationToken);

            return MapDto(order);
        }

        if (order.Status != requiredStatus)
        {
            throw new ShopOrderOperationFailure(
                409,
                "INVALID_STATUS_TRANSITION",
                targetStatus == "CONFIRMED"
                    ? "Chỉ được xác nhận đơn ở trạng thái đã thanh toán."
                    : "Chỉ được chuyển sẵn sàng nhận hàng sau khi cửa hàng xác nhận.");
        }

        var now = DateTime.UtcNow;

        if (
            order.Items.Count == 0 ||
            order.Items.Any(x => x.PickupEndAt <= now))
        {
            throw new ShopOrderOperationFailure(
                409,
                "PICKUP_WINDOW_ENDED",
                "Đơn đã qua hạn nhận hàng, không thể tiếp tục chuẩn bị.");
        }

        var changed = await _db.Orders
            .Where(x =>
                x.Id == orderId &&
                x.ShopId == shopId &&
                x.Status == requiredStatus &&
                x.PaymentStatus == "PAID" &&
                x.Items.Any() &&
                x.Items.All(item => item.PickupEndAt > now))
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(
                        x => x.Status,
                        targetStatus)
                    .SetProperty(
                        x => x.UpdatedAt,
                        now),
                cancellationToken);

        if (changed != 1)
        {
            throw new ShopOrderOperationFailure(
                409,
                "ORDER_CHANGED",
                "Đơn hàng vừa thay đổi. Vui lòng làm mới danh sách.");
        }

        var updated = await FindOrderAsync(
            shopId,
            orderId,
            cancellationToken);

        await transaction.CommitAsync(
            cancellationToken);

        return MapDto(updated);
    }

    private async Task<Order> FindOrderAsync(
        Guid shopId,
        Guid orderId,
        CancellationToken cancellationToken)
    {
        var order = await _db.Orders
            .AsNoTracking()
            .Include(x => x.Items)
            .SingleOrDefaultAsync(
                x => x.Id == orderId &&
                     x.ShopId == shopId,
                cancellationToken);

        if (order is null)
        {
            throw new ShopOrderOperationFailure(
                404,
                "ORDER_NOT_FOUND",
                "Không tìm thấy đơn hàng của cửa hàng này.");
        }

        return order;
    }

    private static DateTime AsUtc(DateTime value)
    {
        return DateTime.SpecifyKind(
            value,
            DateTimeKind.Utc);
    }

    private static OrderDto MapDto(Order order)
    {
        return new OrderDto(
            order.Id,
            order.OrderNumber,
            order.ShopId,
            order.ShopName,
            order.ShopAddress,
            order.Status,
            order.PaymentStatus,
            order.ReceiverName,
            order.ReceiverPhone,
            order.Note,
            order.TotalAmount,
            AsUtc(order.PaymentExpiresAt),
            AsUtc(order.CreatedAt),

            order.Items
                .OrderBy(x => x.OfferTitle)
                .Select(x => new OrderItemDto(
                    x.Id,
                    x.OfferId,
                    x.OfferType,
                    x.OfferTitle,
                    x.ImageUrl,
                    x.OriginalValue,
                    x.UnitPrice,
                    x.Quantity,
                    x.LineTotal,
                    AsUtc(x.PickupStartAt),
                    AsUtc(x.PickupEndAt),
                    x.AllergyInfo,
                    x.StorageInstruction))
                .ToArray());
    }
}