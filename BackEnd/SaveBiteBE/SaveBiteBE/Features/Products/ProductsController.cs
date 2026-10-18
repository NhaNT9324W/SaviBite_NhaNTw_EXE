using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SaveBiteBE.Features.Shops;

namespace SaveBiteBE.Features.Products;

[ApiController]
[Authorize]
[Route("api/shops/{shopId:guid}/products")]
public class ProductsController(
    ProductService productService,
    ShopAccessService shopAccess)
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
    /// Các cửa hàng mà tài khoản được phép quản lý.
    /// </summary>
    [HttpGet("/api/me/managed-shops")]
    public Task<IActionResult> GetManagedShops(
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(userId =>
            shopAccess.GetManagedShopsAsync(
                userId,
                cancellationToken
            )
        );
    }

    [HttpGet]
    public Task<IActionResult> GetProducts(
        Guid shopId,
        CancellationToken cancellationToken,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20)
    {
        return ExecuteAsync(userId =>
            productService.GetListAsync(
                userId,
                shopId,
                page,
                limit,
                cancellationToken
            )
        );
    }

    [HttpGet("categories")]
    public Task<IActionResult> GetCategories(
        Guid shopId,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(userId =>
            productService.GetCategoriesAsync(
                userId,
                shopId,
                cancellationToken
            )
        );
    }

    [HttpGet("{productId:guid}")]
    public Task<IActionResult> GetProduct(
        Guid shopId,
        Guid productId,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(userId =>
            productService.GetAsync(
                userId,
                shopId,
                productId,
                cancellationToken
            )
        );
    }

    [HttpPost]
    public Task<IActionResult> CreateProduct(
        Guid shopId,
        [FromBody] SaveProductRequest request,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(
            userId => productService.CreateAsync(
                userId,
                shopId,
                request,
                cancellationToken
            ),
            StatusCodes.Status201Created
        );
    }

    [HttpPatch("{productId:guid}")]
    public Task<IActionResult> UpdateProduct(
        Guid shopId,
        Guid productId,
        [FromBody] SaveProductRequest request,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(userId =>
            productService.UpdateAsync(
                userId,
                shopId,
                productId,
                request,
                cancellationToken
            )
        );
    }

    [HttpDelete("{productId:guid}")]
    public Task<IActionResult> DeleteProduct(
        Guid shopId,
        Guid productId,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(userId =>
            productService.DeleteAsync(
                userId,
                shopId,
                productId,
                cancellationToken
            )
        );
    }

    [HttpPost("{productId:guid}/image")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(3 * 1024 * 1024)]
    [RequestFormLimits(
        MultipartBodyLengthLimit = 3 * 1024 * 1024
    )]
    public Task<IActionResult> UploadImage(
        Guid shopId,
        Guid productId,
        [FromForm] UploadProductImageRequest request,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(userId =>
            productService.UploadImageAsync(
                userId,
                shopId,
                productId,
                request.File!,
                cancellationToken
            )
        );
    }
}