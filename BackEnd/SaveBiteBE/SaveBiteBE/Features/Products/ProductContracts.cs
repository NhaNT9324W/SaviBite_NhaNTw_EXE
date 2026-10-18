using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace SaveBiteBE.Features.Products;

public record ProductDto(
    Guid Id,
    Guid ShopId,
    Guid CategoryId,
    string CategoryName,
    string Name,
    string Description,
    string Ingredients,
    string AllergyInfo,
    string StorageInstruction,
    string? ImageUrl,
    decimal OriginalPrice,
    string Status,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record ProductPageDto(
    List<ProductDto> Items,
    int Total,
    int Page,
    int Limit,
    int TotalPages
);

public record ProductCategoryDto(
    Guid Id,
    string Name
);

public record DeletedProductDto(
    Guid Id,
    bool Deleted
);

public class SaveProductRequest : IValidatableObject
{
    public Guid CategoryId { get; set; }

    [Required(
        ErrorMessage = "Vui lòng nhập tên sản phẩm."
    )]
    [StringLength(
        150,
        ErrorMessage = "Tên sản phẩm tối đa 150 ký tự."
    )]
    public string Name { get; set; } = string.Empty;

    [StringLength(
        2000,
        ErrorMessage = "Mô tả tối đa 2000 ký tự."
    )]
    public string Description { get; set; } = string.Empty;

    [StringLength(
        2000,
        ErrorMessage = "Thành phần tối đa 2000 ký tự."
    )]
    public string Ingredients { get; set; } = string.Empty;

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

    // Kiểm tra trực tiếp trong Validate để tránh
    // lỗi chuyển đổi chuỗi số theo thiết lập vùng.
    public decimal OriginalPrice { get; set; }

    [Required(
        ErrorMessage = "Vui lòng chọn trạng thái."
    )]
    [RegularExpression(
        "^(ACTIVE|INACTIVE)$",
        ErrorMessage =
            "Trạng thái phải là ACTIVE hoặc INACTIVE."
    )]
    public string Status { get; set; } = "ACTIVE";

    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        if (CategoryId == Guid.Empty)
        {
            yield return new ValidationResult(
                "Vui lòng chọn danh mục.",
                [nameof(CategoryId)]
            );
        }

        if (
            OriginalPrice < 0.01m ||
            OriginalPrice > 999999999.99m
        )
        {
            yield return new ValidationResult(
                "Giá gốc phải lớn hơn 0 và " +
                "không quá 999999999.99.",
                [nameof(OriginalPrice)]
            );
        }

        if (
            decimal.Round(OriginalPrice, 2) !=
            OriginalPrice
        )
        {
            yield return new ValidationResult(
                "Giá gốc chỉ được có tối đa " +
                "2 chữ số thập phân.",
                [nameof(OriginalPrice)]
            );
        }
    }
}

public class UploadProductImageRequest
{
    [Required(
        ErrorMessage = "Vui lòng chọn ảnh sản phẩm."
    )]
    public IFormFile? File { get; set; }
}