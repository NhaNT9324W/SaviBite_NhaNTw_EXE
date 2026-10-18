using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SaveBiteBE.Data;

namespace SaveBiteBE.Features.Offers;

/// <summary>
/// Cập nhật trạng thái Flash Sale và SaviBite Box.
/// Giữ tên class để dùng đăng ký service hiện tại.
/// </summary>
public class FlashSaleLifecycleWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<FlashSaleLifecycleWorker> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(
            TimeSpan.FromSeconds(15)
        );

        try
        {
            do
            {
                try
                {
                    await UpdateStatusesAsync(
                        stoppingToken
                    );
                }
                catch (OperationCanceledException)
                    when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception exception)
                {
                    logger.LogError(
                        exception,
                        "Không cập nhật được trạng thái ưu đãi."
                    );
                }
            }
            while (
                await timer.WaitForNextTickAsync(
                    stoppingToken
                )
            );
        }
        catch (OperationCanceledException)
            when (stoppingToken.IsCancellationRequested)
        {
            // Backend đang dừng.
        }
    }

    private async Task UpdateStatusesAsync(
        CancellationToken cancellationToken)
    {
        await using var scope =
            scopeFactory.CreateAsyncScope();

        var db = scope.ServiceProvider
            .GetRequiredService<SaviBiteDbContext>();

        var now = DateTime.UtcNow;

        var query = db.Offers.Where(x =>
            x.DeletedAt == null &&
            (
                x.OfferType == "FLASH_SALE" ||
                x.OfferType == "SAVIBITE_BOX"
            )
        );

        // Hết thời gian bán hoặc nhận hàng.
        await query
            .Where(x =>
                (
                    x.Status == "SCHEDULED" ||
                    x.Status == "ACTIVE" ||
                    x.Status == "SOLD_OUT"
                ) &&
                (
                    x.SaleEndAt <= now ||
                    x.PickupEndAt <= now
                )
            )
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(
                        x => x.Status,
                        "ENDED"
                    )
                    .SetProperty(
                        x => x.UpdatedAt,
                        now
                    ),
                cancellationToken
            );

        // Hết số suất/hộp.
        await query
            .Where(x =>
                (
                    x.Status == "ACTIVE" ||
                    x.Status == "SCHEDULED"
                ) &&
                x.AvailableQuantity <= 0 &&
                x.SaleEndAt > now &&
                x.PickupEndAt > now
            )
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(
                        x => x.Status,
                        "SOLD_OUT"
                    )
                    .SetProperty(
                        x => x.UpdatedAt,
                        now
                    ),
                cancellationToken
            );

        // Đến giờ bán; kiểm tra shop và product nếu có.
        await query
            .Where(x =>
                x.Status == "SCHEDULED" &&
                x.SaleStartAt <= now &&
                x.SaleEndAt > now &&
                x.PickupEndAt > now &&
                x.AvailableQuantity > 0 &&

                x.Shop.Status == "APPROVED" &&
                x.Shop.DeletedAt == null &&

                (
                    (
                        x.OfferType == "SAVIBITE_BOX" &&
                        x.ProductId == null
                    ) ||
                    (
                        x.ProductId != null &&
                        x.Product != null &&
                        x.Product.ShopId == x.ShopId &&
                        x.Product.Status == "ACTIVE" &&
                        x.Product.DeletedAt == null
                    )
                )
            )
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(
                        x => x.Status,
                        "ACTIVE"
                    )
                    .SetProperty(
                        x => x.UpdatedAt,
                        now
                    ),
                cancellationToken
            );
    }
}