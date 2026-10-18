namespace SaveBiteBE.Entities;

/// <summary>
/// Chi tiết đơn hàng, lưu snapshot của ưu đãi.
/// </summary>
public class OrderItem
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid OrderId { get; set; }

    public Guid OfferId { get; set; }

    public string OfferType { get; set; } = string.Empty;

    public string OfferTitle { get; set; } = string.Empty;

    public string? ImageUrl { get; set; }

    public decimal OriginalValue { get; set; }

    public decimal UnitPrice { get; set; }

    public int Quantity { get; set; }

    public decimal LineTotal { get; set; }

    public DateTime PickupStartAt { get; set; }

    public DateTime PickupEndAt { get; set; }

    public string AllergyInfo { get; set; } = string.Empty;

    public string StorageInstruction { get; set; } = string.Empty;

    public Order Order { get; set; } = null!;

    public Offer Offer { get; set; } = null!;
}