using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using SaveBiteBE.Data;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Features.Profile;

/// <summary>
/// UC03 - Xử lý hồ sơ và ảnh đại diện của người đang đăng nhập.
/// </summary>
public class ProfileService(
    SaviBiteDbContext db,
    IWebHostEnvironment environment,
    ILogger<ProfileService> logger)
{
    private const long MaxAvatarBytes = 2 * 1024 * 1024;

    private const string AvatarUrlPrefix = "/uploads/avatars/";

    private static ProfileDto MapProfile(User user)
    {
        return new ProfileDto(
            user.Id,
            user.FullName,
            user.Email,
            user.Phone,
            user.AvatarUrl,
            user.SystemRole,
            user.UpdatedAt
        );
    }

    private async Task<User> GetCurrentUserAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleOrDefaultAsync(
            x => x.Id == userId && x.DeletedAt == null,
            cancellationToken
        );

        if (user == null)
        {
            throw new ProfileFailure(
                401,
                "UNAUTHENTICATED",
                "Phiên đăng nhập không hợp lệ."
            );
        }

        if (user.Status != "ACTIVE")
        {
            throw new ProfileFailure(
                403,
                "ACCOUNT_DISABLED",
                "Tài khoản đã bị khóa hoặc ngừng hoạt động."
            );
        }

        return user;
    }

    /// <summary>
    /// UC03 - Xem hồ sơ cá nhân.
    /// </summary>
    public async Task<ProfileDto> GetAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var user = await GetCurrentUserAsync(
            userId,
            cancellationToken
        );

        return MapProfile(user);
    }

    /// <summary>
    /// UC03 - Cập nhật họ tên và số điện thoại.
    /// </summary>
    public async Task<ProfileDto> UpdateAsync(
        Guid userId,
        UpdateProfileRequest request,
        CancellationToken cancellationToken)
    {
        var fullName = request.FullName.Trim();
        var phone = request.Phone.Trim();

        if (fullName.Length is < 2 or > 100)
        {
            throw new ProfileFailure(
                400,
                "VALIDATION_ERROR",
                "Họ tên phải từ 2 đến 100 ký tự."
            );
        }

        var user = await GetCurrentUserAsync(
            userId,
            cancellationToken
        );

        var phoneExists = await db.Users.AnyAsync(
            x => x.Id != userId && x.Phone == phone,
            cancellationToken
        );

        if (phoneExists)
        {
            throw new ProfileFailure(
                409,
                "PHONE_ALREADY_EXISTS",
                "Số điện thoại đã được sử dụng."
            );
        }

        user.FullName = fullName;
        user.Phone = phone;
        user.UpdatedAt = DateTime.UtcNow;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception)
            when (
                exception.InnerException is SqlException sql &&
                sql.Number is 2601 or 2627
            )
        {
            // Unique index tiếp tục bảo vệ khi có request đồng thời.
            throw new ProfileFailure(
                409,
                "PHONE_ALREADY_EXISTS",
                "Số điện thoại đã được sử dụng."
            );
        }

        return MapProfile(user);
    }

    /// <summary>
    /// UC03 - Kiểm tra và lưu ảnh đại diện.
    /// Database chỉ lưu đường dẫn tương đối.
    /// </summary>
    public async Task<ProfileDto> UploadAvatarAsync(
        Guid userId,
        IFormFile file,
        CancellationToken cancellationToken)
    {
        var user = await GetCurrentUserAsync(
            userId,
            cancellationToken
        );

        if (file.Length <= 0 || file.Length > MaxAvatarBytes)
        {
            throw new ProfileFailure(
                400,
                "INVALID_AVATAR_SIZE",
                "Ảnh đại diện phải có dung lượng lớn hơn 0 và không quá 2 MB."
            );
        }

        var contentType = file.ContentType.ToLowerInvariant();

        if (contentType is not ("image/jpeg" or "image/png"))
        {
            throw new ProfileFailure(
                400,
                "INVALID_AVATAR_TYPE",
                "Chỉ chấp nhận ảnh JPG hoặc PNG."
            );
        }

        await using var buffer = new MemoryStream();

        await file.CopyToAsync(buffer, cancellationToken);

        var bytes = buffer.ToArray();

        if (bytes.Length == 0 || bytes.Length > MaxAvatarBytes)
        {
            throw new ProfileFailure(
                400,
                "INVALID_AVATAR_SIZE",
                "Ảnh đại diện không được vượt quá 2 MB."
            );
        }

        var isPng =
            bytes.Length >= 8 &&
            bytes[0] == 0x89 &&
            bytes[1] == 0x50 &&
            bytes[2] == 0x4E &&
            bytes[3] == 0x47 &&
            bytes[4] == 0x0D &&
            bytes[5] == 0x0A &&
            bytes[6] == 0x1A &&
            bytes[7] == 0x0A;

        var isJpeg =
            bytes.Length >= 3 &&
            bytes[0] == 0xFF &&
            bytes[1] == 0xD8 &&
            bytes[2] == 0xFF;

        if (
            (contentType == "image/png" && !isPng) ||
            (contentType == "image/jpeg" && !isJpeg)
        )
        {
            throw new ProfileFailure(
                400,
                "INVALID_AVATAR_CONTENT",
                "Nội dung file không đúng định dạng ảnh JPG hoặc PNG."
            );
        }

        var extension = isPng ? ".png" : ".jpg";

        // Tên do BE sinh, không sử dụng tên file do client gửi.
        var fileName = $"{Guid.NewGuid():N}{extension}";

        var directory = Path.Combine(
            environment.ContentRootPath,
            "wwwroot",
            "uploads",
            "avatars"
        );

        Directory.CreateDirectory(directory);

        var filePath = Path.Combine(directory, fileName);
        var oldAvatarUrl = user.AvatarUrl;

        try
        {
            await File.WriteAllBytesAsync(
                filePath,
                bytes,
                cancellationToken
            );

            user.AvatarUrl = AvatarUrlPrefix + fileName;
            user.UpdatedAt = DateTime.UtcNow;

            await db.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            DeleteManagedAvatar(
                AvatarUrlPrefix + fileName,
                directory
            );

            throw;
        }

        DeleteManagedAvatar(oldAvatarUrl, directory);

        return MapProfile(user);
    }

    private void DeleteManagedAvatar(
        string? avatarUrl,
        string directory)
    {
        if (
            string.IsNullOrWhiteSpace(avatarUrl) ||
            !avatarUrl.StartsWith(
                AvatarUrlPrefix,
                StringComparison.Ordinal
            )
        )
        {
            return;
        }

        var fileName = avatarUrl[AvatarUrlPrefix.Length..];

        if (fileName != Path.GetFileName(fileName))
        {
            return;
        }

        var extension = Path.GetExtension(fileName);
        var name = Path.GetFileNameWithoutExtension(fileName);

        if (
            extension is not (".jpg" or ".png") ||
            !Guid.TryParseExact(name, "N", out _)
        )
        {
            return;
        }

        try
        {
            File.Delete(Path.Combine(directory, fileName));
        }
        catch (IOException exception)
        {
            logger.LogWarning(
                exception,
                "Không xóa được ảnh đại diện cũ."
            );
        }
        catch (UnauthorizedAccessException exception)
        {
            logger.LogWarning(
                exception,
                "Không có quyền xóa ảnh đại diện cũ."
            );
        }
    }
}