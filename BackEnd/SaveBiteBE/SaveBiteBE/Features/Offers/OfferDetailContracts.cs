namespace SaveBiteBE.Features.Offers;

/// <summary>
/// UC06 - Thông tin cửa hàng trên trang chi tiết.
/// </summary>
public record OfferShopDto(
    Guid Id,
    string Name,
    string Description,
    string Phone,
    string Address,
    decimal AverageRating
);

/// <summary>
/// UC06 - Thông tin sản phẩm liên kết với ưu đãi.
/// Box có thể không liên kết sản phẩm cụ thể.
/// </summary>
public record OfferProductDto(
    Guid Id,
    string Name,
    string Description,
    string Ingredients,
    string AllergyInfo,
    string StorageInstruction,
    string? ImageUrl,
    decimal OriginalPrice,
    string CategoryName
);

/// <summary>
/// UC06 - Chi tiết ưu đãi công khai.
/// </summary>
public record OfferDetailDto(
    Guid Id,
    string OfferType,
    string Title,
    string Description,
    string? ImageUrl,
    decimal OriginalValue,
    decimal SalePrice,
    int AvailableQuantity,
    DateTime SaleStartAt,
    DateTime SaleEndAt,
    DateTime PickupStartAt,
    DateTime PickupEndAt,
    string AllergyInfo,
    string StorageInstruction,
    bool IsAvailable,
    string AvailabilityMessage,
    OfferShopDto Shop,
    OfferProductDto? Product
);

public sealed class OfferDetailFailure(
    int status,
    string code,
    string message) : Exception(message)
{
    public int Status { get; } = status;

    public string Code { get; } = code;
}