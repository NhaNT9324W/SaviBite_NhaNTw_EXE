using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SaveBiteBE.Features.Refunds;
using SaveBiteBE.Shared;

namespace SaveBiteBE.Features.AdminRefunds;

[ApiController]
[Authorize]
[Route("api/admin/refund-requests")]
public sealed class AdminRefundsController(
    AdminRefundService service)
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
            throw new AdminRefundFailure(
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
        catch (AdminRefundFailure failure)
        {
            return StatusCode(
                failure.Status,
                ApiResponse.Fail(
                    failure.Code,
                    failure.Message));
        }
        catch (RefundOperationFailure failure)
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

    [HttpGet("{refundId:guid}")]
    public Task<IActionResult> GetDetail(
        Guid refundId,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(actorUserId =>
            service.GetDetailAsync(
                actorUserId,
                refundId,
                cancellationToken));
    }

    [HttpPost("{refundId:guid}/approve")]
    public Task<IActionResult> Approve(
        Guid refundId,
        [FromBody] ReviewRefundInput input,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(actorUserId =>
            service.ApproveAsync(
                actorUserId,
                refundId,
                input,
                cancellationToken));
    }

    [HttpPost("{refundId:guid}/reject")]
    public Task<IActionResult> Reject(
        Guid refundId,
        [FromBody] ReviewRefundInput input,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(actorUserId =>
            service.RejectAsync(
                actorUserId,
                refundId,
                input,
                cancellationToken));
    }
}