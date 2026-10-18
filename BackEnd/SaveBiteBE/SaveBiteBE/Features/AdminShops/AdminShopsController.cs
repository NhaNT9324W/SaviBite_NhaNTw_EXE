using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SaveBiteBE.Shared;

namespace SaveBiteBE.Features.AdminShops;

/// <summary>
/// UC18 - API Admin duyệt cửa hàng.
/// </summary>
[ApiController]
[Authorize]
[Route("api/admin/shops")]
public sealed class AdminShopsController(
    AdminShopService service)
    : ControllerBase
{
    private Guid GetCurrentUserId()
    {
        var value =
            User.FindFirstValue("sub") ??
            User.FindFirstValue(
                ClaimTypes.NameIdentifier);

        if (
            !Guid.TryParse(value, out var userId) ||
            userId == Guid.Empty)
        {
            throw new AdminShopFailure(
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
        catch (AdminShopFailure failure)
        {
            return StatusCode(
                failure.Status,
                ApiResponse.Fail(
                    failure.Code,
                    failure.Message));
        }
    }

    /// <summary>
    /// GET /api/admin/shops
    /// </summary>
    [HttpGet]
    public Task<IActionResult> GetPage(
        CancellationToken cancellationToken,
        [FromQuery] string? status = "PENDING",
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

    /// <summary>
    /// GET /api/admin/shops/{shopId}
    /// </summary>
    [HttpGet("{shopId:guid}")]
    public Task<IActionResult> GetDetail(
        Guid shopId,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(actorUserId =>
            service.GetDetailAsync(
                actorUserId,
                shopId,
                cancellationToken));
    }

    /// <summary>
    /// POST /api/admin/shops/{shopId}/approve
    /// </summary>
    [HttpPost("{shopId:guid}/approve")]
    public Task<IActionResult> Approve(
        Guid shopId,
        [FromBody] ReviewShopRequest request,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(actorUserId =>
            service.ApproveAsync(
                actorUserId,
                shopId,
                request,
                cancellationToken));
    }

    /// <summary>
    /// POST /api/admin/shops/{shopId}/reject
    /// </summary>
    [HttpPost("{shopId:guid}/reject")]
    public Task<IActionResult> Reject(
        Guid shopId,
        [FromBody] ReviewShopRequest request,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(actorUserId =>
            service.RejectAsync(
                actorUserId,
                shopId,
                request,
                cancellationToken));
    }
}