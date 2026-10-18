using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SaveBiteBE.Features.Offers;

/// <summary>
/// UC06 - API chi tiết ưu đãi công khai.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/offers")]
public class OfferDetailController(
    OfferDetailService offerDetailService)
    : ControllerBase
{
    /// <summary>
    /// UC06 - Xem chi tiết ưu đãi.
    /// GET http://localhost:5122/api/offers/{id}
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetDetail(
        Guid id,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await offerDetailService.GetAsync(
                id,
                cancellationToken
            );

            return Ok(new
            {
                success = true,
                data = result,
                message = "Lấy chi tiết ưu đãi thành công."
            });
        }
        catch (OfferDetailFailure exception)
        {
            return StatusCode(exception.Status, new
            {
                success = false,
                error = new
                {
                    code = exception.Code,
                    message = exception.Message
                }
            });
        }
    }
}