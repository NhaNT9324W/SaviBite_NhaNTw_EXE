using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SaveBiteBE.Shared;

namespace SaveBiteBE.Features.Payments;

[ApiController]
[Authorize]
[Route("api/orders/{orderId:guid}/mock-payment")]
public sealed class PaymentsController : ControllerBase
{
    private readonly PaymentService _service;

    private readonly IWebHostEnvironment _environment;

    public PaymentsController(
        PaymentService service,
        IWebHostEnvironment environment)
    {
        _service = service;
        _environment = environment;
    }

    private Guid GetUserId()
    {
        var value =
            User.FindFirstValue(JwtRegisteredClaimNames.Sub) ??
            User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (!Guid.TryParse(value, out var userId))
        {
            throw new PaymentOperationFailure(
                401,
                "INVALID_SESSION",
                "Phiên đăng nhập không hợp lệ.");
        }

        return userId;
    }

    [HttpPost]
    public async Task<IActionResult> Pay(
        Guid orderId,
        [FromBody] MockPaymentRequest request,
        CancellationToken cancellationToken)
    {
        if (!_environment.IsDevelopment())
        {
            return NotFound(
                ApiResponse.Fail(
                    "MOCK_PAYMENT_DISABLED",
                    "Thanh toán mô phỏng chỉ dùng trong Development."));
        }

        try
        {
            var result = await _service.PayAsync(
                GetUserId(),
                orderId,
                request,
                cancellationToken);

            return Ok(ApiResponse.Ok(result));
        }
        catch (PaymentOperationFailure failure)
        {
            return StatusCode(
                failure.Status,
                ApiResponse.Fail(
                    failure.Code,
                    failure.Message));
        }
    }
}