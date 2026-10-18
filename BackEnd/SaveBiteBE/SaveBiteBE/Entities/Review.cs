namespace SaveBiteBE.Entities;

/// <summary>
/// Đánh giá của khách hàng sau khi hoàn thành đơn.
/// </summary>
public class Review
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid OrderId { get; set; }

    public Guid ShopId { get; set; }

    public Guid UserId { get; set; }

    public int Rating { get; set; }

    public string Comment { get; set; } = string.Empty;

    // Tên người đánh giá tại thời điểm gửi.
    public string ReviewerName { get; set; } = string.Empty;

    public string Status { get; set; } = "ACTIVE";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? DeletedAt { get; set; }

    public Order Order { get; set; } = null!;

    public Shop Shop { get; set; } = null!;

    public User User { get; set; } = null!;
}