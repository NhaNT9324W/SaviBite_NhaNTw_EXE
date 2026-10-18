using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SaveBiteBE.Features.Shops;

namespace SaveBiteBE.Features.Offers;

[ApiController]
[Authorize]
[Route("api/shops/{shopId:guid}/offers")]
public class ShopOffersController(
    FlashSaleService flashSaleService)
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
    /// UC08 - Sản phẩm có thể dùng để tạo Flash Sale.
    /// </summary>
    [HttpGet("flash-sale-products")]
    public Task<IActionResult> GetProducts(
        Guid shopId,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(userId =>
            flashSaleService.GetProductsAsync(
                userId,
                shopId,
                cancellationToken
            )
        );
    }

    /// <summary>
    /// UC08 - Danh sách Flash Sale của cửa hàng.
    /// </summary>
    [HttpGet]
    public Task<IActionResult> GetOffers(
        Guid shopId,
        CancellationToken cancellationToken,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 10)
    {
        return ExecuteAsync(userId =>
            flashSaleService.GetListAsync(
                userId,
                shopId,
                page,
                limit,
                cancellationToken
            )
        );
    }

    /// <summary>
    /// UC08 - Tạo Flash Sale.
    /// </summary>
    [HttpPost]
    public Task<IActionResult> CreateFlashSale(
        Guid shopId,
        [FromBody] CreateFlashSaleRequest request,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(
            userId => flashSaleService.CreateAsync(
                userId,
                shopId,
                request,
                cancellationToken
            ),
            StatusCodes.Status201Created
        );
    }
}