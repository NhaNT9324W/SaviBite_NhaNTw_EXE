using System.ComponentModel.DataAnnotations;

namespace SaveBiteBE.Features.Shops;

public class AddShopMemberRequest
{
    [Required(
        ErrorMessage = "Vui lòng nhập email nhân viên."
    )]
    [EmailAddress(
        ErrorMessage = "Email không hợp lệ."
    )]
    [StringLength(
        254,
        ErrorMessage = "Email tối đa 254 ký tự."
    )]
    public string Email { get; set; } = string.Empty;
}

public class UpdateShopMemberRequest
{
    [Required(
        ErrorMessage = "Vui lòng chọn trạng thái."
    )]
    [RegularExpression(
        "^(ACTIVE|LOCKED)$",
        ErrorMessage = "Trạng thái phải là ACTIVE hoặc LOCKED."
    )]
    public string Status { get; set; } = string.Empty;
}

public record ShopMemberDto(
    Guid Id,
    Guid ShopId,
    Guid UserId,
    string FullName,
    string Email,
    string Phone,
    string MemberRole,
    string Status,
    string UserStatus,
    string UserSystemRole,
    DateTime JoinedAt,
    bool IsCurrentUser
);

public record ShopMemberPageDto(
    List<ShopMemberDto> Items,
    int Total,
    int Page,
    int Limit,
    int TotalPages
);

public record DeletedShopMemberDto(
    Guid Id,
    bool Deleted
);