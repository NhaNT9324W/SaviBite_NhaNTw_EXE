using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SaveBiteBE.Data;
using SaveBiteBE.Entities;
using SaveBiteBE.Features.Refunds;

namespace SaveBiteBE.Features.AdminRefunds;

public sealed class AdminRefundService(
    SaviBiteDbContext db,
    RefundService refundService)
{
    private static DateTime AsUtc(DateTime value)
    {
        return DateTime.SpecifyKind(
            value,
            DateTimeKind.Utc);
    }

    private async Task EnsureAdminAsync(
        Guid actorUserId,
        CancellationToken cancellationToken)
    {
        var actor = await db.Users
            .AsNoTracking()
            .Where(x =>
                x.Id == actorUserId &&
                x.DeletedAt == null)
            .Select(x => new
            {
                x.Status,
                x.SystemRole
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (actor is null)
        {
            throw new AdminRefundFailure(
                401,
                "INVALID_SESSION",
                "Phiên đăng nhập không hợp lệ.");
        }

        if (actor.Status != "ACTIVE")
        {
            throw new AdminRefundFailure(
                403,
                "ACCOUNT_INACTIVE",
                "Tài khoản đã bị khóa hoặc ngừng hoạt động.");
        }

        if (actor.SystemRole != "ADMIN")
        {
            throw new AdminRefundFailure(
                403,
                "ADMIN_REQUIRED",
                "Chỉ Admin được phép xử lý hoàn tiền.");
        }
    }

    public async Task<AdminRefundPageDto> GetPageAsync(
        Guid actorUserId,
        string? status,
        string? keyword,
        int page,
        int limit,
        CancellationToken cancellationToken)
    {
        await EnsureAdminAsync(
            actorUserId,
            cancellationToken);

        if (
            page < 1 ||
            limit < 1 ||
            limit > 50 ||
            page > int.MaxValue / limit)
        {
            throw new AdminRefundFailure(
                400,
                "INVALID_PAGINATION",
                "Trang phải từ 1; số yêu cầu mỗi trang từ 1 đến 50.");
        }

        var normalizedStatus =
            status?.Trim().ToUpperInvariant() ?? "PENDING";

        if (normalizedStatus.Length == 0)
        {
            normalizedStatus = "PENDING";
        }

        if (normalizedStatus is not (
            "ALL" or
            "PENDING" or
            "APPROVED" or
            "REJECTED" or
            "REFUNDED"))
        {
            throw new AdminRefundFailure(
                400,
                "INVALID_REFUND_STATUS",
                "Trạng thái yêu cầu không hợp lệ.");
        }

        var normalizedKeyword = keyword?.Trim() ?? "";

        if (normalizedKeyword.Length > 150)
        {
            throw new AdminRefundFailure(
                400,
                "INVALID_KEYWORD",
                "Từ khóa không được vượt quá 150 ký tự.");
        }

        var query = db.RefundRequests
            .AsNoTracking();

        if (normalizedStatus != "ALL")
        {
            query = query.Where(x =>
                x.Status == normalizedStatus);
        }

        if (normalizedKeyword.Length > 0)
        {
            query = query.Where(x =>
                x.OrderNumber.Contains(normalizedKeyword) ||
                x.ShopName.Contains(normalizedKeyword) ||
                x.User.FullName.Contains(normalizedKeyword) ||
                x.User.Email.Contains(normalizedKeyword));
        }

        var total = await query.CountAsync(
            cancellationToken);

        var totalPages = (int)Math.Ceiling(
            total / (double)limit);

        page = totalPages == 0
            ? 1
            : Math.Min(page, totalPages);

        var rows = await query
            .OrderByDescending(x => x.CreatedAt)
            .ThenByDescending(x => x.Id)
            .Skip((page - 1) * limit)
            .Take(limit)
            .Select(x => new
            {
                x.Id,
                x.OrderId,
                x.OrderNumber,
                x.ShopName,
                CustomerName = x.User.FullName,
                CustomerEmail = x.User.Email,
                x.Reason,
                x.RequestedAmount,
                x.ApprovedAmount,
                x.Status,
                x.CreatedAt,
                x.ResolvedAt
            })
            .ToListAsync(cancellationToken);

        var items = rows
            .Select(x => new AdminRefundListItemDto(
                x.Id,
                x.OrderId,
                x.OrderNumber,
                x.ShopName,
                x.CustomerName,
                x.CustomerEmail,
                x.Reason,
                x.RequestedAmount,
                x.ApprovedAmount,
                x.Status,
                AsUtc(x.CreatedAt),
                x.ResolvedAt is DateTime resolvedAt
                    ? AsUtc(resolvedAt)
                    : null))
            .ToArray();

        return new AdminRefundPageDto(
            items,
            total,
            page,
            limit,
            totalPages);
    }

    public async Task<AdminRefundDetailDto> GetDetailAsync(
        Guid actorUserId,
        Guid refundId,
        CancellationToken cancellationToken)
    {
        await EnsureAdminAsync(
            actorUserId,
            cancellationToken);

        // Dùng lại DTO và kiểm tra quyền đọc của UC17.
        var refund = await refundService.GetAsync(
            actorUserId,
            refundId,
            cancellationToken);

        var information = await db.RefundRequests
            .AsNoTracking()
            .Where(x => x.Id == refundId)
            .Select(x => new
            {
                CustomerName = x.User.FullName,
                CustomerEmail = x.User.Email,
                OrderStatus = x.Order.Status,
                PaymentStatus = x.Order.PaymentStatus,
                OrderTotal = x.Order.TotalAmount
            })
            .SingleAsync(cancellationToken);

        var original = await db.Payments
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x =>
                    x.OrderId == refund.OrderId &&
                    x.Status == "SUCCESS",
                cancellationToken);

        var refunded = await db.RefundPayments
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.RefundRequestId == refundId,
                cancellationToken);

        var history = await GetHistoryAsync(
            refundId,
            cancellationToken);

        return new AdminRefundDetailDto(
            refund,
            information.CustomerName,
            information.CustomerEmail,
            information.OrderStatus,
            information.PaymentStatus,
            information.OrderTotal,

            original is null
                ? null
                : new OriginalRefundPaymentDto(
                    original.Id,
                    original.Provider,
                    original.Status,
                    original.Amount,
                    original.TransactionReference,
                    AsUtc(original.CreatedAt)),

            refunded is null
                ? null
                : new MockRefundPaymentDto(
                    refunded.Id,
                    refunded.Provider,
                    refunded.Status,
                    refunded.Amount,
                    refunded.TransactionReference,
                    AsUtc(refunded.CreatedAt)),

            history);
    }

    public Task<AdminRefundDetailDto> ApproveAsync(
        Guid actorUserId,
        Guid refundId,
        ReviewRefundInput input,
        CancellationToken cancellationToken)
    {
        return ReviewAsync(
            actorUserId,
            refundId,
            input,
            approve: true,
            cancellationToken: cancellationToken);
    }

    public Task<AdminRefundDetailDto> RejectAsync(
        Guid actorUserId,
        Guid refundId,
        ReviewRefundInput input,
        CancellationToken cancellationToken)
    {
        return ReviewAsync(
            actorUserId,
            refundId,
            input,
            approve: false,
            cancellationToken: cancellationToken);
    }

    private async Task<AdminRefundDetailDto> ReviewAsync(
        Guid actorUserId,
        Guid refundId,
        ReviewRefundInput input,
        bool approve,
        CancellationToken cancellationToken)
    {
        await EnsureAdminAsync(
            actorUserId,
            cancellationToken);

        var note = input.Note?.Trim() ?? "";

        if (note.Length is < 10 or > 2000)
        {
            throw new AdminRefundFailure(
                400,
                "INVALID_RESOLUTION_NOTE",
                "Lý do xử lý phải từ 10 đến 2000 ký tự.");
        }

        if (
            approve &&
            (
                input.ApprovedAmount is not decimal validatedAmount ||
                validatedAmount <= 0 ||
                decimal.Round(validatedAmount, 2) != validatedAmount
            ))
        {
            throw new AdminRefundFailure(
                400,
                "INVALID_APPROVED_AMOUNT",
                "Số tiền duyệt phải lớn hơn 0 và tối đa 2 chữ số thập phân.");
        }

        if (!approve && input.ApprovedAmount is not null)
        {
            throw new AdminRefundFailure(
                400,
                "UNEXPECTED_APPROVED_AMOUNT",
                "Không gửi số tiền duyệt khi từ chối yêu cầu.");
        }

        var orderId = await db.RefundRequests
            .AsNoTracking()
            .Where(x => x.Id == refundId)
            .Select(x => (Guid?)x.OrderId)
            .SingleOrDefaultAsync(cancellationToken);

        if (orderId is null)
        {
            throw new AdminRefundFailure(
                404,
                "REFUND_NOT_FOUND",
                "Không tìm thấy yêu cầu hoàn tiền.");
        }

        await using var transaction =
            await db.Database.BeginTransactionAsync(
                cancellationToken);

        // Dùng cùng thứ tự khóa với UC17:
        // khóa đơn trước, sau đó đọc yêu cầu hoàn tiền.
        var order = await db.Orders
            .FromSqlInterpolated(
                $"""
                SELECT *
                FROM [orders] WITH (UPDLOCK, ROWLOCK)
                WHERE [id] = {orderId.Value}
                """)
            .AsNoTracking()
            .SingleOrDefaultAsync(cancellationToken);

        if (order is null)
        {
            throw new AdminRefundFailure(
                404,
                "ORDER_NOT_FOUND",
                "Không tìm thấy đơn hàng.");
        }

        var request = await db.RefundRequests
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.Id == refundId,
                cancellationToken);

        if (request is null)
        {
            throw new AdminRefundFailure(
                404,
                "REFUND_NOT_FOUND",
                "Không tìm thấy yêu cầu hoàn tiền.");
        }

        // Retry sau khi response bị mất:
        // trả kết quả đã lưu nếu nội dung xử lý giống nhau.
        if (request.Status != "PENDING")
        {
            var sameDecision =
                request.ResolutionNote == note &&
                (
                    approve
                        ? request.Status == "REFUNDED" &&
                          request.ApprovedAmount ==
                              input.ApprovedAmount
                        : request.Status == "REJECTED"
                );

            if (!sameDecision)
            {
                throw new AdminRefundFailure(
                    409,
                    "REFUND_ALREADY_HANDLED",
                    "Yêu cầu đã được xử lý với kết quả khác. Vui lòng làm mới.");
            }

            if (
                approve &&
                !await db.RefundPayments.AnyAsync(
                    x =>
                        x.RefundRequestId == refundId &&
                        x.Status == "SUCCESS",
                    cancellationToken))
            {
                throw new AdminRefundFailure(
                    409,
                    "REFUND_PAYMENT_MISSING",
                    "Chưa tìm thấy giao dịch hoàn tiền tương ứng.");
            }

            var existing = await GetDetailAsync(
                actorUserId,
                refundId,
                cancellationToken);

            await transaction.CommitAsync(
                cancellationToken);

            return existing;
        }

        if (
            order.Status != "REFUND_REQUESTED" ||
            order.PaymentStatus != "PAID")
        {
            throw new AdminRefundFailure(
                409,
                "ORDER_NOT_ELIGIBLE",
                "Trạng thái đơn không phù hợp để xử lý yêu cầu này.");
        }

        var alreadyRefunded = await db.RefundPayments
            .AsNoTracking()
            .AnyAsync(
                x =>
                    x.OrderId == order.Id &&
                    x.Status == "SUCCESS",
                cancellationToken);

        if (alreadyRefunded)
        {
            throw new AdminRefundFailure(
                409,
                "ORDER_ALREADY_REFUNDED",
                "Đơn đã có giao dịch hoàn tiền thành công.");
        }

        var now = DateTime.UtcNow;

        decimal? approvedAmount = null;

        var nextRefundStatus = "REJECTED";
        var nextOrderStatus = "COMPLETED";
        var nextPaymentStatus = "PAID";

        RefundPayment? refundPayment = null;

        if (approve)
        {
            var payment = await db.Payments
                .AsNoTracking()
                .SingleOrDefaultAsync(
                    x =>
                        x.OrderId == order.Id &&
                        x.Status == "SUCCESS",
                    cancellationToken);

            if (payment is null)
            {
                throw new AdminRefundFailure(
                    409,
                    "SUCCESSFUL_PAYMENT_NOT_FOUND",
                    "Không tìm thấy giao dịch thanh toán thành công.");
            }

            // Chỉ mô phỏng hoàn tiền cho giao dịch MOCK.
            // Không giả lập thành công cho cổng thanh toán thật.
            if (payment.Provider != "MOCK")
            {
                throw new AdminRefundFailure(
                    409,
                    "PAYMENT_PROVIDER_NOT_SUPPORTED",
                    "Cổng thanh toán này chưa hỗ trợ hoàn tiền trong phiên bản hiện tại.");
            }

            var amount = input.ApprovedAmount!.Value;

            var maximum = Math.Min(
                request.RequestedAmount,
                Math.Min(
                    order.TotalAmount,
                    payment.Amount));

            if (amount > maximum)
            {
                throw new AdminRefundFailure(
                    400,
                    "APPROVED_AMOUNT_EXCEEDS_LIMIT",
                    "Số tiền duyệt không được vượt số tiền khách yêu cầu hoặc số tiền đã thanh toán.");
            }

            approvedAmount = amount;

            nextRefundStatus = "REFUNDED";
            nextOrderStatus = "REFUNDED";

            // Chỉ đánh dấu thanh toán đã hoàn toàn bộ
            // khi số tiền hoàn bằng giao dịch thanh toán gốc.
            nextPaymentStatus = amount == payment.Amount
                ? "REFUNDED"
                : "PAID";

            refundPayment = new RefundPayment
            {
                RefundRequestId = request.Id,
                OrderId = order.Id,
                PaymentId = payment.Id,
                Provider = "MOCK",
                Status = "SUCCESS",
                Amount = amount,

                TransactionReference =
                    $"MOCK-REFUND-{Guid.NewGuid():N}",

                CreatedAt = now
            };

            db.RefundPayments.Add(refundPayment);
        }

        var changedOrder = await db.Orders
            .Where(x =>
                x.Id == order.Id &&
                x.Status == "REFUND_REQUESTED" &&
                x.PaymentStatus == "PAID")
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(
                        x => x.Status,
                        nextOrderStatus)
                    .SetProperty(
                        x => x.PaymentStatus,
                        nextPaymentStatus)
                    .SetProperty(
                        x => x.UpdatedAt,
                        now),
                cancellationToken);

        if (changedOrder != 1)
        {
            throw new AdminRefundFailure(
                409,
                "ORDER_CHANGED",
                "Đơn hàng vừa thay đổi. Vui lòng làm mới.");
        }

        var changedRequest = await db.RefundRequests
            .Where(x =>
                x.Id == refundId &&
                x.Status == "PENDING")
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(
                        x => x.Status,
                        nextRefundStatus)
                    .SetProperty(
                        x => x.ApprovedAmount,
                        approvedAmount)
                    .SetProperty(
                        x => x.ResolutionNote,
                        note)
                    .SetProperty(
                        x => x.HandledByUserId,
                        (Guid?)actorUserId)
                    .SetProperty(
                        x => x.ResolvedAt,
                        (DateTime?)now),
                cancellationToken);

        if (changedRequest != 1)
        {
            throw new AdminRefundFailure(
                409,
                "REFUND_CHANGED",
                "Yêu cầu vừa được xử lý. Vui lòng làm mới.");
        }

        db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = actorUserId,

            Action = approve
                ? "REFUND_APPROVED"
                : "REFUND_REJECTED",

            TargetType = "RefundRequest",
            TargetId = refundId,

            OldValuesJson = JsonSerializer.Serialize(new
            {
                status = request.Status,
                approvedAmount = request.ApprovedAmount,
                orderStatus = order.Status,
                paymentStatus = order.PaymentStatus
            }),

            NewValuesJson = JsonSerializer.Serialize(new
            {
                status = nextRefundStatus,
                approvedAmount,
                note,
                orderStatus = nextOrderStatus,
                paymentStatus = nextPaymentStatus,
                refundPaymentId = refundPayment?.Id,
                transactionReference =
                    refundPayment?.TransactionReference
            }),

            CreatedAt = now
        });

        await db.SaveChangesAsync(
            cancellationToken);

        var result = await GetDetailAsync(
            actorUserId,
            refundId,
            cancellationToken);

        await transaction.CommitAsync(
            cancellationToken);

        return result;
    }

    private async Task<IReadOnlyList<RefundReviewHistoryDto>>
        GetHistoryAsync(
            Guid refundId,
            CancellationToken cancellationToken)
    {
        var rows = await db.AuditLogs
            .AsNoTracking()
            .Where(x =>
                x.TargetType == "RefundRequest" &&
                x.TargetId == refundId)
            .OrderByDescending(x => x.CreatedAt)
            .ThenByDescending(x => x.Id)
            .Take(50)
            .Select(x => new
            {
                x.Id,
                x.Action,
                ActorName = x.ActorUser.FullName,
                x.NewValuesJson,
                x.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return rows
            .Select(x => new RefundReviewHistoryDto(
                x.Id,
                x.Action,
                x.ActorName,
                ReadNote(x.NewValuesJson),
                AsUtc(x.CreatedAt)))
            .ToArray();
    }

    private static string ReadNote(string json)
    {
        try
        {
            using var document = JsonDocument.Parse(json);

            if (
                document.RootElement.ValueKind ==
                    JsonValueKind.Object &&
                document.RootElement.TryGetProperty(
                    "note",
                    out var note) &&
                note.ValueKind == JsonValueKind.String)
            {
                return note.GetString() ?? "";
            }
        }
        catch (JsonException)
        {
            // Vẫn hiển thị thao tác và thời gian.
        }

        return "";
    }
}