using Microsoft.EntityFrameworkCore;
using SaveBiteBE.Data;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Features.Payments;

public sealed class PaymentService
{
    private readonly SaviBiteDbContext _db;

    public PaymentService(SaviBiteDbContext db)
    {
        _db = db;
    }

    private async Task RequireActiveUserAsync(
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
            throw new PaymentOperationFailure(
                401,
                "INVALID_SESSION",
                "Phiên đăng nhập không hợp lệ.");
        }

        if (user.Status != "ACTIVE")
        {
            throw new PaymentOperationFailure(
                403,
                "ACCOUNT_INACTIVE",
                "Tài khoản đã bị khóa hoặc ngừng hoạt động.");
        }
    }

    public async Task<MockPaymentDto> PayAsync(
        Guid userId,
        Guid orderId,
        MockPaymentRequest request,
        CancellationToken cancellationToken)
    {
        await RequireActiveUserAsync(
            userId,
            cancellationToken);

        await using var transaction =
            await _db.Database.BeginTransactionAsync(
                cancellationToken);

        // Khóa dòng đơn đến khi transaction kết thúc.
        // Worker hết hạn cũng phải cập nhật chính dòng này.
        var order = await _db.Orders
            .FromSqlInterpolated(
                $"""
                SELECT *
                FROM [orders] WITH (UPDLOCK, ROWLOCK)
                WHERE [id] = {orderId}
                """)
            .AsNoTracking()
            .SingleOrDefaultAsync(cancellationToken);

        if (order is null || order.UserId != userId)
        {
            throw new PaymentOperationFailure(
                404,
                "ORDER_NOT_FOUND",
                "Không tìm thấy đơn hàng của bạn.");
        }

        var existingPayment = await _db.Payments
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.OrderId == orderId,
                cancellationToken);

        if (existingPayment is not null)
        {
            if (existingPayment.Status != request.Outcome)
            {
                throw new PaymentOperationFailure(
                    409,
                    "PAYMENT_ALREADY_PROCESSED",
                    "Đơn hàng đã có kết quả thanh toán và không thể đổi kết quả.");
            }

            await transaction.CommitAsync(
                cancellationToken);

            return MapDto(existingPayment, order);
        }

        if (
            order.Status != "PENDING_PAYMENT" ||
            order.PaymentStatus != "UNPAID")
        {
            throw new PaymentOperationFailure(
                409,
                "ORDER_NOT_PAYABLE",
                "Đơn hàng không còn ở trạng thái chờ thanh toán.");
        }

        var now = DateTime.UtcNow;

        if (order.PaymentExpiresAt <= now)
        {
            throw new PaymentOperationFailure(
                409,
                "ORDER_EXPIRED",
                "Đơn đã hết thời gian giữ hàng. Vui lòng đặt đơn mới.");
        }

        var succeeded = request.Outcome == "SUCCESS";

        var nextOrderStatus = succeeded
            ? "PAID"
            : "CANCELLED";

        var nextPaymentStatus = succeeded
            ? "PAID"
            : "FAILED";

        var changed = await _db.Orders
            .Where(x =>
                x.Id == orderId &&
                x.UserId == userId &&
                x.Status == "PENDING_PAYMENT" &&
                x.PaymentStatus == "UNPAID" &&
                x.PaymentExpiresAt > now)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(
                        x => x.Status,
                        nextOrderStatus)
                    .SetProperty(
                        x => x.PaymentStatus,
                        nextPaymentStatus)
                    .SetProperty(
                        x => x.UpdatedAt,
                        now),
                cancellationToken);

        if (changed != 1)
        {
            throw new PaymentOperationFailure(
                409,
                "ORDER_CHANGED",
                "Đơn hàng vừa thay đổi. Vui lòng cập nhật trạng thái.");
        }

        if (!succeeded)
        {
            await RestoreStockAsync(
                orderId,
                now,
                cancellationToken);
        }

        var payment = new Payment
        {
            Id = Guid.NewGuid(),

            OrderId = orderId,
            RequestId = request.RequestId,

            Provider = "MOCK",
            Status = request.Outcome,

            // Số tiền lấy từ đơn trong DB.
            Amount = order.TotalAmount,

            TransactionReference =
                "MOCK-" +
                Guid.NewGuid()
                    .ToString("N")
                    .ToUpperInvariant(),

            CreatedAt = now
        };

        _db.Payments.Add(payment);

        await _db.SaveChangesAsync(cancellationToken);

        await transaction.CommitAsync(
            cancellationToken);

        order.Status = nextOrderStatus;
        order.PaymentStatus = nextPaymentStatus;
        order.UpdatedAt = now;

        return MapDto(payment, order);
    }

    private async Task RestoreStockAsync(
        Guid orderId,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var items = await _db.OrderItems
            .AsNoTracking()
            .Where(x => x.OrderId == orderId)
            .OrderBy(x => x.OfferId)
            .ToListAsync(cancellationToken);

        foreach (var item in items)
        {
            var quantity = item.Quantity;

            var restored = await _db.Offers
                .Where(x =>
                    x.Id == item.OfferId &&
                    x.AvailableQuantity <=
                        x.InitialQuantity - quantity)
                .ExecuteUpdateAsync(
                    setters => setters
                        .SetProperty(
                            x => x.AvailableQuantity,
                            x => x.AvailableQuantity + quantity)
                        .SetProperty(
                            x => x.UpdatedAt,
                            now),
                    cancellationToken);

            if (restored != 1)
            {
                throw new InvalidOperationException(
                    $"Không hoàn được tồn kho cho ưu đãi {item.OfferId}.");
            }

            // Có hàng trở lại và vẫn hợp lệ thì mở bán lại.
            await _db.Offers
                .Where(x =>
                    x.Id == item.OfferId &&
                    x.Status == "SOLD_OUT" &&
                    x.AvailableQuantity > 0 &&
                    x.DeletedAt == null &&
                    x.SaleStartAt <= now &&
                    x.SaleEndAt > now &&
                    x.PickupEndAt > now &&
                    x.Shop.DeletedAt == null &&
                    x.Shop.Status == "APPROVED" &&
                    (
                        (
                            x.OfferType == "SAVIBITE_BOX" &&
                            x.ProductId == null
                        ) ||
                        (
                            (
                                x.OfferType == "FLASH_SALE" ||
                                x.OfferType == "SAVIBITE_BOX"
                            ) &&
                            x.Product != null &&
                            x.Product.DeletedAt == null &&
                            x.Product.Status == "ACTIVE" &&
                            x.Product.ShopId == x.ShopId
                        )
                    ))
                .ExecuteUpdateAsync(
                    setters => setters
                        .SetProperty(x => x.Status, "ACTIVE")
                        .SetProperty(x => x.UpdatedAt, now),
                    cancellationToken);

            // Hoàn hàng không mở lại ưu đãi đã hết giờ.
            await _db.Offers
                .Where(x =>
                    x.Id == item.OfferId &&
                    x.Status == "SOLD_OUT" &&
                    (
                        x.SaleEndAt <= now ||
                        x.PickupEndAt <= now
                    ))
                .ExecuteUpdateAsync(
                    setters => setters
                        .SetProperty(x => x.Status, "ENDED")
                        .SetProperty(x => x.UpdatedAt, now),
                    cancellationToken);
        }
    }

    private static MockPaymentDto MapDto(
        Payment payment,
        Order order)
    {
        return new MockPaymentDto(
            payment.Id,
            payment.OrderId,
            order.OrderNumber,
            payment.Provider,
            payment.Status,
            order.Status,
            order.PaymentStatus,
            payment.Amount,
            payment.TransactionReference,
            DateTime.SpecifyKind(
                payment.CreatedAt,
                DateTimeKind.Utc));
    }
}