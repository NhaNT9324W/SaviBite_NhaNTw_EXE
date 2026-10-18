using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using SaveBiteBE.Data;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Features.Pickups;

public sealed class PickupService
{
    private readonly SaviBiteDbContext _db;

    private const string CodeAlphabet =
        "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    public PickupService(SaviBiteDbContext db)
    {
        _db = db;
    }

    private async Task<User> GetActiveUserAsync(
        Guid userId,
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
            throw new PickupOperationFailure(
                401,
                "INVALID_SESSION",
                "Phiên đăng nhập không hợp lệ.");
        }

        if (user.Status != "ACTIVE")
        {
            throw new PickupOperationFailure(
                403,
                "ACCOUNT_INACTIVE",
                "Tài khoản đã bị khóa hoặc ngừng hoạt động.");
        }

        return user;
    }

    private async Task RequireShopAccessAsync(
        Guid userId,
        Guid shopId,
        CancellationToken cancellationToken)
    {
        var user = await GetActiveUserAsync(
            userId,
            cancellationToken);

        var shopExists = await _db.Shops
            .AsNoTracking()
            .AnyAsync(
                x => x.Id == shopId &&
                     x.DeletedAt == null,
                cancellationToken);

        if (!shopExists)
        {
            throw new PickupOperationFailure(
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
            throw new PickupOperationFailure(
                403,
                "SHOP_FORBIDDEN",
                "Bạn không có quyền xác nhận nhận hàng tại cửa hàng này.");
        }
    }

    private Task<Order?> GetLockedOrderAsync(
        Guid orderId,
        CancellationToken cancellationToken)
    {
        return _db.Orders
            .FromSqlInterpolated(
                $"""
                SELECT *
                FROM [orders] WITH (UPDLOCK, ROWLOCK)
                WHERE [id] = {orderId}
                """)
            .AsNoTracking()
            .Include(x => x.Items)
            .SingleOrDefaultAsync(cancellationToken);
    }

    private static string GenerateCode()
    {
        var chars = new char[12];

        for (var index = 0; index < chars.Length; index++)
        {
            chars[index] = CodeAlphabet[
                RandomNumberGenerator.GetInt32(
                    CodeAlphabet.Length)];
        }

        return new string(chars);
    }

    private static (
        DateTime Start,
        DateTime End
    ) GetPickupWindow(Order order)
    {
        if (order.Items.Count == 0)
        {
            throw new PickupOperationFailure(
                409,
                "EMPTY_ORDER",
                "Đơn hàng không có chi tiết nhận hàng.");
        }

        // Giao toàn bộ đơn trong thời gian chung của các món.
        var start = order.Items.Max(x => x.PickupStartAt);
        var end = order.Items.Min(x => x.PickupEndAt);

        if (start >= end)
        {
            throw new PickupOperationFailure(
                409,
                "PICKUP_WINDOW_CONFLICT",
                "Các ưu đãi trong đơn không có khung giờ nhận chung.");
        }

        return (start, end);
    }

    private static DateTime AsUtc(DateTime value)
    {
        return DateTime.SpecifyKind(
            value,
            DateTimeKind.Utc);
    }

    public async Task<MyPickupOrderPageDto> GetMyOrdersAsync(
        Guid userId,
        int page,
        int limit,
        CancellationToken cancellationToken)
    {
        await GetActiveUserAsync(
            userId,
            cancellationToken);

        if (page < 1 || limit < 1 || limit > 50)
        {
            throw new PickupOperationFailure(
                400,
                "INVALID_PAGINATION",
                "Trang phải từ 1; số đơn mỗi trang từ 1 đến 50.");
        }

        var query = _db.Orders
            .AsNoTracking()
            .Where(x =>
                x.UserId == userId &&
                x.PaymentStatus == "PAID" &&
                x.Items.Any() &&
                (
                    x.Status == "PAID" ||
                    x.Status == "CONFIRMED" ||
                    x.Status == "READY" ||
                    x.Status == "READY_FOR_PICKUP" ||
                    x.Status == "COMPLETED"
                ));

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

        var items = orders.Select(x =>
            new MyPickupOrderDto(
                x.Id,
                x.OrderNumber,
                x.ShopName,
                x.ShopAddress,
                x.Status,
                x.TotalAmount,
                AsUtc(x.Items.Max(i => i.PickupStartAt)),
                AsUtc(x.Items.Min(i => i.PickupEndAt))))
            .ToArray();

        return new MyPickupOrderPageDto(
            items,
            total,
            page,
            limit,
            totalPages);
    }

    public async Task<PickupCodeDto> IssueCodeAsync(
        Guid userId,
        Guid orderId,
        CancellationToken cancellationToken)
    {
        await GetActiveUserAsync(
            userId,
            cancellationToken);

        await using var transaction =
            await _db.Database.BeginTransactionAsync(
                cancellationToken);

        var order = await GetLockedOrderAsync(
            orderId,
            cancellationToken);

        // Chỉ chủ đơn được xem mã, kể cả người gọi là ADMIN.
        if (order is null || order.UserId != userId)
        {
            throw new PickupOperationFailure(
                404,
                "ORDER_NOT_FOUND",
                "Không tìm thấy đơn hàng của bạn.");
        }

        var window = GetPickupWindow(order);

        var pickup = await _db.PickupConfirmations
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.OrderId == orderId,
                cancellationToken);

        if (pickup is null)
        {
            if (
                order.PaymentStatus != "PAID" ||
                (
                    order.Status != "PAID" &&
                    order.Status != "CONFIRMED" &&
                    order.Status != "READY" &&
                    order.Status != "READY_FOR_PICKUP"
                ))
            {
                throw new PickupOperationFailure(
                    409,
                    "PICKUP_CODE_UNAVAILABLE",
                    "Chỉ đơn đã thanh toán và chưa kết thúc mới được cấp mã nhận hàng.");
            }

            if (window.End <= DateTime.UtcNow)
            {
                throw new PickupOperationFailure(
                    409,
                    "PICKUP_WINDOW_ENDED",
                    "Đơn đã qua hạn nhận hàng.");
            }

            string code;

            do
            {
                code = GenerateCode();
            }
            while (
                await _db.PickupConfirmations
                    .AnyAsync(
                        x => x.PickupCode == code,
                        cancellationToken));

            pickup = new PickupConfirmation
            {
                Id = Guid.NewGuid(),
                OrderId = orderId,
                ShopId = order.ShopId,
                PickupCode = code,
                IssuedAt = DateTime.UtcNow
            };

            _db.PickupConfirmations.Add(pickup);

            await _db.SaveChangesAsync(
                cancellationToken);
        }

        await transaction.CommitAsync(
            cancellationToken);

        return MapCodeDto(order, pickup, window);
    }

    public async Task<PickupReceiptDto> ConfirmAsync(
        Guid userId,
        Guid shopId,
        Guid orderId,
        ConfirmPickupRequest request,
        CancellationToken cancellationToken)
    {
        await RequireShopAccessAsync(
            userId,
            shopId,
            cancellationToken);

        await using var transaction =
            await _db.Database.BeginTransactionAsync(
                cancellationToken);

        var order = await GetLockedOrderAsync(
            orderId,
            cancellationToken);

        if (order is null || order.ShopId != shopId)
        {
            throw new PickupOperationFailure(
                404,
                "ORDER_NOT_FOUND",
                "Không tìm thấy đơn hàng của cửa hàng này.");
        }

        var pickup = await _db.PickupConfirmations
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.OrderId == orderId &&
                     x.ShopId == shopId,
                cancellationToken);

        var normalizedCode =
            request.Code.Trim().ToUpperInvariant();

        if (
            pickup is null ||
            !CryptographicOperations.FixedTimeEquals(
                Encoding.ASCII.GetBytes(pickup.PickupCode),
                Encoding.ASCII.GetBytes(normalizedCode)))
        {
            throw new PickupOperationFailure(
                400,
                "INVALID_PICKUP_CODE",
                "Mã nhận hàng không đúng với đơn này.");
        }

        if (pickup.ConfirmedAt is not null)
        {
            // Retry cùng yêu cầu, cùng nhân viên: trả biên nhận cũ.
            if (
                pickup.ConfirmationRequestId == request.RequestId &&
                pickup.ConfirmedByUserId == userId)
            {
                await transaction.CommitAsync(
                    cancellationToken);

                return MapReceiptDto(order, pickup);
            }

            throw new PickupOperationFailure(
                409,
                "PICKUP_CODE_USED",
                "Mã đã được sử dụng. Đơn đã được giao.");
        }

        if (
            order.PaymentStatus != "PAID" ||
            (
                order.Status != "READY_FOR_PICKUP" &&
                order.Status != "READY"
            ))
        {
            throw new PickupOperationFailure(
                409,
                "ORDER_NOT_READY",
                "Chỉ được giao đơn đã thanh toán và sẵn sàng nhận hàng.");
        }

        var window = GetPickupWindow(order);

        var now = DateTime.UtcNow;

        if (now < window.Start)
        {
            throw new PickupOperationFailure(
                409,
                "PICKUP_TOO_EARLY",
                "Chưa đến giờ nhận hàng.");
        }

        if (now >= window.End)
        {
            throw new PickupOperationFailure(
                409,
                "PICKUP_WINDOW_ENDED",
                "Đã hết thời gian nhận hàng.");
        }

        var changedOrder = await _db.Orders
            .Where(x =>
                x.Id == orderId &&
                x.ShopId == shopId &&
                x.PaymentStatus == "PAID" &&
                (
                    x.Status == "READY_FOR_PICKUP" ||
                    x.Status == "READY"
                ) &&
                x.Items.Any() &&
                x.Items.All(item =>
                    item.PickupStartAt <= now &&
                    item.PickupEndAt > now))
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(x => x.Status, "COMPLETED")
                    .SetProperty(x => x.UpdatedAt, now),
                cancellationToken);

        if (changedOrder != 1)
        {
            throw new PickupOperationFailure(
                409,
                "ORDER_CHANGED",
                "Đơn hàng vừa thay đổi. Vui lòng làm mới.");
        }

        var changedPickup = await _db.PickupConfirmations
            .Where(x =>
                x.Id == pickup.Id &&
                x.OrderId == orderId &&
                x.ShopId == shopId &&
                x.ConfirmedAt == null)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(
                        x => x.ConfirmedAt,
                        (DateTime?)now)
                    .SetProperty(
                        x => x.ConfirmedByUserId,
                        (Guid?)userId)
                    .SetProperty(
                        x => x.ConfirmationRequestId,
                        (Guid?)request.RequestId),
                cancellationToken);

        if (changedPickup != 1)
        {
            throw new PickupOperationFailure(
                409,
                "PICKUP_CODE_USED",
                "Mã nhận hàng vừa được sử dụng.");
        }

        await transaction.CommitAsync(
            cancellationToken);

        order.Status = "COMPLETED";

        pickup.ConfirmedAt = now;
        pickup.ConfirmedByUserId = userId;
        pickup.ConfirmationRequestId = request.RequestId;

        return MapReceiptDto(order, pickup);
    }

    private static PickupCodeDto MapCodeDto(
        Order order,
        PickupConfirmation pickup,
        (DateTime Start, DateTime End) window)
    {
        var now = DateTime.UtcNow;

        var isUsed = pickup.ConfirmedAt is not null;

        var isReady =
            order.PaymentStatus == "PAID" &&
            (
                order.Status == "READY_FOR_PICKUP" ||
                order.Status == "READY"
            );

        var canConfirm =
            !isUsed &&
            isReady &&
            window.Start <= now &&
            now < window.End;

        var message = isUsed
            ? "Mã đã được sử dụng."
            : order.PaymentStatus != "PAID"
                ? "Đơn chưa đủ điều kiện nhận hàng."
                : !isReady
                    ? "Cửa hàng chưa chuẩn bị xong."
                    : now >= window.End
                        ? "Đã hết thời gian nhận hàng."
                        : now < window.Start
                            ? "Chưa đến giờ nhận hàng."
                            : "Có thể nhận hàng tại cửa hàng.";

        return new PickupCodeDto(
            order.Id,
            order.OrderNumber,
            order.ShopName,
            pickup.PickupCode,
            $"SAVIBITE|{order.Id:D}|{pickup.PickupCode}",
            AsUtc(window.Start),
            AsUtc(window.End),
            isUsed,
            canConfirm,
            message,
            pickup.ConfirmedAt is DateTime confirmedAt
                ? AsUtc(confirmedAt)
                : null);
    }

    private static PickupReceiptDto MapReceiptDto(
        Order order,
        PickupConfirmation pickup)
    {
        return new PickupReceiptDto(
            pickup.Id,
            order.Id,
            order.OrderNumber,
            pickup.ShopId,
            order.Status,
            pickup.ConfirmedByUserId!.Value,
            AsUtc(pickup.ConfirmedAt!.Value));
    }
}