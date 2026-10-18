using System.ComponentModel.DataAnnotations;

namespace SaveBiteBE.Features.Reviews;

public sealed class CreateReviewRequest
{
    [Range(
        1,
        5,
        ErrorMessage = "Điểm đánh giá phải từ 1 đến 5 sao.")]
    public int Rating { get; set; }

    [StringLength(
        1000,
        ErrorMessage = "Nội dung đánh giá tối đa 1000 ký tự.")]
    public string Comment { get; set; } = string.Empty;
}

public sealed record ReviewDto(
    Guid Id,
    Guid OrderId,
    Guid ShopId,
    int Rating,
    string Comment,
    string ReviewerName,
    DateTime CreatedAt);

public sealed record OrderReviewStateDto(
    Guid OrderId,
    string OrderNumber,
    string ShopName,
    string OrderStatus,
    bool CanReview,
    string Message,
    ReviewDto? Review);

public sealed record MyReviewOrderDto(
    Guid Id,
    string OrderNumber,
    string ShopName,
    string Status,
    decimal TotalAmount,
    DateTime CreatedAt,
    bool HasReview);

public sealed record MyReviewOrderPageDto(
    IReadOnlyList<MyReviewOrderDto> Items,
    int Total,
    int Page,
    int Limit,
    int TotalPages);

public sealed record PublicShopReviewDto(
    Guid Id,
    string ReviewerName,
    int Rating,
    string Comment,
    DateTime CreatedAt);

public sealed record ShopReviewPageDto(
    IReadOnlyList<PublicShopReviewDto> Items,
    decimal AverageRating,
    int Total,
    int Page,
    int Limit,
    int TotalPages);

public sealed class ReviewOperationFailure : Exception
{
    public int Status { get; }

    public string Code { get; }

    public ReviewOperationFailure(
        int status,
        string code,
        string message)
        : base(message)
    {
        Status = status;
        Code = code;
    }
}