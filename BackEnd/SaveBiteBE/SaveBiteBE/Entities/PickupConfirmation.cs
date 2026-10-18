namespace SaveBiteBE.Entities;

/// <summary>
/// Mã nhận hàng và bằng chứng xác nhận giao hàng.
/// </summary>
public class PickupConfirmation
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid OrderId { get; set; }

    public Guid ShopId { get; set; }

    public string PickupCode { get; set; } = string.Empty;

    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;

    public DateTime? ConfirmedAt { get; set; }

    public Guid? ConfirmedByUserId { get; set; }

    public Guid? ConfirmationRequestId { get; set; }

    public Order Order { get; set; } = null!;

    public Shop Shop { get; set; } = null!;

    public User? ConfirmedByUser { get; set; }
}