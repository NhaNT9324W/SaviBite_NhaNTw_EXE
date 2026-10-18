namespace SaveBiteBE.Shared;

/// <summary>
/// Nội dung lỗi được phép trả về cho Frontend.
/// </summary>
public sealed record ApiError(
    string Code,
    string Message);

/// <summary>
/// Cấu trúc response thống nhất của API.
/// </summary>
public sealed record ApiResponse(
    bool Success,
    object? Data,
    ApiError? Error)
{
    public static ApiResponse Ok(object data)
    {
        return new ApiResponse(true, data, null);
    }

    public static ApiResponse Fail(
        string code,
        string message)
    {
        return new ApiResponse(
            false,
            null,
            new ApiError(code, message));
    }
}