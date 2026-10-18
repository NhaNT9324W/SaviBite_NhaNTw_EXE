namespace SaveBiteBE.Entities;

/// <summary>
/// Sản phẩm của một cửa hàng.
/// </summary>
public class Product
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ShopId { get; set; }

    public Guid CategoryId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string Ingredients { get; set; } = string.Empty;

    public string AllergyInfo { get; set; } = string.Empty;

    public string StorageInstruction { get; set; } = string.Empty;

    public string? ImageUrl { get; set; }

    public decimal OriginalPrice { get; set; }

    public string Status { get; set; } = "ACTIVE";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? DeletedAt { get; set; }

    public Shop Shop { get; set; } = null!;

    public Category Category { get; set; } = null!;
}