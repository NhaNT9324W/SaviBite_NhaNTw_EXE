using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SaveBiteBE.Features.Offers;

/// <summary>
/// UC04, UC05 - API ưu đãi công khai.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/offers")]
public class OffersController(OfferService offerService)
    : ControllerBase
{
    /// <summary>
    /// UC04, UC05 - Danh sách, tìm kiếm và lọc ưu đãi.
    /// GET http://localhost:5122/api/offers
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetList(
        [FromQuery] OfferListRequest request,
        CancellationToken cancellationToken)
    {
        var result = await offerService.GetListAsync(
            request,
            cancellationToken
        );

        return Ok(new
        {
            success = true,
            data = result,
            message = "Lấy danh sách ưu đãi thành công."
        });
    }

    /// <summary>
    /// UC05 - Dữ liệu lựa chọn cho bộ lọc.
    /// GET http://localhost:5122/api/offers/filter-options
    /// </summary>
    [HttpGet("filter-options")]
    public async Task<IActionResult> GetFilterOptions(
        CancellationToken cancellationToken)
    {
        var result =
            await offerService.GetFilterOptionsAsync(
                cancellationToken
            );

        return Ok(new
        {
            success = true,
            data = result,
            message = "Lấy bộ lọc thành công."
        });
    }
}