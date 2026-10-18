using System.ComponentModel.DataAnnotations;

namespace SaveBiteBE.Features.Offers;

public class CreateFlashSaleRequest : IValidatableObject
{
    public Guid ProductId { get; set; }

    [Required(
        ErrorMessage = "Vui lòng nhập tên ưu đãi."
    )]
    [StringLength(
        200,
        ErrorMessage = "Tên ưu đãi tối đa 200 ký tự."
    )]
    public string Title { get; set; } = string.Empty;

    [StringLength(
        2000,
        ErrorMessage = "Mô tả tối đa 2000 ký tự."
    )]
    public string Description { get; set; } = string.Empty;

    public decimal SalePrice { get; set; }

    [Range(
        1,
        100000,
        ErrorMessage = "Số suất phải từ 1 đến 100000."
    )]
    public int Quantity { get; set; }

    public DateTimeOffset SaleStartAt { get; set; }

    public DateTimeOffset SaleEndAt { get; set; }

    public DateTimeOffset PickupStartAt { get; set; }

    public DateTimeOffset PickupEndAt { get; set; }

    [StringLength(
        1000,
        ErrorMessage = "Thông tin dị ứng tối đa 1000 ký tự."
    )]
    public string AllergyInfo { get; set; } = string.Empty;

    [StringLength(
        1000,
        ErrorMessage = "Hướng dẫn bảo quản tối đa 1000 ký tự."
    )]
    public string StorageInstruction { get; set; } =
        string.Empty;

    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        if (ProductId == Guid.Empty)
        {
            yield return new ValidationResult(
                "Vui lòng chọn sản phẩm.",
                [nameof(ProductId)]
            );
        }

        // Kiểm tra decimal trực tiếp, tránh lỗi thiết lập vùng.
        if (
            SalePrice < 0.01m ||
            SalePrice > 999999999.99m
        )
        {
            yield return new ValidationResult(
                "Giá bán phải lớn hơn 0 và " +
                "không quá 999999999.99.",
                [nameof(SalePrice)]
            );
        }

        if (decimal.Round(SalePrice, 2) != SalePrice)
        {
            yield return new ValidationResult(
                "Giá bán chỉ được có tối đa " +
                "2 chữ số thập phân.",
                [nameof(SalePrice)]
            );
        }

        if (
            SaleStartAt == default ||
            SaleEndAt == default ||
            PickupStartAt == default ||
            PickupEndAt == default
        )
        {
            yield return new ValidationResult(
                "Vui lòng nhập đủ thời gian bán và nhận hàng.",
                [
                    nameof(SaleStartAt),
                    nameof(SaleEndAt),
                    nameof(PickupStartAt),
                    nameof(PickupEndAt)
                ]
            );

            yield break;
        }

        if (SaleStartAt >= SaleEndAt)
        {
            yield return new ValidationResult(
                "Bắt đầu bán phải trước kết thúc bán.",
                [nameof(SaleEndAt)]
            );
        }

        if (PickupStartAt >= PickupEndAt)
        {
            yield return new ValidationResult(
                "Bắt đầu nhận hàng phải trước kết thúc nhận hàng.",
                [nameof(PickupEndAt)]
            );
        }

        if (SaleEndAt > PickupStartAt)
        {
            yield return new ValidationResult(
                "Thời gian nhận hàng phải bắt đầu " +
                "từ lúc kết thúc bán trở đi.",
                [nameof(PickupStartAt)]
            );
        }

        if (SaleEndAt <= DateTimeOffset.UtcNow)
        {
            yield return new ValidationResult(
                "Kết thúc bán phải ở tương lai.",
                [nameof(SaleEndAt)]
            );
        }
    }
}

public record FlashSaleProductDto(
    Guid Id,
    string Name,
    string CategoryName,
    decimal OriginalPrice,
    string? ImageUrl,
    string AllergyInfo,
    string StorageInstruction
);

public record ShopOfferItemDto(
    Guid Id,
    Guid ShopId,
    Guid? ProductId,
    string? ProductName,
    string OfferType,
    string Title,
    string Description,
    string? ImageUrl,
    decimal OriginalValue,
    decimal SalePrice,
    int InitialQuantity,
    int AvailableQuantity,
    DateTime SaleStartAt,
    DateTime SaleEndAt,
    DateTime PickupStartAt,
    DateTime PickupEndAt,
    string AllergyInfo,
    string StorageInstruction,
    string Status,
    DateTime CreatedAt
);

public record ShopOfferPageDto(
    List<ShopOfferItemDto> Items,
    int Total,
    int Page,
    int Limit,
    int TotalPages
);