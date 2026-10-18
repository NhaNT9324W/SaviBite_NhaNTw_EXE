using System.ComponentModel.DataAnnotations;

namespace SaveBiteBE.Features.Profile;

/// <summary>
/// UC03 - Dữ liệu cập nhật thông tin cá nhân.
/// </summary>
public class UpdateProfileRequest
{
    [Required(ErrorMessage = "Vui lòng nhập họ tên.")]
    [StringLength(
        100,
        MinimumLength = 2,
        ErrorMessage = "Họ tên phải từ 2 đến 100 ký tự."
    )]
    public string FullName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập số điện thoại.")]
    [RegularExpression(
        @"^0[0-9]{9}$",
        ErrorMessage = "Số điện thoại phải có 10 chữ số và bắt đầu bằng 0."
    )]
    public string Phone { get; set; } = string.Empty;
}

/// <summary>
/// UC03 - File ảnh đại diện nhận từ multipart/form-data.
/// </summary>
public class UploadAvatarRequest
{
    [Required(ErrorMessage = "Vui lòng chọn ảnh đại diện.")]
    public IFormFile? File { get; set; }
}

/// <summary>
/// Thông tin hồ sơ được phép trả về FE.
/// </summary>
public record ProfileDto(
    Guid Id,
    string FullName,
    string Email,
    string Phone,
    string? AvatarUrl,
    string SystemRole,
    DateTime UpdatedAt
);

public sealed class ProfileFailure(
    int status,
    string code,
    string message) : Exception(message)
{
    public int Status { get; } = status;

    public string Code { get; } = code;
}