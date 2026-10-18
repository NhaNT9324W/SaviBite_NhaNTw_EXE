using System.ComponentModel.DataAnnotations;

namespace SaveBiteBE.Features.AdminShops;

public sealed class ReviewShopRequest
{
    [MaxLength(1000)]
    public string? Note { get; set; }
}

public sealed record AdminShopDto(
    Guid Id,
    string Name,
    string Description,
    string Phone,
    string Address,
    decimal? Latitude,
    decimal? Longitude,
    string? LogoUrl,
    string? CoverUrl,
    string Status,
    decimal AverageRating,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record AdminShopPageDto(
    IReadOnlyList<AdminShopDto> Items,
    int Total,
    int Page,
    int Limit,
    int TotalPages);

public sealed record ShopReviewHistoryDto(
    Guid Id,
    string Action,
    string ActorName,
    string Note,
    DateTime CreatedAt);

public sealed record AdminShopDetailDto(
    AdminShopDto Shop,
    IReadOnlyList<ShopReviewHistoryDto> History);

public sealed class AdminShopFailure : Exception
{
    public int Status { get; }

    public string Code { get; }

    public AdminShopFailure(
        int status,
        string code,
        string message)
        : base(message)
    {
        Status = status;
        Code = code;
    }
}