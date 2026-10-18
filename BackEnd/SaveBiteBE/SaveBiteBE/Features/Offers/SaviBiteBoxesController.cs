using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SaveBiteBE.Features.Shops;

namespace SaveBiteBE.Features.Offers;

[ApiController]
[Authorize]
[Route("api/shops/{shopId:guid}/offers/boxes")]
public class SaviBiteBoxesController(
    SaviBiteBoxService boxService)
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

    /// <summary>
    /// UC09 - Danh sách SaviBite Box của cửa hàng.
    /// </summary>
    [HttpGet]
    public Task<IActionResult> GetBoxes(
        Guid shopId,
        CancellationToken cancellationToken,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 10)
    {
        return ExecuteAsync(userId =>
            boxService.GetListAsync(
                userId,
                shopId,
                page,
                limit,
                cancellationToken
            )
        );
    }

    /// <summary>
    /// UC09 - Tạo SaviBite Box.
    /// </summary>
    [HttpPost]
    public Task<IActionResult> CreateBox(
        Guid shopId,
        [FromBody] CreateSaviBiteBoxRequest request,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(
            userId => boxService.CreateAsync(
                userId,
                shopId,
                request,
                cancellationToken
            ),
            StatusCodes.Status201Created
        );
    }
}