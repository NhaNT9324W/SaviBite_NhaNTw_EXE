using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SaveBiteBE.Data;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Features.Refunds;

public sealed class RefundService
{
    private readonly SaviBiteDbContext _db;
    private readonly string _storageRoot;
    private readonly int _windowHours;

    private const int MaxImageBytes = 2 * 1024 * 1024;

    private sealed record ValidatedImage(
        string FileType,
        byte[] Bytes,
        string Hash);

    public RefundService(
        SaviBiteDbContext db,
        IWebHostEnvironment environment,
        IOptions<RefundPolicyOptions> policy)
    {
        _db = db;
        _windowHours = policy.Value.WindowHours;

        _storageRoot = Path.Combine(
            environment.ContentRootPath,
            "App_Data",
            "refund-evidences");
    }

    private async Task<User> GetActiveUserAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var user = await _db.Users
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.Id == userId &&
                     x.DeletedAt == null,
                cancellationToken);

        if (user is null)
        {
            throw new RefundOperationFailure(
                401,
                "INVALID_SESSION",
                "Phiên đăng nhập không hợp lệ.");
        }

        if (user.Status != "ACTIVE")
        {
            throw new RefundOperationFailure(
                403,
                "ACCOUNT_INACTIVE",
                "Tài khoản đã bị khóa hoặc ngừng hoạt động.");
        }

        return user;
    }

    private static DateTime AsUtc(DateTime value)
    {
        return DateTime.SpecifyKind(
            value,
            DateTimeKind.Utc);
    }

    private static RefundRequestDto MapDto(
        RefundRequest request)
    {
        return new RefundRequestDto(
            request.Id,
            request.OrderId,
            request.OrderNumber,
            request.ShopName,
            request.Reason,
            request.RequestedAmount,
            request.ApprovedAmount,
            request.Status,
            request.ResolutionNote,
            AsUtc(request.CreatedAt),
            AsUtc(request.DeadlineAt),
            request.ResolvedAt is DateTime resolvedAt
                ? AsUtc(resolvedAt)
                : null,

            request.Evidences
                .OrderBy(x => x.CreatedAt)
                .ThenBy(x => x.Id)
                .Select(x => new RefundEvidenceDto(
                    x.Id,
                    x.FileType,
                    x.FileSize,
                    AsUtc(x.CreatedAt)))
                .ToArray());
    }

    private static async Task<List<ValidatedImage>>
        ValidateImagesAsync(
            List<IFormFile> files,
            CancellationToken cancellationToken)
    {
        if (files is null || files.Count is < 1 or > 3)
        {
            throw new RefundOperationFailure(
                400,
                "INVALID_EVIDENCE_COUNT",
                "Vui lòng gửi từ 1 đến 3 ảnh minh chứng.");
        }

        var images = new List<ValidatedImage>();

        foreach (var file in files)
        {
            if (file is null ||
                file.Length <= 0 ||
                file.Length > MaxImageBytes)
            {
                throw new RefundOperationFailure(
                    400,
                    "INVALID_EVIDENCE_SIZE",
                    "Mỗi ảnh phải có dữ liệu và không vượt quá 2 MB.");
            }

            var fileType = file.ContentType.ToLowerInvariant();

            if (fileType is not ("image/jpeg" or "image/png"))
            {
                throw new RefundOperationFailure(
                    400,
                    "INVALID_EVIDENCE_TYPE",
                    "Minh chứng phải là ảnh JPG hoặc PNG.");
            }

            using var stream = new MemoryStream();

            await file.CopyToAsync(
                stream,
                cancellationToken);

            var bytes = stream.ToArray();

            if (bytes.Length == 0 || bytes.Length > MaxImageBytes)
            {
                throw new RefundOperationFailure(
                    400,
                    "INVALID_EVIDENCE_SIZE",
                    "Mỗi ảnh không được vượt quá 2 MB.");
            }

            var isJpeg =
                bytes.Length >= 3 &&
                bytes[0] == 0xFF &&
                bytes[1] == 0xD8 &&
                bytes[2] == 0xFF;

            var pngHeader = new byte[]
            {
                0x89, 0x50, 0x4E, 0x47,
                0x0D, 0x0A, 0x1A, 0x0A
            };

            var isPng =
                bytes.Length >= 8 &&
                bytes.Take(8).SequenceEqual(pngHeader);

            if (
                (fileType == "image/jpeg" && !isJpeg) ||
                (fileType == "image/png" && !isPng))
            {
                throw new RefundOperationFailure(
                    400,
                    "INVALID_EVIDENCE_CONTENT",
                    "Nội dung ảnh không đúng định dạng JPG hoặc PNG.");
            }

            images.Add(new ValidatedImage(
                fileType,
                bytes,
                Convert.ToHexString(
                    SHA256.HashData(bytes))));
        }

        return images;
    }

    private static string BuildHash(
        string reason,
        decimal amount,
        IReadOnlyList<ValidatedImage> images)
    {
        var payload = JsonSerializer.Serialize(new
        {
            Reason = reason,

            Amount = amount.ToString(
                "0.00",
                CultureInfo.InvariantCulture),

            Images = images
                .Select(x => $"{x.FileType}:{x.Hash}")
                .OrderBy(x => x, StringComparer.Ordinal)
                .ToArray()
        });

        return Convert.ToHexString(
            SHA256.HashData(
                Encoding.UTF8.GetBytes(payload)));
    }

    public async Task<RefundRequestDto> CreateAsync(
        Guid userId,
        Guid orderId,
        CreateRefundRequestInput input,
        CancellationToken cancellationToken)
    {
        await GetActiveUserAsync(
            userId,
            cancellationToken);

        var reason = input.Reason.Trim();

        if (reason.Length is < 10 or > 2000)
        {
            throw new RefundOperationFailure(
                400,
                "INVALID_REASON",
                "Lý do phải từ 10 đến 2000 ký tự.");
        }

        if (
            !decimal.TryParse(
                input.RequestedAmount,
                NumberStyles.AllowDecimalPoint,
                CultureInfo.InvariantCulture,
                out var amount) ||
            amount <= 0 ||
            decimal.Round(amount, 2) != amount)
        {
            throw new RefundOperationFailure(
                400,
                "INVALID_AMOUNT",
                "Số tiền phải lớn hơn 0 và tối đa 2 chữ số thập phân.");
        }

        var images = await ValidateImagesAsync(
            input.Files,
            cancellationToken);

        var requestHash = BuildHash(
            reason,
            amount,
            images);

        var createdPaths = new List<string>();
        var committed = false;

        try
        {
            await using var transaction =
                await _db.Database.BeginTransactionAsync(
                    cancellationToken);

            var order = await _db.Orders
                .FromSqlInterpolated(
                    $"""
                    SELECT *
                    FROM [orders] WITH (UPDLOCK, ROWLOCK)
                    WHERE [id] = {orderId}
                    """)
                .AsNoTracking()
                .SingleOrDefaultAsync(cancellationToken);

            if (order is null || order.UserId != userId)
            {
                throw new RefundOperationFailure(
                    404,
                    "ORDER_NOT_FOUND",
                    "Không tìm thấy đơn hàng của bạn.");
            }

            var existing = await _db.RefundRequests
                .AsNoTracking()
                .Include(x => x.Evidences)
                .SingleOrDefaultAsync(
                    x => x.UserId == userId &&
                         x.RequestId == input.RequestId,
                    cancellationToken);

            if (existing is not null)
            {
                if (
                    existing.OrderId != orderId ||
                    existing.RequestHash != requestHash)
                {
                    throw new RefundOperationFailure(
                        409,
                        "REQUEST_ID_REUSED",
                        "Mã yêu cầu đã được dùng cho nội dung khác.");
                }

                await transaction.CommitAsync(
                    cancellationToken);

                committed = true;

                return MapDto(existing);
            }

            var hasActiveRequest = await _db.RefundRequests
                .AsNoTracking()
                .AnyAsync(
                    x => x.OrderId == orderId &&
                         (
                             x.Status == "PENDING" ||
                             x.Status == "APPROVED"
                         ),
                    cancellationToken);

            if (hasActiveRequest)
            {
                throw new RefundOperationFailure(
                    409,
                    "REFUND_ALREADY_PENDING",
                    "Đơn đã có yêu cầu hoàn tiền đang xử lý.");
            }

            if (
                order.Status != "COMPLETED" ||
                order.PaymentStatus != "PAID")
            {
                throw new RefundOperationFailure(
                    409,
                    "ORDER_NOT_ELIGIBLE",
                    "Chỉ được yêu cầu hoàn tiền cho đơn đã thanh toán và nhận hàng thành công.");
            }

            var completedAt = await _db.PickupConfirmations
                .AsNoTracking()
                .Where(x => x.OrderId == orderId)
                .Select(x => x.ConfirmedAt)
                .SingleOrDefaultAsync(cancellationToken);

            if (completedAt is null)
            {
                throw new RefundOperationFailure(
                    409,
                    "PICKUP_NOT_CONFIRMED",
                    "Đơn chưa có xác nhận giao hàng.");
            }

            var deadline = completedAt.Value
                .AddHours(_windowHours);

            if (DateTime.UtcNow >= deadline)
            {
                throw new RefundOperationFailure(
                    409,
                    "REFUND_WINDOW_ENDED",
                    "Đã hết thời hạn gửi yêu cầu hoàn tiền.");
            }

            var payment = await _db.Payments
                .AsNoTracking()
                .SingleOrDefaultAsync(
                    x => x.OrderId == orderId &&
                         x.Status == "SUCCESS",
                    cancellationToken);

            if (
                payment is null ||
                amount > Math.Min(
                    order.TotalAmount,
                    payment.Amount))
            {
                throw new RefundOperationFailure(
                    400,
                    "AMOUNT_EXCEEDS_PAYMENT",
                    "Số tiền yêu cầu không được vượt quá tiền đã thanh toán.");
            }

            var refund = new RefundRequest
            {
                Id = Guid.NewGuid(),

                OrderId = order.Id,
                ShopId = order.ShopId,
                UserId = userId,

                RequestId = input.RequestId,
                RequestHash = requestHash,

                OrderNumber = order.OrderNumber,
                ShopName = order.ShopName,

                Reason = reason,
                RequestedAmount = amount,

                Status = "PENDING",
                DeadlineAt = deadline
            };

            var folder = Path.Combine(
                _storageRoot,
                refund.Id.ToString("N"));

            Directory.CreateDirectory(folder);

            foreach (var image in images)
            {
                var evidenceId = Guid.NewGuid();

                var extension = image.FileType == "image/png"
                    ? ".png"
                    : ".jpg";

                var fileName =
                    evidenceId.ToString("N") + extension;

                var path = Path.Combine(folder, fileName);

                createdPaths.Add(path);

                await File.WriteAllBytesAsync(
                    path,
                    image.Bytes,
                    cancellationToken);

                refund.Evidences.Add(new RefundEvidence
                {
                    Id = evidenceId,
                    RefundRequestId = refund.Id,
                    StoredFileName = fileName,
                    FileType = image.FileType,
                    FileSize = image.Bytes.Length,
                    CreatedAt = DateTime.UtcNow
                });
            }

            var now = DateTime.UtcNow;

            if (now >= deadline)
            {
                throw new RefundOperationFailure(
                    409,
                    "REFUND_WINDOW_ENDED",
                    "Đã hết thời hạn gửi yêu cầu hoàn tiền.");
            }

            refund.CreatedAt = now;

            var changedOrder = await _db.Orders
                .Where(x =>
                    x.Id == orderId &&
                    x.UserId == userId &&
                    x.Status == "COMPLETED" &&
                    x.PaymentStatus == "PAID")
                .ExecuteUpdateAsync(
                    setters => setters
                        .SetProperty(
                            x => x.Status,
                            "REFUND_REQUESTED")
                        .SetProperty(
                            x => x.UpdatedAt,
                            now),
                    cancellationToken);

            if (changedOrder != 1)
            {
                throw new RefundOperationFailure(
                    409,
                    "ORDER_CHANGED",
                    "Đơn hàng vừa thay đổi. Vui lòng làm mới.");
            }

            _db.RefundRequests.Add(refund);

            _db.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                ActorUserId = userId,
                Action = "REFUND_REQUEST_CREATED",
                TargetType = "RefundRequest",
                TargetId = refund.Id,
                OldValuesJson = "{}",

                NewValuesJson = JsonSerializer.Serialize(new
                {
                    refund.OrderId,
                    refund.RequestedAmount,
                    refund.Status,
                    EvidenceCount = images.Count
                }),

                CreatedAt = now
            });

            await _db.SaveChangesAsync(
                cancellationToken);

            await transaction.CommitAsync(
                cancellationToken);

            committed = true;

            return MapDto(refund);
        }
        finally
        {
            if (!committed)
            {
                foreach (var path in createdPaths)
                {
                    try
                    {
                        File.Delete(path);
                    }
                    catch
                    {
                        // Không để lỗi dọn file che lỗi request gốc.
                    }
                }
            }
        }
    }

    private async Task<RefundRequest> GetReadableRequestAsync(
        Guid userId,
        Guid requestId,
        CancellationToken cancellationToken)
    {
        var user = await GetActiveUserAsync(
            userId,
            cancellationToken);

        var request = await _db.RefundRequests
            .AsNoTracking()
            .Include(x => x.Evidences)
            .SingleOrDefaultAsync(
                x => x.Id == requestId,
                cancellationToken);

        if (
            request is null ||
            (
                request.UserId != userId &&
                user.SystemRole != "ADMIN"
            ))
        {
            throw new RefundOperationFailure(
                404,
                "REFUND_NOT_FOUND",
                "Không tìm thấy yêu cầu hoàn tiền.");
        }

        return request;
    }

    public async Task<RefundRequestDto> GetAsync(
        Guid userId,
        Guid requestId,
        CancellationToken cancellationToken)
    {
        var request = await GetReadableRequestAsync(
            userId,
            requestId,
            cancellationToken);

        return MapDto(request);
    }

    public async Task<RefundEvidenceImageDto> GetImageAsync(
        Guid userId,
        Guid requestId,
        Guid evidenceId,
        CancellationToken cancellationToken)
    {
        var request = await GetReadableRequestAsync(
            userId,
            requestId,
            cancellationToken);

        var evidence = request.Evidences
            .SingleOrDefault(x => x.Id == evidenceId);

        if (evidence is null)
        {
            throw new RefundOperationFailure(
                404,
                "EVIDENCE_NOT_FOUND",
                "Không tìm thấy ảnh minh chứng.");
        }

        var path = Path.Combine(
            _storageRoot,
            request.Id.ToString("N"),
            evidence.StoredFileName);

        if (!File.Exists(path))
        {
            throw new RefundOperationFailure(
                404,
                "EVIDENCE_NOT_FOUND",
                "Ảnh minh chứng hiện không có trên máy chủ.");
        }

        var bytes = await File.ReadAllBytesAsync(
            path,
            cancellationToken);

        return new RefundEvidenceImageDto(
            evidence.Id,
            evidence.FileType,
            $"data:{evidence.FileType};base64,{Convert.ToBase64String(bytes)}");
    }

    private async Task<RefundOrderStateDto> BuildOrderStateAsync(
        Order order,
        CancellationToken cancellationToken)
    {
        var completedAt = await _db.PickupConfirmations
            .AsNoTracking()
            .Where(x => x.OrderId == order.Id)
            .Select(x => x.ConfirmedAt)
            .SingleOrDefaultAsync(cancellationToken);

        DateTime? deadline = completedAt?
            .AddHours(_windowHours);

        var latest = await _db.RefundRequests
            .AsNoTracking()
            .Include(x => x.Evidences)
            .Where(x => x.OrderId == order.Id)
            .OrderByDescending(x => x.CreatedAt)
            .ThenByDescending(x => x.Id)
            .FirstOrDefaultAsync(cancellationToken);

        var isPending =
            latest?.Status is "PENDING" or "APPROVED";

        var canRequest =
            order.Status == "COMPLETED" &&
            order.PaymentStatus == "PAID" &&
            completedAt is not null &&
            deadline is DateTime end &&
            DateTime.UtcNow < end &&
            !isPending;

        var message = isPending
            ? "Đơn đã có yêu cầu hoàn tiền đang xử lý."
            : order.Status == "REFUNDED"
                ? "Đơn đã được xử lý hoàn tiền."
                : order.Status != "COMPLETED" ||
                  order.PaymentStatus != "PAID"
                    ? "Chỉ đơn đã thanh toán và nhận hàng thành công mới được gửi yêu cầu."
                    : completedAt is null
                        ? "Đơn chưa có xác nhận giao hàng."
                        : deadline <= DateTime.UtcNow
                            ? "Đã hết thời hạn gửi yêu cầu."
                            : "Bạn có thể gửi yêu cầu hoàn tiền.";

        return new RefundOrderStateDto(
            order.Id,
            order.OrderNumber,
            order.ShopName,
            order.Status,
            order.TotalAmount,
            completedAt is DateTime completed
                ? AsUtc(completed)
                : null,
            deadline is DateTime deadlineAt
                ? AsUtc(deadlineAt)
                : null,
            canRequest,
            message,
            latest is null ? null : MapDto(latest));
    }

    public async Task<RefundOrderStateDto> GetOrderStateAsync(
        Guid userId,
        Guid orderId,
        CancellationToken cancellationToken)
    {
        await GetActiveUserAsync(
            userId,
            cancellationToken);

        var order = await _db.Orders
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.Id == orderId &&
                     x.UserId == userId,
                cancellationToken);

        if (order is null)
        {
            throw new RefundOperationFailure(
                404,
                "ORDER_NOT_FOUND",
                "Không tìm thấy đơn hàng của bạn.");
        }

        return await BuildOrderStateAsync(
            order,
            cancellationToken);
    }

    public async Task<MyRefundOrderPageDto> GetMyOrdersAsync(
        Guid userId,
        int page,
        int limit,
        CancellationToken cancellationToken)
    {
        await GetActiveUserAsync(
            userId,
            cancellationToken);

        if (page < 1 || limit < 1 || limit > 50)
        {
            throw new RefundOperationFailure(
                400,
                "INVALID_PAGINATION",
                "Trang phải từ 1; số mục mỗi trang từ 1 đến 50.");
        }

        var query = _db.Orders
            .AsNoTracking()
            .Where(x =>
                x.UserId == userId &&
                (
                    x.Status == "COMPLETED" ||
                    x.Status == "REFUND_REQUESTED" ||
                    x.Status == "REFUNDED"
                ));

        var total = await query.CountAsync(
            cancellationToken);

        var totalPages = (int)Math.Ceiling(
            total / (double)limit);

        page = totalPages == 0
            ? 1
            : Math.Min(page, totalPages);

        var orders = await query
            .OrderByDescending(x => x.CreatedAt)
            .ThenByDescending(x => x.Id)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync(cancellationToken);

        var items = new List<RefundOrderStateDto>();

        foreach (var order in orders)
        {
            items.Add(await BuildOrderStateAsync(
                order,
                cancellationToken));
        }

        return new MyRefundOrderPageDto(
            items,
            total,
            page,
            limit,
            totalPages);
    }
}