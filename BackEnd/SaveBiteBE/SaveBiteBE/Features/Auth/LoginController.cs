using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace SaveBiteBE.Features.Auth;

/// <summary>
/// UC02 - API đăng nhập và quản lý phiên.
/// </summary>
[ApiController]
[Route("api/auth")]
public class LoginController(LoginService loginService)
    : ControllerBase
{
    private async Task<IActionResult> ExecuteAsync(
        Func<Task<object?>> action)
    {
        try
        {
            var data = await action();

            return Ok(new
            {
                success = true,
                data,
                message = "Thành công."
            });
        }
        catch (LoginFailure exception)
        {
            return StatusCode(exception.Status, new
            {
                success = false,
                error = new
                {
                    code = exception.Code,
                    message = exception.Message
                }
            });
        }
    }

    /// <summary>
    /// UC02 - Đăng nhập.
    /// POST http://localhost:5122/api/auth/login
    /// </summary>
    [AllowAnonymous]
    [HttpPost("login")]
    [EnableRateLimiting("auth-login")]
    public Task<IActionResult> Login(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(async () =>
            await loginService.LoginAsync(
                request,
                cancellationToken
            )
        );
    }

    /// <summary>
    /// Cấp lại token.
    /// POST http://localhost:5122/api/auth/refresh
    /// </summary>
    [AllowAnonymous]
    [HttpPost("refresh")]
    [EnableRateLimiting("auth-login")]
    public Task<IActionResult> Refresh(
        RefreshRequest request,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(async () =>
            await loginService.RefreshAsync(
                request.RefreshToken,
                cancellationToken
            )
        );
    }

    /// <summary>
    /// Kiểm tra phiên đăng nhập bằng JWT.
    /// GET http://localhost:5122/api/auth/me
    /// </summary>
    [Authorize]
    [HttpGet("me")]
    public Task<IActionResult> Me(
        CancellationToken cancellationToken)
    {
        var userId = Guid.Parse(
            User.FindFirstValue("sub")!
        );

        return ExecuteAsync(async () =>
            await loginService.MeAsync(
                userId,
                cancellationToken
            )
        );
    }

    /// <summary>
    /// Đăng xuất và thu hồi refresh token.
    /// POST http://localhost:5122/api/auth/logout
    /// </summary>
    [Authorize]
    [HttpPost("logout")]
    public Task<IActionResult> Logout(
        RefreshRequest request,
        CancellationToken cancellationToken)
    {
        var userId = Guid.Parse(
            User.FindFirstValue("sub")!
        );

        return ExecuteAsync(async () =>
        {
            await loginService.LogoutAsync(
                userId,
                request.RefreshToken,
                cancellationToken
            );

            return null;
        });
    }
}