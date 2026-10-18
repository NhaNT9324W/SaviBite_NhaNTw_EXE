using Microsoft.EntityFrameworkCore;
using SaveBiteBE.Data;
using SaveBiteBE.Entities;
using SaveBiteBE.Features.Shops;

namespace SaveBiteBE.Features.Offers;

public class SaviBiteBoxService(
    SaviBiteDbContext db,
    ShopAccessService shopAccess)
{
    private static DateTime AsUtc(DateTime value)
    {
        return DateTime.SpecifyKind(
            value,
            DateTimeKind.Utc
        );
    }

    private static ShopOfferItemDto ToDto(Offer offer)
    {
        return new ShopOfferItemDto(
            offer.Id,
            offer.ShopId,
            offer.ProductId,
            offer.Product?.Name,
            offer.OfferType,
            offer.Title,
            offer.Description,
            offer.ImageUrl,
            offer.OriginalValue,
            offer.SalePrice,
            offer.InitialQuantity,
            offer.AvailableQuantity,
            AsUtc(offer.SaleStartAt),
            AsUtc(offer.SaleEndAt),
            AsUtc(offer.PickupStartAt),
            AsUtc(offer.PickupEndAt),
            offer.AllergyInfo,
            offer.StorageInstruction,
            offer.Status,
            AsUtc(offer.CreatedAt)
        );
    }

    public async Task<ShopOfferPageDto> GetListAsync(
        Guid userId,
        Guid shopId,
        int page,
        int limit,
        CancellationToken cancellationToken)
    {
        await shopAccess.RequireAsync(
            userId,
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
                "số Box mỗi trang phải từ 1 đến 50."
            );
        }

        var query = db.Offers
            .AsNoTracking()
            .Where(x =>
                x.ShopId == shopId &&
                x.OfferType == "SAVIBITE_BOX" &&
                x.DeletedAt == null
            );

        var total = await query.CountAsync(
            cancellationToken
        );

        var offers = await query
            .Include(x => x.Product)
            .OrderByDescending(x => x.CreatedAt)
            .ThenBy(x => x.Id)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync(cancellationToken);

        return new ShopOfferPageDto(
            offers.Select(ToDto).ToList(),
            total,
            page,
            limit,
            (int)Math.Ceiling(total / (double)limit)
        );
    }

    public async Task<ShopOfferItemDto> CreateAsync(
        Guid userId,
        Guid shopId,
        CreateSaviBiteBoxRequest request,
        CancellationToken cancellationToken)
    {
        await shopAccess.RequireAsync(
            userId,
            shopId,
            cancellationToken
        );

        var shop = await db.Shops
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x =>
                    x.Id == shopId &&
                    x.DeletedAt == null,
                cancellationToken
            );

        if (shop == null)
        {
            throw new ShopOperationFailure(
                404,
                "SHOP_NOT_FOUND",
                "Không tìm thấy cửa hàng."
            );
        }

        if (shop.Status != "APPROVED")
        {
            throw new ShopOperationFailure(
                403,
                "SHOP_NOT_APPROVED",
                "Chỉ cửa hàng đã được duyệt và " +
                "đang hoạt động mới được đăng Box."
            );
        }

        if (
            request.OriginalValue <= 0 ||
            request.SalePrice <= 0 ||
            request.SalePrice >= request.OriginalValue
        )
        {
            throw new ShopOperationFailure(
                400,
                "INVALID_BOX_PRICE",
                "Giá bán phải lớn hơn 0 và " +
                "nhỏ hơn giá trị ước tính."
            );
        }

        var allergyInfo = request.AllergyInfo.Trim();

        var storageInstruction =
            request.StorageInstruction.Trim();

        if (
            string.IsNullOrWhiteSpace(allergyInfo) ||
            string.IsNullOrWhiteSpace(storageInstruction)
        )
        {
            throw new ShopOperationFailure(
                400,
                "MISSING_FOOD_INFORMATION",
                "Box bắt buộc có thông tin dị ứng " +
                "và hướng dẫn bảo quản."
            );
        }

        var now = DateTime.UtcNow;

        var saleStart = request.SaleStartAt.UtcDateTime;
        var saleEnd = request.SaleEndAt.UtcDateTime;
        var pickupStart = request.PickupStartAt.UtcDateTime;
        var pickupEnd = request.PickupEndAt.UtcDateTime;

        if (saleEnd <= now || pickupEnd <= now)
        {
            throw new ShopOperationFailure(
                400,
                "INVALID_OFFER_TIME",
                "Box đã hết thời gian bán hoặc nhận hàng."
            );
        }

        var imageUrl =
            !string.IsNullOrWhiteSpace(shop.CoverUrl)
                ? shop.CoverUrl
                : shop.LogoUrl;

        var offer = new Offer
        {
            Id = Guid.NewGuid(),
            ShopId = shopId,

            ProductId = null,
            OfferType = "SAVIBITE_BOX",

            Title = request.Title.Trim(),
            Description =
                (request.Description ?? string.Empty).Trim(),

            ImageUrl = imageUrl,

            OriginalValue = request.OriginalValue,
            SalePrice = request.SalePrice,

            InitialQuantity = request.Quantity,
            AvailableQuantity = request.Quantity,

            SaleStartAt = saleStart,
            SaleEndAt = saleEnd,
            PickupStartAt = pickupStart,
            PickupEndAt = pickupEnd,

            AllergyInfo = allergyInfo,
            StorageInstruction = storageInstruction,

            Status = saleStart > now
                ? "SCHEDULED"
                : "ACTIVE",

            CreatedAt = now,
            UpdatedAt = now
        };

        db.Offers.Add(offer);

        await db.SaveChangesAsync(cancellationToken);

        return ToDto(offer);
    }
}