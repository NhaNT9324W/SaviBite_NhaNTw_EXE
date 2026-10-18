using Microsoft.EntityFrameworkCore;
using SaveBiteBE.Data;

namespace SaveBiteBE.Features.Offers;

/// <summary>
/// UC06 - Lấy chi tiết ưu đãi được phép công khai.
/// </summary>
public class OfferDetailService(SaviBiteDbContext db)
{
    private static DateTime AsUtc(DateTime value)
    {
        return DateTime.SpecifyKind(
            value,
            DateTimeKind.Utc
        );
    }

    public async Task<OfferDetailDto> GetAsync(
        Guid offerId,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;

        var publicStatuses = new[]
        {
            "ACTIVE",
            "SOLD_OUT",
            "ENDED"
        };

        var offer = await db.Offers
            .AsNoTracking()
            .Include(x => x.Shop)
            .Include(x => x.Product)
                .ThenInclude(x => x!.Category)
            .SingleOrDefaultAsync(
                x =>
                    x.Id == offerId &&
                    x.DeletedAt == null &&
                    publicStatuses.Contains(x.Status) &&
                    x.SaleStartAt <= now &&
                    x.Shop.DeletedAt == null &&
                    x.Shop.Status == "APPROVED" &&
                    (
                        x.ProductId == null
                            ? x.OfferType == "SAVIBITE_BOX"
                            : x.Product != null &&
                              x.Product.DeletedAt == null &&
                              x.Product.Status == "ACTIVE" &&
                              x.Product.ShopId == x.ShopId
                    ),
                cancellationToken
            );

        if (offer == null)
        {
            throw new OfferDetailFailure(
                404,
                "RESOURCE_NOT_FOUND",
                "Ưu đãi không tồn tại hoặc chưa được công khai."
            );
        }

        var hasEnded =
            offer.Status == "ENDED" ||
            offer.SaleEndAt <= now ||
            offer.PickupEndAt <= now;

        var isSoldOut =
            offer.Status == "SOLD_OUT" ||
            offer.AvailableQuantity <= 0;

        var isAvailable =
            offer.Status == "ACTIVE" &&
            !hasEnded &&
            !isSoldOut;

        var availabilityMessage = hasEnded
            ? "Ưu đãi đã kết thúc."
            : isSoldOut
                ? "Ưu đãi đã hết hàng."
                : "Ưu đãi đang mở bán.";

        OfferProductDto? product = null;

        if (offer.Product != null)
        {
            product = new OfferProductDto(
                offer.Product.Id,
                offer.Product.Name,
                offer.Product.Description,
                offer.Product.Ingredients,
                offer.Product.AllergyInfo,
                offer.Product.StorageInstruction,
                offer.Product.ImageUrl,
                offer.Product.OriginalPrice,
                offer.Product.Category.Name
            );
        }

        var allergyInfo =
            !string.IsNullOrWhiteSpace(offer.AllergyInfo)
                ? offer.AllergyInfo
                : offer.Product?.AllergyInfo ?? string.Empty;

        var storageInstruction =
            !string.IsNullOrWhiteSpace(
                offer.StorageInstruction
            )
                ? offer.StorageInstruction
                : offer.Product?.StorageInstruction
                    ?? string.Empty;

        var imageUrl =
            !string.IsNullOrWhiteSpace(offer.ImageUrl)
                ? offer.ImageUrl
                : offer.Product?.ImageUrl;

        return new OfferDetailDto(
            offer.Id,
            offer.OfferType,
            offer.Title,
            offer.Description,
            imageUrl,
            offer.OriginalValue,
            offer.SalePrice,
            offer.AvailableQuantity,
            AsUtc(offer.SaleStartAt),
            AsUtc(offer.SaleEndAt),
            AsUtc(offer.PickupStartAt),
            AsUtc(offer.PickupEndAt),
            allergyInfo,
            storageInstruction,
            isAvailable,
            availabilityMessage,
            new OfferShopDto(
                offer.Shop.Id,
                offer.Shop.Name,
                offer.Shop.Description,
                offer.Shop.Phone,
                offer.Shop.Address,
                offer.Shop.AverageRating
            ),
            product
        );
    }
}