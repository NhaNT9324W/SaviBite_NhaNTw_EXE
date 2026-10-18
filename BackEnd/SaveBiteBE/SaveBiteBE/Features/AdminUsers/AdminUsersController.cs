using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SaveBiteBE.Shared;

namespace SaveBiteBE.Features.AdminUsers;

[ApiController]
[Authorize]
[Route("api/admin/users")]
public sealed class AdminUsersController(
    AdminUserService service)
    : ControllerBase
{
    private Guid GetCurrentUserId()
    {
        var value =
            User.FindFirstValue("sub") ??
            User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (
            !Guid.TryParse(value, out var userId) ||
            userId == Guid.Empty)
        {
            throw new AdminUserFailure(
                401,
                "INVALID_SESSION",
                "Phiên đăng nhập không hợp lệ.");
        }

        return userId;
    }

    private async Task<IActionResult> ExecuteAsync<T>(
        Func<Guid, Task<T>> action)
        where T : notnull
    {
        try
        {
            var actorUserId = GetCurrentUserId();

            var result = await action(actorUserId);

            return Ok(ApiResponse.Ok(result));
        }
        catch (AdminUserFailure failure)
        {
            return StatusCode(
                failure.Status,
                ApiResponse.Fail(
                    failure.Code,
                    failure.Message));
        }
    }

    [HttpGet]
    public Task<IActionResult> GetPage(
        CancellationToken cancellationToken,
        [FromQuery] string? status = "ALL",
        [FromQuery] string? keyword = null,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 10)
    {
        return ExecuteAsync(actorUserId =>
            service.GetPageAsync(
                actorUserId,
                status,
                keyword,
                page,
                limit,
                cancellationToken));
    }

    [HttpGet("{userId:guid}")]
    public Task<IActionResult> GetDetail(
        Guid userId,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(actorUserId =>
            service.GetDetailAsync(
                actorUserId,
                userId,
                cancellationToken));
    }

    [HttpPost("{userId:guid}/lock")]
    public Task<IActionResult> Lock(
        Guid userId,
        [FromBody] ChangeUserStatusRequest request,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(actorUserId =>
            service.LockAsync(
                actorUserId,
                userId,
                request,
                cancellationToken));
    }

    [HttpPost("{userId:guid}/unlock")]
    public Task<IActionResult> Unlock(
        Guid userId,
        [FromBody] ChangeUserStatusRequest request,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(actorUserId =>
            service.UnlockAsync(
                actorUserId,
                userId,
                request,
                cancellationToken));
    }
}