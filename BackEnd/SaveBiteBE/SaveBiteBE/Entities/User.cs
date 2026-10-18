namespace SaveBiteBE.Entities;

/// <summary>
/// Tài khoản người dùng SaviBite.
/// Mật khẩu chỉ được lưu dưới dạng hash.
/// </summary>
public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Email { get; set; } = string.Empty;

    public string Phone { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    public string? AvatarUrl { get; set; }

    public string SystemRole { get; set; } = "USER";

    public string Status { get; set; } = "ACTIVE";

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public DateTime? DeletedAt { get; set; }
}