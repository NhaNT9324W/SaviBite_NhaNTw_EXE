namespace SaveBiteBE.Entities;

public class ShopMember
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ShopId { get; set; }

    public Guid UserId { get; set; }

    public string MemberRole { get; set; } = "STAFF";

    public string Status { get; set; } = "ACTIVE";

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    public DateTime? DeletedAt { get; set; }

    public Shop Shop { get; set; } = null!;

    public User User { get; set; } = null!;
}