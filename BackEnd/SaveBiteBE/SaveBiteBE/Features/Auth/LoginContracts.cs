using System.ComponentModel.DataAnnotations;

namespace SaveBiteBE.Features.Auth;

/// <summary>
/// UC02 - Dữ liệu nhận từ form đăng nhập.
/// </summary>
public class LoginRequest
{
    [Required]
    [EmailAddress]
    [MaxLength(254)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Password { get; set; } = string.Empty;
}

/// <summary>
/// Dữ liệu dùng để cấp lại hoặc thu hồi phiên.
/// </summary>
public class RefreshRequest
{
    [Required]
    [StringLength(64, MinimumLength = 64)]
    public string RefreshToken { get; set; } = string.Empty;
}

/// <summary>
/// Dữ liệu đăng nhập bằng Google OAuth.
/// </summary>
public class GoogleLoginRequest
{
    [Required]
    public string IdToken { get; set; } = string.Empty;

    public string? Email { get; set; }

    public string? FullName { get; set; }

    public string? AvatarUrl { get; set; }
}

/// <summary>
/// Thông tin tài khoản được phép trả về FE.
/// </summary>
public record LoginUserDto(
    Guid Id,
    string FullName,
    string Email,
    string Phone,
    string SystemRole
);

/// <summary>
/// UC02 - Kết quả đăng nhập thành công.
/// </summary>
public record LoginResultDto(
    string AccessToken,
    string RefreshToken,
    DateTime AccessTokenExpiresAt,
    DateTime RefreshTokenExpiresAt,
    LoginUserDto User
);

public sealed class LoginFailure(
    int status,
    string code,
    string message) : Exception(message)
{
    public int Status { get; } = status;

    public string Code { get; } = code;
}