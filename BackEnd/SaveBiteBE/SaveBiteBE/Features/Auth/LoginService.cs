using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SaveBiteBE.Data;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Features.Auth;

/// <summary>
/// UC02 - Kiểm tra mật khẩu, cấp token và quản lý phiên.
/// </summary>
public class LoginService(
    SaviBiteDbContext db,
    IPasswordHasher<User> passwordHasher,
    IConfiguration configuration)
{
    private static LoginFailure InvalidCredentials()
    {
        return new LoginFailure(
            401,
            "INVALID_CREDENTIALS",
            "Email hoặc mật khẩu không đúng."
        );
    }

    private static LoginFailure InvalidSession()
    {
        return new LoginFailure(
            401,
            "INVALID_SESSION",
            "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."
        );
    }

    private static string HashToken(string token)
    {
        var bytes = Encoding.UTF8.GetBytes(token);

        return Convert.ToHexString(
            SHA256.HashData(bytes)
        );
    }

    private static LoginUserDto MapUser(User user)
    {
        return new LoginUserDto(
            user.Id,
            user.FullName,
            user.Email,
            user.Phone,
            user.SystemRole
        );
    }

    private static void EnsureActive(User user)
    {
        if (user.DeletedAt != null || user.Status != "ACTIVE")
        {
            throw new LoginFailure(
                403,
                "ACCOUNT_DISABLED",
                "Tài khoản đã bị khóa hoặc ngừng hoạt động."
            );
        }

        if (user.SystemRole is not ("USER" or "ADMIN"))
        {
            throw new LoginFailure(
                403,
                "INVALID_ROLE",
                "Quyền tài khoản chưa được cấu hình hợp lệ."
            );
        }
    }

    /// <summary>
    /// UC02 - Đăng nhập bằng email và mật khẩu.
    /// Không trim hoặc thay đổi mật khẩu.
    /// </summary>
    public async Task<LoginResultDto> LoginAsync(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        var user = await db.Users
            .SingleOrDefaultAsync(
                x => x.Email == email && x.DeletedAt == null,
                cancellationToken
            );

        if (user == null)
        {
            throw InvalidCredentials();
        }

        var verificationResult =
            passwordHasher.VerifyHashedPassword(
                user,
                user.PasswordHash,
                request.Password
            );

        if (verificationResult == PasswordVerificationResult.Failed)
        {
            throw InvalidCredentials();
        }

        EnsureActive(user);

        if (verificationResult ==
            PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = passwordHasher.HashPassword(
                user,
                request.Password
            );

            user.UpdatedAt = DateTime.UtcNow;
        }

        var result = IssueTokens(user);

        await db.SaveChangesAsync(cancellationToken);

        return result;
    }

    private LoginResultDto IssueTokens(User user)
    {
        var now = DateTime.UtcNow;

        var accessTokenExpiresAt = now.AddMinutes(15);
        var refreshTokenExpiresAt = now.AddDays(7);

        var refreshToken = Convert.ToHexString(
            RandomNumberGenerator.GetBytes(32)
        );

        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = HashToken(refreshToken),
            CreatedAt = now,
            ExpiresAt = refreshTokenExpiresAt
        });

        var claims = new[]
        {
            new Claim(
                JwtRegisteredClaimNames.Sub,
                user.Id.ToString()
            ),
            new Claim(
                JwtRegisteredClaimNames.Jti,
                Guid.NewGuid().ToString()
            ),
            new Claim("role", user.SystemRole)
        };

        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(
                configuration["Jwt:Key"]!
            )
        );

        var credentials = new SigningCredentials(
            key,
            SecurityAlgorithms.HmacSha256
        );

        var jwt = new JwtSecurityToken(
            issuer: configuration["Jwt:Issuer"],
            audience: configuration["Jwt:Audience"],
            claims: claims,
            notBefore: now,
            expires: accessTokenExpiresAt,
            signingCredentials: credentials
        );

        var accessToken = new JwtSecurityTokenHandler()
            .WriteToken(jwt);

        return new LoginResultDto(
            accessToken,
            refreshToken,
            accessTokenExpiresAt,
            refreshTokenExpiresAt,
            MapUser(user)
        );
    }

    /// <summary>
    /// Cấp cặp token mới và thu hồi refresh token cũ.
    /// Cập nhật có điều kiện để ngăn dùng lại token đồng thời.
    /// </summary>
    public async Task<LoginResultDto> RefreshAsync(
        string rawToken,
        CancellationToken cancellationToken)
    {
        var tokenHash = HashToken(rawToken);
        var now = DateTime.UtcNow;

        await using var transaction =
            await db.Database.BeginTransactionAsync(
                cancellationToken
            );

        var token = await db.RefreshTokens
            .AsNoTracking()
            .Include(x => x.User)
            .SingleOrDefaultAsync(
                x => x.TokenHash == tokenHash,
                cancellationToken
            );

        if (token == null ||
            token.RevokedAt != null ||
            token.ExpiresAt <= now)
        {
            throw InvalidSession();
        }

        EnsureActive(token.User);

        var affectedRows = await db.RefreshTokens
            .Where(x =>
                x.Id == token.Id &&
                x.RevokedAt == null &&
                x.ExpiresAt > now)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(
                    x => x.RevokedAt,
                    (DateTime?)now
                ),
                cancellationToken
            );

        if (affectedRows != 1)
        {
            throw InvalidSession();
        }

        var result = IssueTokens(token.User);

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return result;
    }

    /// <summary>
    /// Trả thông tin tài khoản đang đăng nhập.
    /// </summary>
    public async Task<LoginUserDto> MeAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var user = await db.Users
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.Id == userId,
                cancellationToken
            );

        if (user == null)
        {
            throw InvalidSession();
        }

        EnsureActive(user);

        return MapUser(user);
    }

    /// <summary>
    /// Thu hồi refresh token thuộc người đang đăng nhập.
    /// </summary>
    public async Task LogoutAsync(
        Guid userId,
        string rawToken,
        CancellationToken cancellationToken)
    {
        var tokenHash = HashToken(rawToken);
        var now = DateTime.UtcNow;

        await db.RefreshTokens
            .Where(x =>
                x.UserId == userId &&
                x.TokenHash == tokenHash &&
                x.RevokedAt == null)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(
                    x => x.RevokedAt,
                    (DateTime?)now
                ),
                cancellationToken
            );
    }

    /// <summary>
    /// Đăng nhập hoặc đăng ký tài khoản qua Google OAuth.
    /// </summary>
    public async Task<LoginResultDto> GoogleLoginAsync(
        GoogleLoginRequest request,
        CancellationToken cancellationToken)
    {
        string email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
        string name = (request.FullName ?? string.Empty).Trim();
        string? avatarUrl = request.AvatarUrl;

        // Nếu chưa có email truyền trực tiếp, thử đọc từ token JWT nếu hợp lệ
        if (string.IsNullOrWhiteSpace(email) && !string.IsNullOrWhiteSpace(request.IdToken))
        {
            try
            {
                var handler = new JwtSecurityTokenHandler();
                if (handler.CanReadToken(request.IdToken))
                {
                    var jwt = handler.ReadJwtToken(request.IdToken);
                    email = (jwt.Claims.FirstOrDefault(c => c.Type == "email")?.Value ?? string.Empty).Trim().ToLowerInvariant();
                    name = jwt.Claims.FirstOrDefault(c => c.Type == "name")?.Value ?? name;
                    avatarUrl ??= jwt.Claims.FirstOrDefault(c => c.Type == "picture")?.Value;
                }
            }
            catch
            {
                // Bỏ qua lỗi parse token định dạng khác
            }
        }

        if (string.IsNullOrWhiteSpace(email))
        {
            throw new LoginFailure(400, "INVALID_GOOGLE_TOKEN", "Không thể xác định email tài khoản Google.");
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            name = email.Split('@')[0];
        }

        var user = await db.Users
            .SingleOrDefaultAsync(x => x.Email == email && x.DeletedAt == null, cancellationToken);

        if (user == null)
        {
            var now = DateTime.UtcNow;
            user = new User
            {
                Id = Guid.NewGuid(),
                Email = email,
                FullName = name,
                AvatarUrl = avatarUrl,
                Phone = "",
                PasswordHash = passwordHasher.HashPassword(null!, Guid.NewGuid().ToString("N")),
                SystemRole = "USER",
                Status = "ACTIVE",
                CreatedAt = now,
                UpdatedAt = now
            };

            db.Users.Add(user);
        }
        else
        {
            EnsureActive(user);
            if (!string.IsNullOrWhiteSpace(avatarUrl) && user.AvatarUrl != avatarUrl)
            {
                user.AvatarUrl = avatarUrl;
                user.UpdatedAt = DateTime.UtcNow;
            }
        }

        var result = IssueTokens(user);
        await db.SaveChangesAsync(cancellationToken);

        return result;
    }
}