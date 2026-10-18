using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SaveBiteBE.Data;

namespace SaveBiteBE.Features.Auth;

/// <summary>
/// UC02 - Cấu hình xác thực JWT và kiểm tra trạng thái tài khoản.
/// </summary>
public static class LoginSetup
{
    public static IServiceCollection AddLoginFeature(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var jwtKey = configuration["Jwt:Key"];
        var issuer = configuration["Jwt:Issuer"];
        var audience = configuration["Jwt:Audience"];

        if (string.IsNullOrWhiteSpace(jwtKey) ||
            Encoding.UTF8.GetByteCount(jwtKey) < 32)
        {
            throw new InvalidOperationException(
                "Jwt:Key phải có ít nhất 32 byte."
            );
        }

        if (string.IsNullOrWhiteSpace(issuer) ||
            string.IsNullOrWhiteSpace(audience))
        {
            throw new InvalidOperationException(
                "Thiếu Jwt:Issuer hoặc Jwt:Audience."
            );
        }

        services.AddScoped<LoginService>();

        services.AddAuthentication(
            JwtBearerDefaults.AuthenticationScheme
        ).AddJwtBearer(options =>
        {
            options.MapInboundClaims = false;

            options.TokenValidationParameters =
                new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = issuer,

                    ValidateAudience = true,
                    ValidAudience = audience,

                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,

                    IssuerSigningKey = new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes(jwtKey)
                    ),

                    ClockSkew = TimeSpan.FromSeconds(30),

                    NameClaimType = "sub",
                    RoleClaimType = "role",

                    ValidAlgorithms =
                    [
                        SecurityAlgorithms.HmacSha256
                    ]
                };

            options.Events = new JwtBearerEvents
            {
                OnTokenValidated = async context =>
                {
                    var idClaim = context.Principal?
                        .FindFirst("sub")?.Value;

                    if (!Guid.TryParse(idClaim, out var userId))
                    {
                        context.Fail("Invalid subject");
                        return;
                    }

                    var db = context.HttpContext.RequestServices
                        .GetRequiredService<SaviBiteDbContext>();

                    var user = await db.Users
                        .AsNoTracking()
                        .SingleOrDefaultAsync(
                            x => x.Id == userId,
                            context.HttpContext.RequestAborted
                        );

                    var tokenRole = context.Principal?
                        .FindFirst("role")?.Value;

                    if (user == null ||
                        user.DeletedAt != null ||
                        user.Status != "ACTIVE" ||
                        user.SystemRole != tokenRole)
                    {
                        context.Fail("Account unavailable");
                    }
                }
            };
        });

        services.AddAuthorization();

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = 429;

            options.AddPolicy("auth-login", context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?
                        .ToString() ?? "unknown",

                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 20,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0,
                        AutoReplenishment = true
                    }
                )
            );
        });

        return services;
    }
}