using System.ComponentModel.DataAnnotations;

namespace SaveBiteBE.Features.Auth;

/// <summary>
/// UC01 - Đăng ký.
/// Dữ liệu tạo tài khoản khách hàng.
/// </summary>
public class RegisterRequest
{
    [Required(ErrorMessage = "Vui lòng nhập họ tên.")]
    [StringLength(
        100,
        MinimumLength = 2,
        ErrorMessage = "Họ tên phải có từ 2 đến 100 ký tự.")]
    public string FullName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập email.")]
    [EmailAddress(ErrorMessage = "Email không hợp lệ.")]
    [StringLength(
        254,
        ErrorMessage = "Email không được vượt quá 254 ký tự.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập số điện thoại.")]
    [RegularExpression(
        @"^0[0-9]{9}$",
        ErrorMessage =
            "Số điện thoại phải có 10 chữ số và bắt đầu bằng 0.")]
    public string Phone { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập mật khẩu.")]
    [StringLength(
        100,
        MinimumLength = 8,
        ErrorMessage = "Mật khẩu phải có từ 8 đến 100 ký tự.")]
    [RegularExpression(
        @"^(?=.*[A-Za-z])(?=.*[0-9]).+$",
        ErrorMessage = "Mật khẩu phải có ít nhất một chữ và một số.")]
    public string Password { get; set; } = string.Empty;
}