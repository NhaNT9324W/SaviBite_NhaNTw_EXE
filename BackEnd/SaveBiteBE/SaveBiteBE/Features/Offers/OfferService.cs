using Microsoft.EntityFrameworkCore;
using SaveBiteBE.Data;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Features.Offers;

/// <summary>
/// UC04, UC05 - Danh sách, tìm kiếm và lọc ưu đãi công khai.
/// </summary>
public class OfferService(SaviBiteDbContext db)
{
    private sealed class LocatedOffer
    {
        public Offer Offer { get; set; } = null!;

        public double? DistanceKm { get; set; }
    }

    public async Task<OfferListResultDto> GetListAsync(
        OfferListRequest request,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;

        // Điều kiện công khai luôn do BE quyết định.
        var query = db.Offers
            .AsNoTracking()
            .Where(x =>
                x.DeletedAt == null &&
                x.Status == "ACTIVE" &&
                x.AvailableQuantity > 0 &&
                x.SaleStartAt <= now &&
                x.SaleEndAt > now &&
                x.PickupEndAt > now &&
                x.Shop.DeletedAt == null &&
                x.Shop.Status == "APPROVED"
            )
            .Where(x =>
                x.ProductId == null
                    ? x.OfferType == "SAVIBITE_BOX"
                    : x.Product != null &&
                      x.Product.DeletedAt == null &&
                      x.Product.Status == "ACTIVE" &&
                      x.Product.ShopId == x.ShopId
            );

        var keyword = request.Q?.Trim();

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            query = query.Where(x =>
                x.Title.Contains(keyword) ||
                x.Description.Contains(keyword) ||
                x.Shop.Name.Contains(keyword) ||
                (
                    x.Product != null &&
                    x.Product.Name.Contains(keyword)
                )
            );
        }

        if (!string.IsNullOrWhiteSpace(request.Type))
        {
            query = query.Where(x =>
                x.OfferType == request.Type
            );
        }

        if (request.CategoryId.HasValue)
        {
            var categoryId = request.CategoryId.Value;

            // Schema hiện tại: danh mục nằm trên Product.
            // Box không liên kết Product sẽ không khớp danh mục.
            query = query.Where(x =>
                x.Product != null &&
                x.Product.CategoryId == categoryId &&
                x.Product.Category.Status == "ACTIVE"
            );
        }

        if (request.ShopId.HasValue)
        {
            var shopId = request.ShopId.Value;

            query = query.Where(x => x.ShopId == shopId);
        }

        if (request.MinPrice.HasValue)
        {
            var minPrice = request.MinPrice.Value;

            query = query.Where(x => x.SalePrice >= minPrice);
        }

        if (request.MaxPrice.HasValue)
        {
            var maxPrice = request.MaxPrice.Value;

            query = query.Where(x => x.SalePrice <= maxPrice);
        }

        if (request.PickupDate.HasValue)
        {
            var date = request.PickupDate.Value;

            var startUtc = new DateTimeOffset(
                date.ToDateTime(TimeOnly.MinValue),
                TimeSpan.FromHours(7)
            ).UtcDateTime;

            var endUtc = startUtc.AddDays(1);

            // Khung nhận hàng có giao với ngày được chọn.
            query = query.Where(x =>
                x.PickupStartAt < endUtc &&
                x.PickupEndAt > startUtc
            );
        }

        IQueryable<LocatedOffer> locatedQuery;

        if (
            request.Latitude.HasValue &&
            request.Longitude.HasValue &&
            request.RadiusKm.HasValue
        )
        {
            const double radians = Math.PI / 180.0;

            var latitude = request.Latitude.Value;
            var longitude = request.Longitude.Value;
            var radiusKm = request.RadiusKm.Value;

            var withCoordinates = query.Where(x =>
                x.Shop.Latitude.HasValue &&
                x.Shop.Longitude.HasValue
            );

            // Haversine, tính trong truy vấn SQL trước phân trang.
            locatedQuery =
                from offer in withCoordinates
                let shopLat =
                    (double)(offer.Shop.Latitude ?? 0m)
                let shopLon =
                    (double)(offer.Shop.Longitude ?? 0m)
                let a =
                    Math.Pow(
                        Math.Sin(
                            (shopLat - latitude) * radians / 2
                        ),
                        2
                    ) +
                    Math.Cos(latitude * radians) *
                    Math.Cos(shopLat * radians) *
                    Math.Pow(
                        Math.Sin(
                            (shopLon - longitude) * radians / 2
                        ),
                        2
                    )
                let clampedA =
                    a < 0 ? 0 : a > 1 ? 1 : a
                select new LocatedOffer
                {
                    Offer = offer,
                    DistanceKm =
                        6371.0 * 2 *
                        Math.Asin(Math.Sqrt(clampedA))
                };

            locatedQuery = locatedQuery.Where(x =>
                x.DistanceKm <= radiusKm
            );
        }
        else
        {
            locatedQuery = query.Select(x => new LocatedOffer
            {
                Offer = x,
                DistanceKm = null
            });
        }

