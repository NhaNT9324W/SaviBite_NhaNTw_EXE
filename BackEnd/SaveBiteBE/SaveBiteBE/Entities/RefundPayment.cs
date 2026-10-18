namespace SaveBiteBE.Entities;

/// <summary>
/// UC20 - Giao dịch hoàn tiền mô phỏng.
/// Giữ riêng với giao dịch thanh toán gốc.
/// </summary>
public class RefundPayment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid RefundRequestId { get; set; }

    public Guid OrderId { get; set; }

    public Guid PaymentId { get; set; }

    public string Provider { get; set; } = "MOCK";

    public string Status { get; set; } = "SUCCESS";

    public decimal Amount { get; set; }

    public string TransactionReference { get; set; } =
        string.Empty;

    public DateTime CreatedAt { get; set; } =
        DateTime.UtcNow;

    public RefundRequest RefundRequest { get; set; } = null!;

    public Order Order { get; set; } = null!;

    public Payment Payment { get; set; } = null!;
}