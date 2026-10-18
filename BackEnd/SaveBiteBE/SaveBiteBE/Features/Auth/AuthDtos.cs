namespace SaveBiteBE.Features.Auth;

/// <summary>
/// UC01 - Đăng ký.
/// Thông tin tài khoản trả về, không chứa mật khẩu hoặc hash.
/// </summary>
public sealed record RegisteredUserDto(
    Guid Id,
    string FullName,
    string Email,
    string Phone,
    string SystemRole,
    string Status,
    DateTime CreatedAt);