using System.ComponentModel.DataAnnotations;

namespace SaveBiteBE.Features.Pickups;

public sealed class ConfirmPickupRequest : IValidatableObject
{
    public Guid RequestId { get; set; }

    [Required(ErrorMessage = "Vui lòng nhập mã nhận hàng.")]
    [RegularExpression(
        "^[A-Za-z2-9]{12}$",
        ErrorMessage = "Mã nhận hàng phải có 12 ký tự.")]
    public string Code { get; set; } = string.Empty;

    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        if (RequestId == Guid.Empty)
        {
            yield return new ValidationResult(
                "Thiếu mã yêu cầu xác nhận.",
                new[] { nameof(RequestId) });
        }
    }
}

public sealed record PickupCodeDto(
    Guid OrderId,
    string OrderNumber,
    string ShopName,
    string Code,
    string QrPayload,
    DateTime PickupStartAt,
    DateTime PickupEndAt,
    bool IsUsed,
    bool CanConfirmNow,
    string AvailabilityMessage,
    DateTime? ConfirmedAt);

public sealed record PickupReceiptDto(
    Guid Id,
    Guid OrderId,
    string OrderNumber,
    Guid ShopId,
    string OrderStatus,
    Guid ConfirmedByUserId,
    DateTime ConfirmedAt);

public sealed record MyPickupOrderDto(
    Guid Id,
    string OrderNumber,
    string ShopName,
    string ShopAddress,
    string Status,
    decimal TotalAmount,
    DateTime PickupStartAt,
    DateTime PickupEndAt);

public sealed record MyPickupOrderPageDto(
    IReadOnlyList<MyPickupOrderDto> Items,
    int Total,
    int Page,
    int Limit,
    int TotalPages);

public sealed class PickupOperationFailure : Exception
{
    public int Status { get; }

    public string Code { get; }

    public PickupOperationFailure(
        int status,
        string code,
        string message)
        : base(message)
    {
        Status = status;
        Code = code;
    }
}