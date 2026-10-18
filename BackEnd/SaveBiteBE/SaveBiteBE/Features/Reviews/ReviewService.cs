using Microsoft.EntityFrameworkCore;
using SaveBiteBE.Data;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Features.Reviews;

public sealed class ReviewService
{
    private readonly SaviBiteDbContext _db;

    public ReviewService(SaviBiteDbContext db)
    {
        _db = db;
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
            throw new ReviewOperationFailure(
                401,
                "INVALID_SESSION",
                "Phiên đăng nhập không hợp lệ.");
        }

        if (user.Status != "ACTIVE")
        {
            throw new ReviewOperationFailure(
                403,
                "ACCOUNT_INACTIVE",
                "Tài khoản đã bị khóa hoặc ngừng hoạt động.");
        }

        return user;
    }

    private static void ValidatePagination(
        int page,
        int limit)
    {
        if (page < 1 || limit < 1 || limit > 50)
        {
            throw new ReviewOperationFailure(
                400,
                "INVALID_PAGINATION",
                "Trang phải từ 1; số mục mỗi trang từ 1 đến 50.");
        }
    }

    private static DateTime AsUtc(DateTime value)
    {
        return DateTime.SpecifyKind(
            value,
            DateTimeKind.Utc);
    }

    private static ReviewDto MapDto(Review review)
    {
        return new ReviewDto(
            review.Id,
            review.OrderId,
            review.ShopId,
            review.Rating,
            review.Comment,
            review.ReviewerName,
            AsUtc(review.CreatedAt));
    }

    public async Task<OrderReviewStateDto> GetOrderStateAsync(
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
            throw new ReviewOperationFailure(
                404,
                "ORDER_NOT_FOUND",
                "Không tìm thấy đơn hàng của bạn.");
        }

        var review = await _db.Reviews
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.OrderId == orderId,
                cancellationToken);

        var canReview =
            order.Status == "COMPLETED" &&
            review is null;

        var message = review is not null
            ? "Bạn đã đánh giá đơn hàng này."
            : order.Status != "COMPLETED"
                ? "Chỉ được đánh giá sau khi nhận hàng và đơn đã hoàn thành."
                : "Bạn có thể đánh giá đơn hàng.";

        return new OrderReviewStateDto(
            order.Id,
            order.OrderNumber,
            order.ShopName,
            order.Status,
            canReview,
            message,
            review is null ? null : MapDto(review));
    }

    public async Task<ReviewDto> CreateAsync(
        Guid userId,
        Guid orderId,
        CreateReviewRequest request,
        CancellationToken cancellationToken)
    {
        var user = await GetActiveUserAsync(
            userId,
            cancellationToken);

        var comment =
            (request.Comment ?? string.Empty).Trim();

        await using var transaction =
            await _db.Database.BeginTransactionAsync(
                cancellationToken);

        // Khóa đơn để hai request không tạo hai đánh giá.
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
            throw new ReviewOperationFailure(
                404,
                "ORDER_NOT_FOUND",
                "Không tìm thấy đơn hàng của bạn.");
        }

        var existing = await _db.Reviews
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.OrderId == orderId,
                cancellationToken);

        if (existing is not null)
        {
            // Retry đúng nội dung trả đánh giá đã tạo.
            if (
                existing.Rating == request.Rating &&
                existing.Comment == comment)
            {
                await transaction.CommitAsync(
                    cancellationToken);

                return MapDto(existing);
            }

            throw new ReviewOperationFailure(
                409,
                "REVIEW_ALREADY_EXISTS",
                "Đơn hàng đã được đánh giá. Mỗi đơn chỉ được đánh giá một lần.");
        }

        if (order.Status != "COMPLETED")
        {
            throw new ReviewOperationFailure(
                409,
                "ORDER_NOT_COMPLETED",
                "Chỉ được đánh giá sau khi nhận hàng và đơn đã hoàn thành.");
        }

        // Khóa cửa hàng để cập nhật điểm trung bình nhất quán
        // khi nhiều khách đánh giá các đơn khác nhau cùng lúc.
        var shop = await _db.Shops
            .FromSqlInterpolated(
                $"""
                SELECT *
                FROM [shops] WITH (UPDLOCK, ROWLOCK)
                WHERE [id] = {order.ShopId}
                """)
            .AsNoTracking()
            .SingleOrDefaultAsync(cancellationToken);

        if (shop is null || shop.DeletedAt is not null)
        {
            throw new ReviewOperationFailure(
                404,
                "SHOP_NOT_FOUND",
                "Không tìm thấy cửa hàng.");
        }

        var now = DateTime.UtcNow;

        var review = new Review
        {
            Id = Guid.NewGuid(),
            OrderId = order.Id,
            ShopId = order.ShopId,
            UserId = userId,

            Rating = request.Rating,
            Comment = comment,

            ReviewerName = user.FullName,

            Status = "ACTIVE",
            CreatedAt = now
        };

        _db.Reviews.Add(review);

        await _db.SaveChangesAsync(
            cancellationToken);

        // Tham số được truyền bằng ExecuteSqlInterpolatedAsync.
        // Điểm trung bình lấy từ những đánh giá đang hiển thị.
        await _db.Database.ExecuteSqlInterpolatedAsync(
            $"""
            UPDATE [shops]
            SET [average_rating] = (
                SELECT CAST(
                    COALESCE(
                        AVG(CAST([rating] AS decimal(10, 4))),
                        0
                    )
                    AS decimal(3, 2)
                )
                FROM [reviews]
                WHERE [shop_id] = {order.ShopId}
                  AND [status] = 'ACTIVE'
                  AND [deleted_at] IS NULL
            ),
            [updated_at] = {now}
            WHERE [id] = {order.ShopId}
            """,
            cancellationToken);

        await transaction.CommitAsync(
            cancellationToken);

        return MapDto(review);
    }

    public async Task<MyReviewOrderPageDto> GetMyOrdersAsync(
        Guid userId,
        int page,
        int limit,
        CancellationToken cancellationToken)
    {
        await GetActiveUserAsync(
            userId,
            cancellationToken);

        ValidatePagination(page, limit);

        var query = _db.Orders
            .AsNoTracking()
            .Where(x =>
                x.UserId == userId &&
                (
                    x.Status == "COMPLETED" ||
                    _db.Reviews.Any(
                        review => review.OrderId == x.Id)
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

        var orderIds = orders
            .Select(x => x.Id)
            .ToArray();

        var reviewedIds = await _db.Reviews
            .AsNoTracking()
            .Where(x => orderIds.Contains(x.OrderId))
            .Select(x => x.OrderId)
            .ToListAsync(cancellationToken);

        var reviewedSet = reviewedIds.ToHashSet();

        var items = orders.Select(x =>
            new MyReviewOrderDto(
                x.Id,
                x.OrderNumber,
                x.ShopName,
                x.Status,
                x.TotalAmount,
                AsUtc(x.CreatedAt),
                reviewedSet.Contains(x.Id)))
            .ToArray();

        return new MyReviewOrderPageDto(
            items,
            total,
            page,
            limit,
            totalPages);
    }

    public async Task<ShopReviewPageDto> GetShopReviewsAsync(
        Guid shopId,
        int page,
        int limit,
        CancellationToken cancellationToken)
    {
        ValidatePagination(page, limit);

        var isPublicShop = await _db.Shops
            .AsNoTracking()
            .AnyAsync(
                x => x.Id == shopId &&
                     x.DeletedAt == null &&
                     x.Status == "APPROVED",
                cancellationToken);

        if (!isPublicShop)
        {
            throw new ReviewOperationFailure(
                404,
                "SHOP_NOT_FOUND",
                "Cửa hàng không tồn tại hoặc chưa được công khai.");
        }

        var query = _db.Reviews
            .AsNoTracking()
            .Where(x =>
                x.ShopId == shopId &&
                x.Status == "ACTIVE" &&
                x.DeletedAt == null);

        var total = await query.CountAsync(
            cancellationToken);

        var average = await query
            .AverageAsync(
                x => (decimal?)x.Rating,
                cancellationToken) ?? 0m;

        var totalPages = (int)Math.Ceiling(
            total / (double)limit);

        page = totalPages == 0
            ? 1
            : Math.Min(page, totalPages);

        var reviews = await query
            .OrderByDescending(x => x.CreatedAt)
            .ThenByDescending(x => x.Id)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync(cancellationToken);

        var items = reviews.Select(x =>
            new PublicShopReviewDto(
                x.Id,
                x.ReviewerName,
                x.Rating,
                x.Comment,
                AsUtc(x.CreatedAt)))
            .ToArray();

        return new ShopReviewPageDto(
            items,
            decimal.Round(
                average,
                2,
                MidpointRounding.AwayFromZero),
            total,
            page,
            limit,
            totalPages);
    }
}