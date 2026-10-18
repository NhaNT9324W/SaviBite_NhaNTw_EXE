using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SaveBiteBE.Features.Profile;

/// <summary>
/// UC03 - API hồ sơ của tài khoản đang đăng nhập.
/// </summary>
[ApiController]
[Authorize]
[Route("api/me")]
public class ProfileController(ProfileService profileService)
    : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue("sub")!);

    private async Task<IActionResult> ExecuteAsync(
        Func<Task<ProfileDto>> action)
    {
        try
        {
            var profile = await action();

            return Ok(new
            {
                success = true,
                data = profile,
                message = "Thành công."
            });
        }
        catch (ProfileFailure exception)
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
    /// UC03 - Xem hồ sơ cá nhân.
    /// GET http://localhost:5122/api/me/profile
    /// </summary>
    [HttpGet("profile")]
    public Task<IActionResult> GetProfile(
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(() =>
            profileService.GetAsync(
                CurrentUserId,
                cancellationToken
            )
        );
    }

    /// <summary>
    /// UC03 - Cập nhật hồ sơ cá nhân.
    /// PATCH http://localhost:5122/api/me/profile
    /// </summary>
    [HttpPatch("profile")]
    public Task<IActionResult> UpdateProfile(
        UpdateProfileRequest request,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(() =>
            profileService.UpdateAsync(
                CurrentUserId,
                request,
                cancellationToken
            )
        );
    }

    /// <summary>
    /// UC03 - Tải ảnh đại diện.
    /// POST http://localhost:5122/api/me/avatar
    /// </summary>
    [HttpPost("avatar")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(3 * 1024 * 1024)]
    [RequestFormLimits(
        MultipartBodyLengthLimit = 3 * 1024 * 1024
    )]
    public Task<IActionResult> UploadAvatar(
        [FromForm] UploadAvatarRequest request,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(() =>
            profileService.UploadAvatarAsync(
                CurrentUserId,
                request.File!,
                cancellationToken
            )
        );
    }
}