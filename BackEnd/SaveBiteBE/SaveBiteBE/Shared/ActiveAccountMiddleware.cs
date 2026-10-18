using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using SaveBiteBE.Data;

namespace SaveBiteBE.Shared;

public sealed class ActiveAccountMiddleware(
    RequestDelegate next)
{
    public async Task InvokeAsync(
        HttpContext context,
        SaviBiteDbContext db)
    {
        if (context.User.Identity?.IsAuthenticated != true)
        {
            await next(context);
            return;
        }

        var value =
            context.User.FindFirstValue("sub") ??
            context.User.FindFirstValue(
                ClaimTypes.NameIdentifier);

        if (
            !Guid.TryParse(value, out var userId) ||
            userId == Guid.Empty)
        {
            await WriteFailureAsync(
                context,
                StatusCodes.Status401Unauthorized,
                "INVALID_SESSION",
                "Phiên đăng nhập không hợp lệ.");

            return;
        }

        var account = await db.Users
            .AsNoTracking()
            .Where(user => user.Id == userId)
            .Select(user => new
            {
                user.Status,
                user.DeletedAt
            })
            .SingleOrDefaultAsync(
                context.RequestAborted);

        if (account is null || account.DeletedAt != null)
        {
            await WriteFailureAsync(
                context,
                StatusCodes.Status401Unauthorized,
                "INVALID_SESSION",
                "Phiên đăng nhập không hợp lệ.");

            return;
        }

        if (account.Status != "ACTIVE")
        {
            await WriteFailureAsync(
                context,
                StatusCodes.Status403Forbidden,
                "ACCOUNT_INACTIVE",
                "Tài khoản đã bị khóa hoặc ngừng hoạt động.");

            return;
        }

        await next(context);
    }

    private static Task WriteFailureAsync(
        HttpContext context,
        int status,
        string code,
        string message)
    {
        context.Response.StatusCode = status;

        return context.Response.WriteAsJsonAsync(
            ApiResponse.Fail(code, message),
            cancellationToken: context.RequestAborted);
    }
}