using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using SaveBiteBE.Data;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Features.Orders;

public sealed class OrderService
{
    private readonly SaviBiteDbContext _db;

    public OrderService(SaviBiteDbContext db)
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
            throw new OrderOperationFailure(
                401,
                "INVALID_SESSION",
                "Phiên đăng nhập không hợp lệ.");
        }

        if (user.Status != "ACTIVE")
        {
            throw new OrderOperationFailure(
                403,
                "ACCOUNT_INACTIVE",
                "Tài khoản đã bị khóa hoặc ngừng hoạt động.");
        }
    }

    private IQueryable<Offer> EligibleOffers(DateTime now)
    {
        return EligibleOffersWithoutStatus(now)
            .Where(x => x.Status == "ACTIVE");
    }

    private IQueryable<Offer> EligibleOffersWithoutStatus(
        DateTime now)
    {
        return _db.Offers.Where(x =>
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
            ));
    }

    private static string BuildRequestHash(
        CreateOrderRequest request)
    {
        var canonical = JsonSerializer.Serialize(new
        {
            ReceiverName = request.ReceiverName.Trim(),
            ReceiverPhone = request.ReceiverPhone.Trim(),
            Note = (request.Note ?? string.Empty).Trim(),

            Items = request.Items
                .OrderBy(x => x.OfferId)
                .Select(x => new
                {
                    x.OfferId,
                    x.Quantity,

                    Price = x.ExpectedUnitPrice.ToString(
                        "0.00",
                        CultureInfo.InvariantCulture)
                })
                .ToArray()
        });

        var bytes = SHA256.HashData(
            Encoding.UTF8.GetBytes(canonical));

        return Convert.ToHexString(bytes);
    }

    private Task<Order?> FindByRequestAsync(
        Guid userId,
        Guid requestId,
        CancellationToken cancellationToken)
    {
        return _db.Orders
            .AsNoTracking()
            .Include(x => x.Items)
            .SingleOrDefaultAsync(
                x => x.UserId == userId &&
                     x.RequestId == requestId,
                cancellationToken);
    }

    private async Task<OrderDto> ReturnExistingAsync(
        Order order,
        string requestHash,
        CancellationToken cancellationToken)
    {
        if (order.RequestHash != requestHash)
        {
            throw new OrderOperationFailure(
                409,
                "REQUEST_ID_REUSED",
                "Mã yêu cầu đã được dùng cho nội dung đặt hàng khác.");
        }

        await ExpireOneAsync(
            order.Id,
            cancellationToken);

        var current = await _db.Orders
            .AsNoTracking()
            .Include(x => x.Items)
            .SingleAsync(
                x => x.Id == order.Id,
                cancellationToken);

        return MapDto(current);
    }

    public async Task<OrderDto> CreateAsync(
        Guid userId,
        CreateOrderRequest request,
        CancellationToken cancellationToken)
    {
        await RequireActiveUserAsync(
            userId,
            cancellationToken);

        var requestHash = BuildRequestHash(request);

        var existing = await FindByRequestAsync(
            userId,
            request.RequestId,
            cancellationToken);

        if (existing is not null)
        {
            return await ReturnExistingAsync(
                existing,
                requestHash,
                cancellationToken);
        }

        try
        {
            return await CreateCoreAsync(
                userId,
                request,
                requestHash,
                cancellationToken);
        }
        catch (DbUpdateException exception)
            when (
                exception.InnerException is SqlException sql &&
                sql.Number is 2601 or 2627)
        {
            // Transaction trong CreateCoreAsync đã được rollback.
            _db.ChangeTracker.Clear();

            var duplicate = await FindByRequestAsync(
                userId,
                request.RequestId,
                cancellationToken);

            if (duplicate is not null)
            {
                return await ReturnExistingAsync(
                    duplicate,
                    requestHash,
                    cancellationToken);
            }

            throw new OrderOperationFailure(
                409,
                "ORDER_RETRY_REQUIRED",
                "Chưa tạo được đơn. Vui lòng thử lại với cùng mã yêu cầu.");
        }
    }

    private async Task<OrderDto> CreateCoreAsync(
        Guid userId,
        CreateOrderRequest request,
        string requestHash,
        CancellationToken cancellationToken)
    {
        await using var transaction =
            await _db.Database.BeginTransactionAsync(
                cancellationToken);

        var requestedItems = request.Items
            .OrderBy(x => x.OfferId)
            .ToArray();

        var offerIds = requestedItems
            .Select(x => x.OfferId)
            .ToArray();

        var offers = await _db.Offers
            .AsNoTracking()
            .Include(x => x.Shop)
            .Include(x => x.Product)
            .Where(x => offerIds.Contains(x.Id))
            .ToListAsync(cancellationToken);

        if (offers.Count != offerIds.Length)
        {
            throw new OrderOperationFailure(
                404,
                "OFFER_NOT_FOUND",
                "Một hoặc nhiều ưu đãi không tồn tại.");
        }

        var shopIds = offers
            .Select(x => x.ShopId)
            .Distinct()
            .ToArray();

        if (shopIds.Length != 1)
        {
            throw new OrderOperationFailure(
                400,
                "MULTIPLE_SHOPS",
                "Một đơn chỉ được chứa ưu đãi của một cửa hàng.");
        }

        var now = DateTime.UtcNow;

        var eligibleIds = await EligibleOffers(now)
            .Where(x => offerIds.Contains(x.Id))
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        if (eligibleIds.Count != offerIds.Length)
        {
            throw new OrderOperationFailure(
                409,
                "OFFER_UNAVAILABLE",
                "Một hoặc nhiều ưu đãi không còn mở bán.");
        }

        var commonPickupStart =
     offers.Max(x => x.PickupStartAt);

        var commonPickupEnd =
            offers.Min(x => x.PickupEndAt);

        if (commonPickupStart >= commonPickupEnd)
        {
            throw new OrderOperationFailure(
                400,
                "PICKUP_WINDOW_CONFLICT",
                "Các ưu đãi không có khung giờ nhận chung. " +
                "Vui lòng chọn các ưu đãi có thời gian nhận phù hợp.");
        }

        var offerMap = offers.ToDictionary(x => x.Id);

        var shop = offers[0].Shop;

        var expiresAt = now.AddMinutes(10);

        var earliestSaleEnd = offers.Min(x => x.SaleEndAt);

        if (earliestSaleEnd < expiresAt)
        {
            expiresAt = earliestSaleEnd;
        }

        var order = new Order
        {
            Id = Guid.NewGuid(),

            OrderNumber =
                $"SB{now:yyyyMMddHHmmss}" +
                Guid.NewGuid()
                    .ToString("N")[..12]
                    .ToUpperInvariant(),

            UserId = userId,
            ShopId = shopIds[0],

            RequestId = request.RequestId,
            RequestHash = requestHash,

            Status = "PENDING_PAYMENT",
            PaymentStatus = "UNPAID",

            ReceiverName = request.ReceiverName.Trim(),
            ReceiverPhone = request.ReceiverPhone.Trim(),
            Note = (request.Note ?? string.Empty).Trim(),

            ShopName = shop.Name,
            ShopAddress = shop.Address,

            PaymentExpiresAt = expiresAt,

            CreatedAt = now,
            UpdatedAt = now
        };

        foreach (var requested in requestedItems)
        {
            var offer = offerMap[requested.OfferId];

            if (requested.ExpectedUnitPrice != offer.SalePrice)
            {
                throw new OrderOperationFailure(
                    409,
                    "PRICE_CHANGED",
                    $"Giá của '{offer.Title}' đã thay đổi. " +
                    "Vui lòng cập nhật giỏ hàng.");
            }

            if (requested.Quantity > offer.AvailableQuantity)
            {
                throw new OrderOperationFailure(
                    409,
                    "INSUFFICIENT_QUANTITY",
                    $"'{offer.Title}' không đủ số lượng.");
            }

            var quantity = requested.Quantity;

            var updateTime = DateTime.UtcNow;

            // Điều kiện được kiểm tra trực tiếp tại DB.
            // UpdatedAt bảo vệ snapshot nếu ưu đãi vừa được sửa.
            var changed = await EligibleOffers(updateTime)
                .Where(x =>
                    x.Id == offer.Id &&
                    x.UpdatedAt == offer.UpdatedAt &&
                    x.SalePrice == offer.SalePrice &&
                    x.AvailableQuantity >= quantity)
                .ExecuteUpdateAsync(
                    setters => setters
                        .SetProperty(
                            x => x.AvailableQuantity,
                            x => x.AvailableQuantity - quantity)
                        .SetProperty(
                            x => x.Status,
                            x => x.AvailableQuantity == quantity
                                ? "SOLD_OUT"
                                : "ACTIVE")
                        .SetProperty(
                            x => x.UpdatedAt,
                            updateTime),
                    cancellationToken);

            if (changed != 1)
            {
                throw new OrderOperationFailure(
                    409,
                    "OFFER_CHANGED",
                    $"'{offer.Title}' vừa thay đổi hoặc không đủ số lượng. " +
                    "Vui lòng cập nhật giỏ hàng.");
            }

            var lineTotal = offer.SalePrice * quantity;

            order.Items.Add(new OrderItem
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                OfferId = offer.Id,

                OfferType = offer.OfferType,
                OfferTitle = offer.Title,
                ImageUrl = offer.ImageUrl,

                OriginalValue = offer.OriginalValue,
                UnitPrice = offer.SalePrice,
                Quantity = quantity,
                LineTotal = lineTotal,

                PickupStartAt = offer.PickupStartAt,
                PickupEndAt = offer.PickupEndAt,

                AllergyInfo = offer.AllergyInfo,
                StorageInstruction = offer.StorageInstruction
            });

            order.TotalAmount += lineTotal;
        }

        if (order.PaymentExpiresAt <= DateTime.UtcNow)
        {
            throw new OrderOperationFailure(
                409,
                "SALE_ENDED",
                "Ưu đãi đã kết thúc bán. Vui lòng cập nhật giỏ hàng.");
        }

        _db.Orders.Add(order);

        await _db.SaveChangesAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        return MapDto(order);
    }

    public async Task<OrderDto> GetAsync(
        Guid userId,
        Guid orderId,
        CancellationToken cancellationToken)
    {
        await RequireActiveUserAsync(
            userId,
            cancellationToken);

        var exists = await _db.Orders
            .AsNoTracking()
            .AnyAsync(
                x => x.Id == orderId &&
                     x.UserId == userId,
                cancellationToken);

        if (!exists)
        {
            throw new OrderOperationFailure(
                404,
                "ORDER_NOT_FOUND",
                "Không tìm thấy đơn hàng của bạn.");
        }

        await ExpireOneAsync(
            orderId,
            cancellationToken);

        var order = await _db.Orders
            .AsNoTracking()
            .Include(x => x.Items)
            .SingleAsync(
                x => x.Id == orderId &&
                     x.UserId == userId,
                cancellationToken);

        return MapDto(order);
    }

    public async Task ExpireBatchAsync(
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;

        var ids = await _db.Orders
            .AsNoTracking()
            .Where(x =>
                x.Status == "PENDING_PAYMENT" &&
                x.PaymentStatus == "UNPAID" &&
                x.PaymentExpiresAt <= now)
            .OrderBy(x => x.PaymentExpiresAt)
            .Take(100)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        foreach (var id in ids)
        {
            await ExpireOneAsync(
                id,
                cancellationToken);
        }
    }

    private async Task ExpireOneAsync(
        Guid orderId,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;

        var isDue = await _db.Orders
            .AsNoTracking()
            .AnyAsync(
                x => x.Id == orderId &&
                     x.Status == "PENDING_PAYMENT" &&
                     x.PaymentStatus == "UNPAID" &&
                     x.PaymentExpiresAt <= now,
                cancellationToken);

        if (!isDue)
        {
            return;
        }

        await using var transaction =
            await _db.Database.BeginTransactionAsync(
                cancellationToken);

        // Chỉ một request/worker được chuyển trạng thái.
        // Những request khác nhận changed = 0.
        var changed = await _db.Orders
            .Where(x =>
                x.Id == orderId &&
                x.Status == "PENDING_PAYMENT" &&
                x.PaymentStatus == "UNPAID" &&
                x.PaymentExpiresAt <= now)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(x => x.Status, "EXPIRED")
                    .SetProperty(x => x.UpdatedAt, now),
                cancellationToken);

        if (changed == 0)
        {
            await transaction.CommitAsync(
                cancellationToken);

            return;
        }

        var items = await _db.OrderItems
            .AsNoTracking()
            .Where(x => x.OrderId == orderId)
            .OrderBy(x => x.OfferId)
            .ToListAsync(cancellationToken);

        foreach (var item in items)
        {
            var quantity = item.Quantity;

            // Hoàn số lượng đúng một lần, kể cả ưu đãi đã hết giờ.
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

            // Chỉ mở bán lại nếu vẫn đủ điều kiện.
            await EligibleOffersWithoutStatus(now)
                .Where(x =>
                    x.Id == item.OfferId &&
                    x.Status == "SOLD_OUT" &&
                    x.AvailableQuantity > 0)
                .ExecuteUpdateAsync(
                    setters => setters
                        .SetProperty(x => x.Status, "ACTIVE")
                        .SetProperty(x => x.UpdatedAt, now),
                    cancellationToken);

            // Ưu đãi hết thời gian không được mở bán trở lại.
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

        await transaction.CommitAsync(cancellationToken);
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