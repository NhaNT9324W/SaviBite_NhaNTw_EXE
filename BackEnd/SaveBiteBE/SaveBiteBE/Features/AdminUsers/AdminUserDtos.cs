using System.ComponentModel.DataAnnotations;

namespace SaveBiteBE.Features.AdminUsers;

public sealed class ChangeUserStatusRequest
{
    [Required]
    [StringLength(1000, MinimumLength = 10)]
    public string Reason { get; set; } = string.Empty;
}

public sealed record AdminUserDto(
    Guid Id,
    string FullName,
    string Email,
    string Phone,
    string? AvatarUrl,
    string SystemRole,
    string Status,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    bool IsCurrentUser,
    bool CanLock,
    bool CanUnlock);

public sealed record AdminUserPageDto(
    IReadOnlyList<AdminUserDto> Items,
    int Total,
    int Page,
    int Limit,
    int TotalPages);

public sealed record UserStatusHistoryDto(
    Guid Id,
    string Action,
    string ActorName,
    string Reason,
    DateTime CreatedAt);

public sealed record AdminUserDetailDto(
    AdminUserDto User,
    IReadOnlyList<UserStatusHistoryDto> History);

public sealed class AdminUserFailure : Exception
{
    public int Status { get; }

    public string Code { get; }

    public AdminUserFailure(
        int status,
        string code,
        string message)
        : base(message)
    {
        Status = status;
        Code = code;
    }
}