namespace SaveBiteBE.Entities;

/// <summary>
/// Giao dịch thanh toán mô phỏng của đơn hàng.
/// </summary>
public class Payment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid OrderId { get; set; }

    public Guid RequestId { get; set; }

    public string Provider { get; set; } = "MOCK";

    public string Status { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public string TransactionReference { get; set; } =
        string.Empty;

    public DateTime CreatedAt { get; set; } =
        DateTime.UtcNow;

    public Order Order { get; set; } = null!;
}