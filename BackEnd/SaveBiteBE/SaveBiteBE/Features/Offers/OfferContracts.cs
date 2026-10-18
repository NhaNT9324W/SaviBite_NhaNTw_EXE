using System.ComponentModel.DataAnnotations;

namespace SaveBiteBE.Features.Offers;

/// <summary>
/// UC04, UC05 - Phân trang, tìm kiếm và lọc ưu đãi.
/// </summary>
public class OfferListRequest : IValidatableObject
{
    [Range(1, 100000)]
    public int Page { get; set; } = 1;

    [Range(1, 50)]
    public int Limit { get; set; } = 20;

    [MaxLength(200)]
    public string? Q { get; set; }

    [RegularExpression(
        "^(FLASH_SALE|SAVIBITE_BOX)$",
        ErrorMessage = "Loại ưu đãi không hợp lệ."
    )]
    public string? Type { get; set; }

    public Guid? CategoryId { get; set; }

    public Guid? ShopId { get; set; }

    [Range(typeof(decimal), "0", "1000000000000")]
    public decimal? MinPrice { get; set; }

    [Range(typeof(decimal), "0", "1000000000000")]
    public decimal? MaxPrice { get; set; }

    public DateOnly? PickupDate { get; set; }

    [Range(-90, 90)]
    public double? Latitude { get; set; }

    [Range(-180, 180)]
    public double? Longitude { get; set; }

    [Range(0.1, 100)]
    public double? RadiusKm { get; set; }

    [Required]
    [RegularExpression(
        "^(endingSoon|price|createdAt|distance)$",
        ErrorMessage = "Tiêu chí sắp xếp không hợp lệ."
    )]
    public string SortBy { get; set; } = "endingSoon";

    [Required]
    [RegularExpression(
        "^(asc|desc)$",
        ErrorMessage = "Thứ tự sắp xếp không hợp lệ."
    )]
    public string SortOrder { get; set; } = "asc";

    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        if (
            MinPrice.HasValue &&
            MaxPrice.HasValue &&
            MinPrice > MaxPrice
        )
        {
            yield return new ValidationResult(
                "Giá tối thiểu không được lớn hơn giá tối đa.",
                [nameof(MinPrice), nameof(MaxPrice)]
            );
        }

        var hasAnyLocation =
            Latitude.HasValue ||
            Longitude.HasValue ||
            RadiusKm.HasValue;

        var hasFullLocation =
            Latitude.HasValue &&
            Longitude.HasValue &&
            RadiusKm.HasValue;

        if (hasAnyLocation && !hasFullLocation)
        {
            yield return new ValidationResult(
                "Lọc vị trí cần đủ vĩ độ, kinh độ và bán kính.",
                [
                    nameof(Latitude),
                    nameof(Longitude),
                    nameof(RadiusKm)
                ]
            );
        }

        if (SortBy == "distance" && !hasFullLocation)
        {
            yield return new ValidationResult(
                "Sắp xếp khoảng cách cần nhập vị trí và bán kính.",
                [nameof(SortBy)]
            );
        }

        if (
            (Latitude.HasValue &&
             !double.IsFinite(Latitude.Value)) ||
            (Longitude.HasValue &&
             !double.IsFinite(Longitude.Value)) ||
            (RadiusKm.HasValue &&
             !double.IsFinite(RadiusKm.Value))
        )
        {
            yield return new ValidationResult(
                "Vị trí và bán kính phải là số hữu hạn."
            );
        }

        if (PickupDate == DateOnly.MaxValue)
        {
            yield return new ValidationResult(
                "Ngày nhận hàng vượt quá phạm vi hỗ trợ.",
                [nameof(PickupDate)]
            );
        }
    }
}

public record OfferListItemDto(
    Guid Id,
    string OfferType,
    string Title,
    string Description,
    decimal OriginalValue,
    decimal SalePrice,
    int AvailableQuantity,
    DateTime SaleEndAt,
    DateTime PickupStartAt,
    DateTime PickupEndAt,
    string AllergyInfo,
    string StorageInstruction,
    Guid ShopId,
    string ShopName,
    string ShopAddress,
    double? DistanceKm = null
);

public record OfferListResultDto(
    List<OfferListItemDto> Items,
    int Page,
    int Limit,
    int TotalItems,
    int TotalPages
);

public record OfferFilterOptionDto(
    Guid Id,
    string Name
);

public record OfferFilterOptionsDto(
    List<OfferFilterOptionDto> Categories,
    List<OfferFilterOptionDto> Shops
);