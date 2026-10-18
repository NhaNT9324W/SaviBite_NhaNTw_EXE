namespace SaveBiteBE.Entities;

public class RefundEvidence
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid RefundRequestId { get; set; }

    public string StoredFileName { get; set; } = string.Empty;

    public string FileType { get; set; } = string.Empty;

    public long FileSize { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public RefundRequest RefundRequest { get; set; } = null!;
}