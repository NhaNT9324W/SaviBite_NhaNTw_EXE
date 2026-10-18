using System.ComponentModel.DataAnnotations;

namespace SaveBiteBE.Features.Payments;

public sealed class MockPaymentRequest : IValidatableObject
{
    public Guid RequestId { get; set; }

    [Required]
    [RegularExpression(
        "^(SUCCESS|FAILED)$",
        ErrorMessage =
            "Kết quả mô phỏng phải là SUCCESS hoặc FAILED.")]
    public string Outcome { get; set; } = string.Empty;

    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        if (RequestId == Guid.Empty)
        {
            yield return new ValidationResult(
                "Thiếu mã yêu cầu thanh toán.",
                new[] { nameof(RequestId) });
        }
    }
}

public sealed record MockPaymentDto(
    Guid Id,
    Guid OrderId,
    string OrderNumber,
    string Provider,
    string Status,
    string OrderStatus,
    string PaymentStatus,
    decimal Amount,
    string TransactionReference,
    DateTime CreatedAt);

public sealed class PaymentOperationFailure : Exception
{
    public int Status { get; }

    public string Code { get; }

    public PaymentOperationFailure(
        int status,
        string code,
        string message)
        : base(message)
    {
        Status = status;
        Code = code;
    }
}