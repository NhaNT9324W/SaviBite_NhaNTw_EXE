using System.ComponentModel.DataAnnotations;

namespace SaveBiteBE.Features.Orders;

public sealed class CreateOrderItemRequest : IValidatableObject
{
    public Guid OfferId { get; set; }

    [Range(
        1,
        100000,
        ErrorMessage = "Số lượng phải từ 1 đến 100000.")]
    public int Quantity { get; set; }

    public decimal ExpectedUnitPrice { get; set; }

    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        if (OfferId == Guid.Empty)
        {
            yield return new ValidationResult(
                "ID ưu đãi không hợp lệ.",
                new[] { nameof(OfferId) });
        }

        if (
            ExpectedUnitPrice < 0.01m ||
            ExpectedUnitPrice > 999999999.99m ||
            decimal.Round(ExpectedUnitPrice, 2) != ExpectedUnitPrice)
        {
            yield return new ValidationResult(
                "Giá dự kiến phải lớn hơn 0 và tối đa 2 chữ số thập phân.",
                new[] { nameof(ExpectedUnitPrice) });
        }
    }
}

public sealed class CreateOrderRequest : IValidatableObject
{
    public Guid RequestId { get; set; }

    [Required(ErrorMessage = "Vui lòng nhập tên người nhận.")]
    [StringLength(
        100,
        ErrorMessage = "Tên người nhận tối đa 100 ký tự.")]
    public string ReceiverName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập số điện thoại.")]
    [RegularExpression(
        @"^\+?[0-9]{9,15}$",
        ErrorMessage = "Số điện thoại phải có từ 9 đến 15 chữ số.")]
    public string ReceiverPhone { get; set; } = string.Empty;

    [StringLength(
        1000,
        ErrorMessage = "Ghi chú tối đa 1000 ký tự.")]
    public string Note { get; set; } = string.Empty;

    [Required]
    [MinLength(1, ErrorMessage = "Giỏ hàng đang trống.")]
    [MaxLength(50, ErrorMessage = "Một đơn tối đa 50 ưu đãi.")]
    public List<CreateOrderItemRequest> Items { get; set; } = [];

    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        if (RequestId == Guid.Empty)
        {
            yield return new ValidationResult(
                "Thiếu mã yêu cầu đặt hàng.",
                new[] { nameof(RequestId) });
        }

        if (Items is null)
        {
            yield break;
        }

        if (Items.Any(x => x is null))
        {
            yield return new ValidationResult(
                "Chi tiết đơn hàng không hợp lệ.",
                new[] { nameof(Items) });

            yield break;
        }

        if (
            Items.Select(x => x.OfferId)
                .Distinct()
                .Count() != Items.Count)
        {
            yield return new ValidationResult(
                "Mỗi ưu đãi chỉ được xuất hiện một lần trong đơn.",
                new[] { nameof(Items) });
        }
    }
}

public sealed record OrderItemDto(
    Guid Id,
    Guid OfferId,
    string OfferType,
    string OfferTitle,
    string? ImageUrl,
    decimal OriginalValue,
    decimal UnitPrice,
    int Quantity,
    decimal LineTotal,
    DateTime PickupStartAt,
    DateTime PickupEndAt,
    string AllergyInfo,
    string StorageInstruction);

public sealed record OrderDto(
    Guid Id,
    string OrderNumber,
    Guid ShopId,
    string ShopName,
    string ShopAddress,
    string Status,
    string PaymentStatus,
    string ReceiverName,
    string ReceiverPhone,
    string Note,
    decimal TotalAmount,
    DateTime PaymentExpiresAt,
    DateTime CreatedAt,
    IReadOnlyList<OrderItemDto> Items);

public sealed class OrderOperationFailure : Exception
{
    public int Status { get; }

    public string Code { get; }

    public OrderOperationFailure(
        int status,
        string code,
        string message)
        : base(message)
    {
        Status = status;
        Code = code;
    }
}