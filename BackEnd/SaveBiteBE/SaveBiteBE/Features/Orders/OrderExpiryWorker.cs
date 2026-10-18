using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace SaveBiteBE.Features.Orders;

public sealed class OrderExpiryWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;

    private readonly ILogger<OrderExpiryWorker> _logger;

    public OrderExpiryWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<OrderExpiryWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(
            TimeSpan.FromSeconds(15));

        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await using var scope =
                        _scopeFactory.CreateAsyncScope();

                    var service = scope.ServiceProvider
                        .GetRequiredService<OrderService>();

                    await service.ExpireBatchAsync(
                        stoppingToken);
                }
                catch (OperationCanceledException)
                    when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception exception)
                {
                    _logger.LogError(
                        exception,
                        "Có lỗi khi xử lý đơn hàng hết hạn.");
                }

                if (!await timer.WaitForNextTickAsync(
                        stoppingToken))
                {
                    break;
                }
            }
        }
        catch (OperationCanceledException)
            when (stoppingToken.IsCancellationRequested)
        {
            // Ứng dụng đang dừng.
        }
    }
}