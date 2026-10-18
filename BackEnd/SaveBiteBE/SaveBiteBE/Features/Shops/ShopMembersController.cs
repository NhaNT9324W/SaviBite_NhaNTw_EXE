using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SaveBiteBE.Features.Shops;

[ApiController]
[Authorize]
[Route("api/shops/{shopId:guid}/members")]
public class ShopMembersController(
    ShopMemberService memberService)
    : ControllerBase
{
    private async Task<IActionResult> ExecuteAsync<T>(
        Func<Guid, Task<T>> action,
        int successStatus = StatusCodes.Status200OK)
    {
        var subject = User.FindFirstValue("sub")
            ?? User.FindFirstValue(
                ClaimTypes.NameIdentifier
            );

        if (!Guid.TryParse(subject, out var userId))
        {
            return Unauthorized(new
            {
                success = false,
                data = (object?)null,
                error = new
                {
                    code = "INVALID_SESSION",
                    message = "Phiên đăng nhập không hợp lệ."
                }
            });
        }

        try
        {
            var data = await action(userId);

            return StatusCode(successStatus, new
            {
                success = true,
                data,
                error = (object?)null
            });
        }
        catch (ShopOperationFailure exception)
        {
            return StatusCode(exception.Status, new
            {
                success = false,
                data = (object?)null,
                error = new
                {
                    code = exception.Code,
                    message = exception.Message
                }
            });
        }
    }

    [HttpGet]
    public Task<IActionResult> GetMembers(
        Guid shopId,
        CancellationToken cancellationToken,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20)
    {
        return ExecuteAsync(userId =>
            memberService.GetListAsync(
                userId,
                shopId,
                page,
                limit,
                cancellationToken
            )
        );
    }

    [HttpPost]
    public Task<IActionResult> AddMember(
        Guid shopId,
        [FromBody] AddShopMemberRequest request,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(
            userId => memberService.AddAsync(
                userId,
                shopId,
                request,
                cancellationToken
            ),
            StatusCodes.Status201Created
        );
    }

    [HttpPatch("{memberId:guid}")]
    public Task<IActionResult> UpdateMember(
        Guid shopId,
        Guid memberId,
        [FromBody] UpdateShopMemberRequest request,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(userId =>
            memberService.UpdateStatusAsync(
                userId,
                shopId,
                memberId,
                request,
                cancellationToken
            )
        );
    }

    [HttpDelete("{memberId:guid}")]
    public Task<IActionResult> DeleteMember(
        Guid shopId,
        Guid memberId,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(userId =>
            memberService.DeleteAsync(
                userId,
                shopId,
                memberId,
                cancellationToken
            )
        );
    }
}