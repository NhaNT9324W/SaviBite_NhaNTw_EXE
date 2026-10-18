using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SaveBiteBE.Shared;

namespace SaveBiteBE.Features.Reviews;

[ApiController]
[Authorize]
public sealed class ReviewsController : ControllerBase
{
    private readonly ReviewService _service;

    public ReviewsController(ReviewService service)
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
            throw new ReviewOperationFailure(
                401,
                "INVALID_SESSION",
                "Phiên đăng nhập không hợp lệ.");
        }

        return userId;
    }

    [HttpGet("/api/me/review-orders")]
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
        catch (ReviewOperationFailure failure)
        {
            return StatusCode(
                failure.Status,
                ApiResponse.Fail(
                    failure.Code,
                    failure.Message));
        }
    }

    [HttpGet("/api/orders/{orderId:guid}/review")]
    public async Task<IActionResult> GetOrderState(
        Guid orderId,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _service.GetOrderStateAsync(
                GetUserId(),
                orderId,
                cancellationToken);

            return Ok(ApiResponse.Ok(result));
        }
        catch (ReviewOperationFailure failure)
        {
            return StatusCode(
                failure.Status,
                ApiResponse.Fail(
                    failure.Code,
                    failure.Message));
        }
    }

    [HttpPost("/api/orders/{orderId:guid}/review")]
    public async Task<IActionResult> Create(
        Guid orderId,
        [FromBody] CreateReviewRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _service.CreateAsync(
                GetUserId(),
                orderId,
                request,
                cancellationToken);

            return Ok(ApiResponse.Ok(result));
        }
        catch (ReviewOperationFailure failure)
        {
            return StatusCode(
                failure.Status,
                ApiResponse.Fail(
                    failure.Code,
                    failure.Message));
        }
    }

    [AllowAnonymous]
    [HttpGet("/api/shops/{shopId:guid}/reviews")]
    public async Task<IActionResult> GetShopReviews(
        Guid shopId,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 10,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await _service.GetShopReviewsAsync(
                shopId,
                page,
                limit,
                cancellationToken);

            return Ok(ApiResponse.Ok(result));
        }
        catch (ReviewOperationFailure failure)
        {
            return StatusCode(
                failure.Status,
                ApiResponse.Fail(
                    failure.Code,
                    failure.Message));
        }
    }
}