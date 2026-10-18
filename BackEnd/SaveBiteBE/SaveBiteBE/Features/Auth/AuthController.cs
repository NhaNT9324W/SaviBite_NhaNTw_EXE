using Microsoft.AspNetCore.Mvc;
using SaveBiteBE.Shared;

namespace SaveBiteBE.Features.Auth;

/// <summary>
/// API xác thực tài khoản SaviBite.
/// </summary>
[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AuthService _authService;

    public AuthController(AuthService authService)
    {
        _authService = authService;
    }

    /// <summary>
    /// UC01 - Đăng ký.
    /// API:
    /// POST http://localhost:5122/api/auth/register
    /// POST https://localhost:7203/api/auth/register
    /// </summary>
    [HttpPost("register")]
    public async Task<IActionResult> Register(
        [FromBody] RegisterRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var user = await _authService.RegisterAsync(
                request,
                cancellationToken);

            return StatusCode(
                StatusCodes.Status201Created,
                ApiResponse.Ok(user));
        }
        catch (RegistrationException exception)
        {
            return StatusCode(
                exception.StatusCode,
                ApiResponse.Fail(
                    exception.Code,
                    exception.Message));
        }
    }
}