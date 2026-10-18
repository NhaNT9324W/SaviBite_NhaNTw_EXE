using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SaveBiteBE.Shared;

namespace SaveBiteBE.Features.Refunds;

[ApiController]
[Authorize]
public sealed class RefundsController : ControllerBase
{
    private readonly RefundService _service;

    public RefundsController(RefundService service)
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
            throw new RefundOperationFailure(
                401,
                "INVALID_SESSION",
                "Phiên đăng nhập không hợp lệ.");
        }

        return userId;
    }

    private ObjectResult Fail(
        RefundOperationFailure failure)
    {
        return StatusCode(
            failure.Status,
            ApiResponse.Fail(
                failure.Code,
                failure.Message));
    }

    [HttpGet("/api/me/refund-orders")]
    public async Task<IActionResult> GetMyOrders(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 10,
        CancellationToken cancellationToken = default)
    {
        try
        {
            return Ok(ApiResponse.Ok(
                await _service.GetMyOrdersAsync(
                    GetUserId(),
                    page,
                    limit,
                    cancellationToken)));
        }
        catch (RefundOperationFailure failure)
        {
            return Fail(failure);
        }
    }

    [HttpGet("/api/orders/{orderId:guid}/refund-request")]
    public async Task<IActionResult> GetOrderState(
        Guid orderId,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(ApiResponse.Ok(
                await _service.GetOrderStateAsync(
                    GetUserId(),
                    orderId,
                    cancellationToken)));
        }
        catch (RefundOperationFailure failure)
        {
            return Fail(failure);
        }
    }

    [HttpPost("/api/orders/{orderId:guid}/refund-request")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(7 * 1024 * 1024)]
    [RequestFormLimits(
        MultipartBodyLengthLimit = 7 * 1024 * 1024)]
    public async Task<IActionResult> Create(
        Guid orderId,
        [FromForm] CreateRefundRequestInput input,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _service.CreateAsync(
                GetUserId(),
                orderId,
                input,
                cancellationToken);

            return CreatedAtAction(
                nameof(Get),
                new { id = result.Id },
                ApiResponse.Ok(result));
        }
        catch (RefundOperationFailure failure)
        {
            return Fail(failure);
        }
    }

    [HttpGet("/api/refund-requests/{id:guid}")]
    public async Task<IActionResult> Get(
        Guid id,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(ApiResponse.Ok(
                await _service.GetAsync(
                    GetUserId(),
                    id,
                    cancellationToken)));
        }
        catch (RefundOperationFailure failure)
        {
            return Fail(failure);
        }
    }

    [HttpGet(
        "/api/refund-requests/{id:guid}/evidences/{evidenceId:guid}/image")]
    public async Task<IActionResult> GetImage(
        Guid id,
        Guid evidenceId,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(ApiResponse.Ok(
                await _service.GetImageAsync(
                    GetUserId(),
                    id,
                    evidenceId,
                    cancellationToken)));
        }
        catch (RefundOperationFailure failure)
        {
            return Fail(failure);
        }
    }
}