        var totalItems = await locatedQuery.CountAsync(
            cancellationToken
        );

        var descending = request.SortOrder == "desc";

        IOrderedQueryable<LocatedOffer> orderedQuery =
            request.SortBy switch
            {
                "price" => descending
                    ? locatedQuery.OrderByDescending(
                        x => x.Offer.SalePrice
                    )
                    : locatedQuery.OrderBy(
                        x => x.Offer.SalePrice
                    ),

                "createdAt" => descending
                    ? locatedQuery.OrderByDescending(
                        x => x.Offer.CreatedAt
                    )
                    : locatedQuery.OrderBy(
                        x => x.Offer.CreatedAt
                    ),

                "distance" => descending
                    ? locatedQuery.OrderByDescending(
                        x => x.DistanceKm
                    )
                    : locatedQuery.OrderBy(
                        x => x.DistanceKm
                    ),

                _ => descending
                    ? locatedQuery.OrderByDescending(
                        x => x.Offer.SaleEndAt
                    )
                    : locatedQuery.OrderBy(
                        x => x.Offer.SaleEndAt
                    )
            };

        var skip = (request.Page - 1) * request.Limit;

        var items = await orderedQuery
            .ThenBy(x => x.Offer.Id)
            .Skip(skip)
            .Take(request.Limit)
            .Select(x => new OfferListItemDto(
                x.Offer.Id,
                x.Offer.OfferType,
                x.Offer.Title,
                x.Offer.Description,
                x.Offer.OriginalValue,
                x.Offer.SalePrice,
                x.Offer.AvailableQuantity,
                x.Offer.SaleEndAt,
                x.Offer.PickupStartAt,
                x.Offer.PickupEndAt,
                x.Offer.AllergyInfo,
                x.Offer.StorageInstruction,
                x.Offer.ShopId,
                x.Offer.Shop.Name,
                x.Offer.Shop.Address,
                x.DistanceKm
            ))
            .ToListAsync(cancellationToken);

        items = items.Select(x => x with
        {
            SaleEndAt = DateTime.SpecifyKind(
                x.SaleEndAt,
                DateTimeKind.Utc
            ),
            PickupStartAt = DateTime.SpecifyKind(
                x.PickupStartAt,
                DateTimeKind.Utc
            ),
            PickupEndAt = DateTime.SpecifyKind(
                x.PickupEndAt,
                DateTimeKind.Utc
            ),
            DistanceKm = x.DistanceKm.HasValue
                ? Math.Round(x.DistanceKm.Value, 2)
                : null
        }).ToList();

        return new OfferListResultDto(
            items,
            request.Page,
            request.Limit,
            totalItems,
            (int)Math.Ceiling(
                totalItems / (double)request.Limit
            )
        );
    }

    /// <summary>
    /// UC05 - Danh mục và cửa hàng cho giao diện bộ lọc.
    /// </summary>
    public async Task<OfferFilterOptionsDto>
        GetFilterOptionsAsync(
            CancellationToken cancellationToken)
    {
        var categories = await db.Categories
            .AsNoTracking()
            .Where(x => x.Status == "ACTIVE")
            .OrderBy(x => x.Name)
            .ThenBy(x => x.Id)
            .Select(x => new OfferFilterOptionDto(
                x.Id,
                x.Name
            ))
            .ToListAsync(cancellationToken);

        var shops = await db.Shops
            .AsNoTracking()
            .Where(x =>
                x.Status == "APPROVED" &&
                x.DeletedAt == null
            )
            .OrderBy(x => x.Name)
            .ThenBy(x => x.Id)
            .Select(x => new OfferFilterOptionDto(
                x.Id,
                x.Name
            ))
            .ToListAsync(cancellationToken);

        return new OfferFilterOptionsDto(
            categories,
            shops
        );
    }
}