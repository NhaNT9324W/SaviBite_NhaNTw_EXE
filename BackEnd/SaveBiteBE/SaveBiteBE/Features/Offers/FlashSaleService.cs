using Microsoft.EntityFrameworkCore;
using SaveBiteBE.Data;
using SaveBiteBE.Entities;
using SaveBiteBE.Features.Shops;

namespace SaveBiteBE.Features.Offers;

public class FlashSaleService(
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
            offer.ImageUrl ?? offer.Product?.ImageUrl,
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

    public async Task<List<FlashSaleProductDto>>
        GetProductsAsync(
            Guid userId,
            Guid shopId,
            CancellationToken cancellationToken)
    {
        await shopAccess.RequireAsync(
            userId,
            shopId,
            cancellationToken
        );

        return await db.Products
            .AsNoTracking()
            .Where(x =>
                x.ShopId == shopId &&
                x.Status == "ACTIVE" &&
                x.DeletedAt == null
            )
            .OrderBy(x => x.Name)
            .ThenBy(x => x.Id)
            .Select(x => new FlashSaleProductDto(
                x.Id,
                x.Name,
                x.Category.Name,
                x.OriginalPrice,
                x.ImageUrl,
                x.AllergyInfo,
                x.StorageInstruction
            ))
            .ToListAsync(cancellationToken);
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
                "số ưu đãi mỗi trang phải từ 1 đến 50."
            );
        }

        var query = db.Offers
            .AsNoTracking()
            .Where(x =>
                x.ShopId == shopId &&
                x.OfferType == "FLASH_SALE" &&
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
        CreateFlashSaleRequest request,
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
                "đang hoạt động mới được đăng ưu đãi."
            );
        }

        var product = await db.Products
            .SingleOrDefaultAsync(
                x =>
                    x.Id == request.ProductId &&
                    x.ShopId == shopId &&
                    x.Status == "ACTIVE" &&
                    x.DeletedAt == null,
                cancellationToken
            );

        if (product == null)
        {
            throw new ShopOperationFailure(
                400,
                "INVALID_PRODUCT",
                "Sản phẩm không tồn tại, đã ngừng " +
                "hoạt động hoặc không thuộc cửa hàng này."
            );
        }

        if (
            request.SalePrice <= 0 ||
            request.SalePrice >= product.OriginalPrice
        )
        {
            throw new ShopOperationFailure(
                400,
                "INVALID_SALE_PRICE",
                "Giá bán phải lớn hơn 0 và nhỏ hơn " +
                "giá gốc hiện tại của sản phẩm."
            );
        }

        var now = DateTime.UtcNow;

        var saleStart = request.SaleStartAt.UtcDateTime;
        var saleEnd = request.SaleEndAt.UtcDateTime;
        var pickupStart = request.PickupStartAt.UtcDateTime;
        var pickupEnd = request.PickupEndAt.UtcDateTime;

        // Kiểm tra lại sau khi đọc dữ liệu database.
        if (saleEnd <= now || pickupEnd <= now)
        {
            throw new ShopOperationFailure(
                400,
                "INVALID_OFFER_TIME",
                "Ưu đãi đã hết thời gian bán hoặc nhận hàng."
            );
        }

        var allergyInfo =
            (request.AllergyInfo ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(allergyInfo))
        {
            allergyInfo = product.AllergyInfo.Trim();
        }

        var storageInstruction =
            (request.StorageInstruction ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(storageInstruction))
        {
            storageInstruction =
                product.StorageInstruction.Trim();
        }

        if (
            string.IsNullOrWhiteSpace(allergyInfo) ||
            string.IsNullOrWhiteSpace(storageInstruction)
        )
        {
            throw new ShopOperationFailure(
                400,
                "MISSING_FOOD_INFORMATION",
                "Vui lòng bổ sung thông tin dị ứng và " +
                "hướng dẫn bảo quản cho ưu đãi hoặc sản phẩm."
            );
        }

        var offer = new Offer
        {
            Id = Guid.NewGuid(),
            ShopId = shopId,

            ProductId = product.Id,
            Product = product,

            OfferType = "FLASH_SALE",

            Title = request.Title.Trim(),
            Description =
                (request.Description ?? string.Empty).Trim(),

            ImageUrl = product.ImageUrl,

            // Giá gốc lấy từ database và lưu tại lúc tạo.
            OriginalValue = product.OriginalPrice,
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