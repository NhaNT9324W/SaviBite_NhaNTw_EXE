namespace SaveBiteBE.Entities;

/// <summary>
/// Đơn hàng của một khách hàng tại một cửa hàng.
/// </summary>
public class Order
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string OrderNumber { get; set; } = string.Empty;

    public Guid UserId { get; set; }

    public Guid ShopId { get; set; }

    // FE gửi lại cùng RequestId khi retry cùng một yêu cầu.
    public Guid RequestId { get; set; }

    public string RequestHash { get; set; } = string.Empty;

    public string Status { get; set; } = "PENDING_PAYMENT";

    public string PaymentStatus { get; set; } = "UNPAID";

    public string ReceiverName { get; set; } = string.Empty;

    public string ReceiverPhone { get; set; } = string.Empty;

    public string Note { get; set; } = string.Empty;

    // Snapshot cửa hàng.
    public string ShopName { get; set; } = string.Empty;

    public string ShopAddress { get; set; } = string.Empty;

    public decimal TotalAmount { get; set; }

    public DateTime PaymentExpiresAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;

    public Shop Shop { get; set; } = null!;

    public ICollection<OrderItem> Items { get; set; } =
        new List<OrderItem>();
}