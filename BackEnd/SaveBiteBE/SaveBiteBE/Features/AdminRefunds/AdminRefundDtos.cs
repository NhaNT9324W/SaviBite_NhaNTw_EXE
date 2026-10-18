using System.ComponentModel.DataAnnotations;
using SaveBiteBE.Features.Refunds;

namespace SaveBiteBE.Features.AdminRefunds;

public sealed class ReviewRefundInput
{
    // Bắt buộc khi duyệt; bỏ trống khi từ chối.
    public decimal? ApprovedAmount { get; set; }

    [Required]
    [StringLength(2000, MinimumLength = 10)]
    public string Note { get; set; } = string.Empty;
}

public sealed record AdminRefundListItemDto(
    Guid Id,
    Guid OrderId,
    string OrderNumber,
    string ShopName,
    string CustomerName,
    string CustomerEmail,
    string Reason,
    decimal RequestedAmount,
    decimal? ApprovedAmount,
    string Status,
    DateTime CreatedAt,
    DateTime? ResolvedAt);

public sealed record AdminRefundPageDto(
    IReadOnlyList<AdminRefundListItemDto> Items,
    int Total,
    int Page,
    int Limit,
    int TotalPages);

public sealed record OriginalRefundPaymentDto(
    Guid Id,
    string Provider,
    string Status,
    decimal Amount,
    string TransactionReference,
    DateTime CreatedAt);

public sealed record MockRefundPaymentDto(
    Guid Id,
    string Provider,
    string Status,
    decimal Amount,
    string TransactionReference,
    DateTime CreatedAt);

public sealed record RefundReviewHistoryDto(
    Guid Id,
    string Action,
    string ActorName,
    string Note,
    DateTime CreatedAt);

public sealed record AdminRefundDetailDto(
    RefundRequestDto Refund,
    string CustomerName,
    string CustomerEmail,
    string OrderStatus,
    string PaymentStatus,
    decimal OrderTotal,
    OriginalRefundPaymentDto? OriginalPayment,
    MockRefundPaymentDto? RefundPayment,
    IReadOnlyList<RefundReviewHistoryDto> History);

public sealed class AdminRefundFailure : Exception
{
    public int Status { get; }

    public string Code { get; }

    public AdminRefundFailure(
        int status,
        string code,
        string message)
        : base(message)
    {
        Status = status;
        Code = code;
    }
}