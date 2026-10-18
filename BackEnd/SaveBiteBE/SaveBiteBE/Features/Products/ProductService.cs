using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using SaveBiteBE.Data;
using SaveBiteBE.Entities;
using SaveBiteBE.Features.Shops;

namespace SaveBiteBE.Features.Products;

public class ProductService(
    SaviBiteDbContext db,
    ShopAccessService shopAccess,
    IWebHostEnvironment environment)
{
    private static ProductDto ToDto(Product product)
    {
        return new ProductDto(
            product.Id,
            product.ShopId,
            product.CategoryId,
            product.Category.Name,
            product.Name,
            product.Description,
            product.Ingredients,
            product.AllergyInfo,
            product.StorageInstruction,
            product.ImageUrl,
            product.OriginalPrice,
            product.Status,
            DateTime.SpecifyKind(
                product.CreatedAt,
                DateTimeKind.Utc
            ),
            DateTime.SpecifyKind(
                product.UpdatedAt,
                DateTimeKind.Utc
            )
        );
    }

    private async Task<Product> FindProductAsync(
        Guid shopId,
        Guid productId,
        CancellationToken cancellationToken)
    {
        var product = await db.Products
            .Include(x => x.Category)
            .SingleOrDefaultAsync(
                x =>
                    x.Id == productId &&
                    x.ShopId == shopId &&
                    x.DeletedAt == null,
                cancellationToken
            );

        return product
            ?? throw new ShopOperationFailure(
                404,
                "PRODUCT_NOT_FOUND",
                "Không tìm thấy sản phẩm trong cửa hàng này."
            );
    }

    private async Task<Category> FindCategoryAsync(
        Guid categoryId,
        CancellationToken cancellationToken)
    {
        var category = await db.Categories
            .SingleOrDefaultAsync(
                x =>
                    x.Id == categoryId &&
                    x.Status == "ACTIVE",
                cancellationToken
            );

        return category
            ?? throw new ShopOperationFailure(
                400,
                "INVALID_CATEGORY",
                "Danh mục không tồn tại hoặc đã ngừng hoạt động."
            );
    }

    private async Task EnsureCanDeactivateAsync(
    Guid productId,
    CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;

        var hasRelatedOffer = await db.Offers
            .AnyAsync(
                x =>
                    x.ProductId == productId &&
                    x.DeletedAt == null &&
                    (
                        x.Status == "DRAFT" ||
                        (
                            (
                                x.Status == "SCHEDULED" ||
                                x.Status == "ACTIVE" ||
                                x.Status == "SOLD_OUT" ||
                                x.Status == "ENDED"
                            ) &&
                            x.PickupEndAt > now
                        )
                    ),
                cancellationToken
            );

        if (hasRelatedOffer)
        {
            throw new ShopOperationFailure(
                409,
                "PRODUCT_IN_USE",
                "Sản phẩm đang gắn với ưu đãi nháp, " +
                "ưu đãi hẹn giờ hoặc ưu đãi chưa " +
                "kết thúc nhận hàng. Hãy xử lý ưu đãi " +
                "trước khi ngừng hoặc xóa sản phẩm."
            );
        }
    }

    private static void ApplyRequest(
        Product product,
        SaveProductRequest request,
        Category category)
    {
        product.CategoryId = category.Id;
        product.Category = category;

        product.Name = request.Name.Trim();
        product.Description =
            (request.Description ?? string.Empty).Trim();

        product.Ingredients =
            (request.Ingredients ?? string.Empty).Trim();

        product.AllergyInfo =
            (request.AllergyInfo ?? string.Empty).Trim();

        product.StorageInstruction =
            (request.StorageInstruction ?? string.Empty).Trim();

        product.OriginalPrice = request.OriginalPrice;
        product.Status = request.Status;
        product.UpdatedAt = DateTime.UtcNow;
    }

    public async Task<ProductPageDto> GetListAsync(
        Guid userId,
        Guid shopId,
        int page,
        int limit,
        CancellationToken cancellationToken)
    {
        await shopAccess.RequireAsync(
            userId,
            shopId,
            cancellationToken
        );

        if (page < 1 || page > 100000 || limit < 1 || limit > 50)
        {
            throw new ShopOperationFailure(
                400,
                "INVALID_PAGINATION",
                "Trang phải từ 1 đến 100000; " +
                "số sản phẩm mỗi trang phải từ 1 đến 50."
            );
        }

        var query = db.Products
            .AsNoTracking()
            .Where(x =>
                x.ShopId == shopId &&
                x.DeletedAt == null
            );

        var total = await query.CountAsync(
            cancellationToken
        );

        var products = await query
            .Include(x => x.Category)
            .OrderByDescending(x => x.CreatedAt)
            .ThenBy(x => x.Id)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync(cancellationToken);

        return new ProductPageDto(
            products.Select(ToDto).ToList(),
            total,
            page,
            limit,
            (int)Math.Ceiling(total / (double)limit)
        );
    }

    public async Task<ProductDto> GetAsync(
        Guid userId,
        Guid shopId,
        Guid productId,
        CancellationToken cancellationToken)
    {
        await shopAccess.RequireAsync(
            userId,
            shopId,
            cancellationToken
        );

        var product = await FindProductAsync(
            shopId,
            productId,
            cancellationToken
        );

        return ToDto(product);
    }

    public async Task<List<ProductCategoryDto>> GetCategoriesAsync(
        Guid userId,
        Guid shopId,
        CancellationToken cancellationToken)
    {
        await shopAccess.RequireAsync(
            userId,
            shopId,
            cancellationToken
        );

        return await db.Categories
            .AsNoTracking()
            .Where(x => x.Status == "ACTIVE")
            .OrderBy(x => x.Name)
            .ThenBy(x => x.Id)
            .Select(x => new ProductCategoryDto(
                x.Id,
                x.Name
            ))
            .ToListAsync(cancellationToken);
    }

    public async Task<ProductDto> CreateAsync(
        Guid userId,
        Guid shopId,
        SaveProductRequest request,
        CancellationToken cancellationToken)
    {
        await shopAccess.RequireAsync(
            userId,
            shopId,
            cancellationToken
        );

        var category = await FindCategoryAsync(
            request.CategoryId,
            cancellationToken
        );

        var product = new Product
        {
            ShopId = shopId
        };

        ApplyRequest(product, request, category);

        db.Products.Add(product);

        await db.SaveChangesAsync(cancellationToken);

        return ToDto(product);
    }

    public async Task<ProductDto> UpdateAsync(
        Guid userId,
        Guid shopId,
        Guid productId,
        SaveProductRequest request,
        CancellationToken cancellationToken)
    {
        await shopAccess.RequireAsync(
            userId,
            shopId,
            cancellationToken
        );

        var product = await FindProductAsync(
            shopId,
            productId,
            cancellationToken
        );

        var category = await FindCategoryAsync(
            request.CategoryId,
            cancellationToken
        );

        if (request.Status == "INACTIVE")
        {
            await EnsureCanDeactivateAsync(
                product.Id,
                cancellationToken
            );
        }

        ApplyRequest(product, request, category);

        await db.SaveChangesAsync(cancellationToken);

        return ToDto(product);
    }

    public async Task<DeletedProductDto> DeleteAsync(
        Guid userId,
        Guid shopId,
        Guid productId,
        CancellationToken cancellationToken)
    {
        await shopAccess.RequireAsync(
            userId,
            shopId,
            cancellationToken
        );

        var product = await FindProductAsync(
            shopId,
            productId,
            cancellationToken
        );

        await EnsureCanDeactivateAsync(
            product.Id,
            cancellationToken
        );

        var now = DateTime.UtcNow;

        product.DeletedAt = now;
        product.UpdatedAt = now;
        product.Status = "INACTIVE";

        await db.SaveChangesAsync(cancellationToken);

        return new DeletedProductDto(product.Id, true);
    }

    public async Task<ProductDto> UploadImageAsync(
        Guid userId,
        Guid shopId,
        Guid productId,
        IFormFile file,
        CancellationToken cancellationToken)
    {
        await shopAccess.RequireAsync(
            userId,
            shopId,
            cancellationToken
        );

        var product = await FindProductAsync(
            shopId,
            productId,
            cancellationToken
        );

        const int maxBytes = 2 * 1024 * 1024;

        if (file.Length == 0 || file.Length > maxBytes)
        {
            throw new ShopOperationFailure(
                400,
                "INVALID_IMAGE_SIZE",
                "Ảnh phải có dữ liệu và không vượt quá 2 MB."
            );
        }

        var contentType = file.ContentType.ToLowerInvariant();

        if (contentType != "image/jpeg" &&
            contentType != "image/png")
        {
            throw new ShopOperationFailure(
                400,
                "INVALID_IMAGE_TYPE",
                "Vui lòng chọn ảnh JPG hoặc PNG."
            );
        }

        using var buffer = new MemoryStream();

        await file.CopyToAsync(
            buffer,
            cancellationToken
        );

        var bytes = buffer.ToArray();

        if (bytes.Length == 0 || bytes.Length > maxBytes)
        {
            throw new ShopOperationFailure(
                400,
                "INVALID_IMAGE_SIZE",
                "Ảnh phải có dữ liệu và không vượt quá 2 MB."
            );
        }

        byte[] pngSignature =
        [
            137, 80, 78, 71, 13, 10, 26, 10
        ];

        var isPng =
            bytes.Length >= pngSignature.Length &&
            bytes.Take(pngSignature.Length)
                .SequenceEqual(pngSignature);

        var isJpeg =
            bytes.Length >= 3 &&
            bytes[0] == 0xFF &&
            bytes[1] == 0xD8 &&
            bytes[2] == 0xFF;

        var validSignature =
            contentType == "image/png"
                ? isPng
                : isJpeg;

        if (!validSignature)
        {
            throw new ShopOperationFailure(
                400,
                "INVALID_IMAGE_CONTENT",
                "Nội dung file không đúng định dạng JPG hoặc PNG."
            );
        }

        var extension = isPng ? ".png" : ".jpg";

        var directory = Path.Combine(
            environment.ContentRootPath,
            "wwwroot",
            "uploads",
            "products"
        );

        Directory.CreateDirectory(directory);

        // Không dùng tên file do người dùng gửi lên.
        var fileName = $"{Guid.NewGuid():N}{extension}";
        var filePath = Path.Combine(directory, fileName);

        try
        {
            await System.IO.File.WriteAllBytesAsync(
                filePath,
                bytes,
                cancellationToken
            );

            product.ImageUrl =
                $"/uploads/products/{fileName}";

            product.UpdatedAt = DateTime.UtcNow;

            await db.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            try
            {
                if (System.IO.File.Exists(filePath))
                {
                    System.IO.File.Delete(filePath);
                }
            }
            catch (IOException)
            {
                // Giữ nguyên lỗi ghi file/database ban đầu.
            }
            catch (UnauthorizedAccessException)
            {
                // Giữ nguyên lỗi ghi file/database ban đầu.
            }

            throw;
        }

        return ToDto(product);
    }
}