using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace SaveBiteBE.Features.Refunds;

public sealed class RefundPolicyOptions
{
    public int WindowHours { get; set; } = 24;
}

public sealed class CreateRefundRequestInput
    : IValidatableObject
{
    public Guid RequestId { get; set; }

    [Required(ErrorMessage = "Vui lòng nhập lý do hoàn tiền.")]
    [StringLength(
        2000,
        MinimumLength = 10,
        ErrorMessage = "Lý do phải từ 10 đến 2000 ký tự.")]
    public string Reason { get; set; } = string.Empty;

    // Chuỗi giúp đọc số theo dấu chấm, không phụ thuộc culture.
    [Required(ErrorMessage = "Vui lòng nhập số tiền yêu cầu.")]
    [RegularExpression(
        @"^\d+(\.\d{1,2})?$",
        ErrorMessage =
            "Số tiền không có dấu phân cách và tối đa 2 chữ số thập phân.")]
    public string RequestedAmount { get; set; } = string.Empty;

    [Required]
    [MinLength(1, ErrorMessage = "Vui lòng gửi ít nhất một ảnh minh chứng.")]
    [MaxLength(3, ErrorMessage = "Tối đa 3 ảnh minh chứng.")]
    public List<IFormFile> Files { get; set; } = [];

    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        if (RequestId == Guid.Empty)
        {
            yield return new ValidationResult(
                "Thiếu mã yêu cầu hoàn tiền.",
                new[] { nameof(RequestId) });
        }
    }
}

public sealed record RefundEvidenceDto(
    Guid Id,
    string FileType,
    long FileSize,
    DateTime CreatedAt);

public sealed record RefundRequestDto(
    Guid Id,
    Guid OrderId,
    string OrderNumber,
    string ShopName,
    string Reason,
    decimal RequestedAmount,
    decimal? ApprovedAmount,
    string Status,
    string ResolutionNote,
    DateTime CreatedAt,
    DateTime DeadlineAt,
    DateTime? ResolvedAt,
    IReadOnlyList<RefundEvidenceDto> Evidences);

public sealed record RefundOrderStateDto(
    Guid Id,
    string OrderNumber,
    string ShopName,
    string OrderStatus,
    decimal TotalAmount,
    DateTime? CompletedAt,
    DateTime? DeadlineAt,
    bool CanRequest,
    string Message,
    RefundRequestDto? LatestRequest);

public sealed record MyRefundOrderPageDto(
    IReadOnlyList<RefundOrderStateDto> Items,
    int Total,
    int Page,
    int Limit,
    int TotalPages);

public sealed record RefundEvidenceImageDto(
    Guid Id,
    string FileType,
    string DataUrl);

public sealed class RefundOperationFailure : Exception
{
    public int Status { get; }

    public string Code { get; }

    public RefundOperationFailure(
        int status,
        string code,
        string message)
        : base(message)
    {
        Status = status;
        Code = code;
    }
}