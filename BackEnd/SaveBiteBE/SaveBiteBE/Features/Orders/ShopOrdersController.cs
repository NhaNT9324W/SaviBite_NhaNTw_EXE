using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SaveBiteBE.Shared;

namespace SaveBiteBE.Features.Orders;

[ApiController]
[Authorize]
[Route("api/shops/{shopId:guid}/orders")]
public sealed class ShopOrdersController : ControllerBase
{
    private readonly ShopOrderService _service;

    public ShopOrdersController(ShopOrderService service)
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
            throw new ShopOrderOperationFailure(
                401,
                "INVALID_SESSION",
                "Phiên đăng nhập không hợp lệ.");
        }

        return userId;
    }

    [HttpGet]
    public async Task<IActionResult> GetList(
        Guid shopId,
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 10,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await _service.GetListAsync(
                GetUserId(),
                shopId,
                status,
                page,
                limit,
                cancellationToken);

            return Ok(ApiResponse.Ok(result));
        }
        catch (ShopOrderOperationFailure failure)
        {
            return StatusCode(
                failure.Status,
                ApiResponse.Fail(
                    failure.Code,
                    failure.Message));
        }
    }

    [HttpGet("{orderId:guid}")]
    public async Task<IActionResult> Get(
        Guid shopId,
        Guid orderId,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _service.GetAsync(
                GetUserId(),
                shopId,
                orderId,
                cancellationToken);

            return Ok(ApiResponse.Ok(result));
        }
        catch (ShopOrderOperationFailure failure)
        {
            return StatusCode(
                failure.Status,
                ApiResponse.Fail(
                    failure.Code,
                    failure.Message));
        }
    }

    [HttpPatch("{orderId:guid}/status")]
    public async Task<IActionResult> UpdateStatus(
        Guid shopId,
        Guid orderId,
        [FromBody] UpdateShopOrderStatusRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _service.UpdateStatusAsync(
                GetUserId(),
                shopId,
                orderId,
                request,
                cancellationToken);

            return Ok(ApiResponse.Ok(result));
        }
        catch (ShopOrderOperationFailure failure)
        {
            return StatusCode(
                failure.Status,
                ApiResponse.Fail(
                    failure.Code,
                    failure.Message));
        }
    }
}