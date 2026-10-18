namespace SaveBiteBE.Entities;

/// <summary>
/// Ưu đãi Flash Sale hoặc SaviBite Box.
/// </summary>
public class Offer
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ShopId { get; set; }

    // Flash Sale phải có ProductId; Box có thể không có.
    public Guid? ProductId { get; set; }

    public string OfferType { get; set; } = "FLASH_SALE";

    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public decimal OriginalValue { get; set; }

    public decimal SalePrice { get; set; }

    public int InitialQuantity { get; set; }

    public int AvailableQuantity { get; set; }

    public DateTime SaleStartAt { get; set; }

    public DateTime SaleEndAt { get; set; }

    public DateTime PickupStartAt { get; set; }

    public DateTime PickupEndAt { get; set; }

    public string AllergyInfo { get; set; } = string.Empty;

    public string StorageInstruction { get; set; } = string.Empty;

    public string? ImageUrl { get; set; }

    public string Status { get; set; } = "DRAFT";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? DeletedAt { get; set; }

    public Shop Shop { get; set; } = null!;

    public Product? Product { get; set; }
}