using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using SaveBiteBE.Data;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Features.Auth;

/// <summary>
/// Lỗi nghiệp vụ của chức năng đăng ký.
/// </summary>
public sealed class RegistrationException : Exception
{
    public string Code { get; }

    public int StatusCode { get; }

    public RegistrationException(
        string code,
        string message,
        int statusCode)
        : base(message)
    {
        Code = code;
        StatusCode = statusCode;
    }
}

/// <summary>
/// Xử lý nghiệp vụ xác thực tài khoản.
/// </summary>
public class AuthService
{
    private readonly SaviBiteDbContext _dbContext;
    private readonly IPasswordHasher<User> _passwordHasher;

    public AuthService(
        SaviBiteDbContext dbContext,
        IPasswordHasher<User> passwordHasher)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
    }

    /// <summary>
    /// UC01 - Đăng ký.
    /// Kiểm tra dữ liệu trùng, hash mật khẩu và lưu tài khoản Customer.
    /// </summary>
    public async Task<RegisteredUserDto> RegisterAsync(
        RegisterRequest request,
        CancellationToken cancellationToken)
    {
        var fullName = request.FullName.Trim();
        var email = request.Email.Trim().ToLowerInvariant();
        var phone = request.Phone.Trim();

        if (fullName.Length < 2)
        {
            throw new RegistrationException(
                "INVALID_FULL_NAME",
                "Họ tên phải có ít nhất 2 ký tự sau khi bỏ khoảng trắng.",
                StatusCodes.Status400BadRequest);
        }

        var emailExists = await _dbContext.Users
            .AnyAsync(
                x => x.Email == email,
                cancellationToken);

        if (emailExists)
        {
            throw new RegistrationException(
                "EMAIL_ALREADY_EXISTS",
                "Email đã được sử dụng.",
                StatusCodes.Status409Conflict);
        }

        var phoneExists = await _dbContext.Users
            .AnyAsync(
                x => x.Phone == phone,
                cancellationToken);

        if (phoneExists)
        {
            throw new RegistrationException(
                "PHONE_ALREADY_EXISTS",
                "Số điện thoại đã được sử dụng.",
                StatusCodes.Status409Conflict);
        }

        var now = DateTime.UtcNow;

        var user = new User
        {
            FullName = fullName,
            Email = email,
            Phone = phone,
            SystemRole = "USER",
            Status = "ACTIVE",
            CreatedAt = now,
            UpdatedAt = now
        };

        user.PasswordHash = _passwordHasher.HashPassword(
            user,
            request.Password);

        _dbContext.Users.Add(user);

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception)
            when (exception.InnerException is SqlException sqlException
                && sqlException.Number is 2601 or 2627)
        {
            // Một yêu cầu khác có thể vừa đăng ký cùng email hoặc số điện thoại.
            throw new RegistrationException(
                "ACCOUNT_ALREADY_EXISTS",
                "Email hoặc số điện thoại đã được sử dụng.",
                StatusCodes.Status409Conflict);
        }

        return new RegisteredUserDto(
            user.Id,
            user.FullName,
            user.Email,
            user.Phone,
            user.SystemRole,
            user.Status,
            user.CreatedAt);
    }
}