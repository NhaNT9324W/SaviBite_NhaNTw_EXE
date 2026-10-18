using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SaveBiteBE.Shared;

namespace SaveBiteBE.Features.Orders;

[ApiController]
[Authorize]
[Route("api/orders")]
public sealed class OrdersController : ControllerBase
{
    private readonly OrderService _service;

    public OrdersController(OrderService service)
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
            throw new OrderOperationFailure(
                401,
                "INVALID_SESSION",
                "Phiên đăng nhập không hợp lệ.");
        }

        return userId;
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateOrderRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _service.CreateAsync(
                GetUserId(),
                request,
                cancellationToken);

            return CreatedAtAction(
                nameof(Get),
                new { id = result.Id },
                ApiResponse.Ok(result));
        }
        catch (OrderOperationFailure failure)
        {
            return StatusCode(
                failure.Status,
                ApiResponse.Fail(
                    failure.Code,
                    failure.Message));
        }
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(
        Guid id,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _service.GetAsync(
                GetUserId(),
                id,
                cancellationToken);

            return Ok(ApiResponse.Ok(result));
        }
        catch (OrderOperationFailure failure)
        {
            return StatusCode(
                failure.Status,
                ApiResponse.Fail(
                    failure.Code,
                    failure.Message));
        }
    }
}