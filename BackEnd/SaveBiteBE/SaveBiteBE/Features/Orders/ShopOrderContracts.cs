using System.ComponentModel.DataAnnotations;

namespace SaveBiteBE.Features.Orders;

public sealed class UpdateShopOrderStatusRequest
{
    [Required]
    [RegularExpression(
        "^(CONFIRMED|READY_FOR_PICKUP)$",
        ErrorMessage =
            "Trạng thái cập nhật phải là CONFIRMED hoặc READY_FOR_PICKUP.")]
    public string Status { get; set; } = string.Empty;
}

public sealed record ShopOrderPageDto(
    IReadOnlyList<OrderDto> Items,
    int Total,
    int Page,
    int Limit,
    int TotalPages);

public sealed class ShopOrderOperationFailure : Exception
{
    public int Status { get; }

    public string Code { get; }

    public ShopOrderOperationFailure(
        int status,
        string code,
        string message)
        : base(message)
    {
        Status = status;
        Code = code;
    }
}