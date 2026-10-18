using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SaveBiteBE.Shared;

namespace SaveBiteBE.Features.Pickups;

[ApiController]
[Authorize]
public sealed class PickupsController : ControllerBase
{
    private readonly PickupService _service;

    public PickupsController(PickupService service)
    {
        _service = service;
    }

    private Guid GetUserId()
    {
        var value =
            User.FindFirstValue(JwtRegisteredClaimNames.Sub) ??
            User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (!Guid.TryParse(value, out var userId))
        {
            throw new PickupOperationFailure(
                401,
                "INVALID_SESSION",
                "Phiên đăng nhập không hợp lệ.");
        }

        return userId;
    }

    [HttpGet("/api/me/pickup-orders")]
    public async Task<IActionResult> GetMyOrders(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 10,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await _service.GetMyOrdersAsync(
                GetUserId(),
                page,
                limit,
                cancellationToken);

            return Ok(ApiResponse.Ok(result));
        }
        catch (PickupOperationFailure failure)
        {
            return StatusCode(
                failure.Status,
                ApiResponse.Fail(
                    failure.Code,
                    failure.Message));
        }
    }

    [HttpPost("/api/orders/{orderId:guid}/pickup-code")]
    public async Task<IActionResult> IssueCode(
        Guid orderId,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _service.IssueCodeAsync(
                GetUserId(),
                orderId,
                cancellationToken);

            return Ok(ApiResponse.Ok(result));
        }
        catch (PickupOperationFailure failure)
        {
            return StatusCode(
                failure.Status,
                ApiResponse.Fail(
                    failure.Code,
                    failure.Message));
        }
    }

    [HttpPost(
        "/api/shops/{shopId:guid}/orders/{orderId:guid}/pickup")]
    public async Task<IActionResult> Confirm(
        Guid shopId,
        Guid orderId,
        [FromBody] ConfirmPickupRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _service.ConfirmAsync(
                GetUserId(),
                shopId,
                orderId,
                request,
                cancellationToken);

            return Ok(ApiResponse.Ok(result));
        }
        catch (PickupOperationFailure failure)
        {
            return StatusCode(
                failure.Status,
                ApiResponse.Fail(
                    failure.Code,
                    failure.Message));
        }
    }
}