namespace SaveBiteBE.Entities;

public class RefundRequest
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid OrderId { get; set; }

    public Guid ShopId { get; set; }

    public Guid UserId { get; set; }

    public Guid RequestId { get; set; }

    public string RequestHash { get; set; } = string.Empty;

    public string OrderNumber { get; set; } = string.Empty;

    public string ShopName { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;

    public decimal RequestedAmount { get; set; }

    public decimal? ApprovedAmount { get; set; }

    public string Status { get; set; } = "PENDING";

    public string ResolutionNote { get; set; } = string.Empty;

    public Guid? HandledByUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime DeadlineAt { get; set; }

    public DateTime? ResolvedAt { get; set; }

    public Order Order { get; set; } = null!;

    public Shop Shop { get; set; } = null!;

    public User User { get; set; } = null!;

    public User? HandledByUser { get; set; }

    public ICollection<RefundEvidence> Evidences { get; set; } =
        new List<RefundEvidence>();
}