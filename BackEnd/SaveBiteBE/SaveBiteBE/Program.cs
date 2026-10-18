
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using SaveBiteBE.Data;
using SaveBiteBE.Entities;
using SaveBiteBE.Features.AdminRefunds;
using SaveBiteBE.Features.AdminShops;
using SaveBiteBE.Features.AdminUsers;
using SaveBiteBE.Features.Auth;
using SaveBiteBE.Features.Offers;
using SaveBiteBE.Features.Orders;
using SaveBiteBE.Features.Payments;
using SaveBiteBE.Features.Pickups;
using SaveBiteBE.Features.Products;
using SaveBiteBE.Features.Profile;
using SaveBiteBE.Features.Refunds;
using SaveBiteBE.Features.Reviews;
using SaveBiteBE.Features.Shops;
using SaveBiteBE.Shared;
using System.Text;



//PS D:\EXE_SaveBite\BackEnd\SaveBiteBE\SaveBiteBE> $env:ASPNETCORE_ENVIRONMENT = "Development"
//>> $env: SAVIBITE_RUN_SEED = "true"
//>> $env: SAVIBITE_RUN_HOME_SEED_V2 = "false"
//>>
//>> $env: SAVIBITE_SEED_PASSWORD = Read - Host "Nhap mat khau (toi thieu 12 ky tu)"
//>>
//>> dotnet run--no - build
//Nhap mat khau (toi thieu 12 ky tu): Savebite123456789


var builder = WebApplication.CreateBuilder(args);

#region 01 - CONTROLLERS VÀ VALIDATION

builder.Services.AddControllers();

builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var messages = context.ModelState.Values
            .SelectMany(value => value.Errors)
            .Select(error =>
                string.IsNullOrWhiteSpace(error.ErrorMessage)
                    ? "Dữ liệu gửi lên không hợp lệ."
                    : error.ErrorMessage)
            .Distinct();

        return new BadRequestObjectResult(
            ApiResponse.Fail(
                "VALIDATION_ERROR",
                string.Join(" ", messages)
            )
        );
    };
});

#endregion

#region 02 - SWAGGER

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

#endregion

#region 03 - DATABASE VÀ ENTITY FRAMEWORK CORE

var connectionString = builder.Configuration
    .GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException(
        "Chưa cấu hình ConnectionStrings:DefaultConnection."
    );

builder.Services.AddDbContext<SaviBiteDbContext>(options =>
{
    options.UseSqlServer(connectionString);
});

#endregion

#region 04 - AUTHENTICATION VÀ TÀI KHOẢN

builder.Services.AddScoped<
    IPasswordHasher<User>,
    PasswordHasher<User>
>();

builder.Services.AddScoped<AuthService>();

builder.Services.AddLoginFeature(builder.Configuration);

builder.Services.AddScoped<ProfileService>();

#endregion

#region 05 - CỬA HÀNG VÀ SẢN PHẨM

builder.Services.AddScoped<ShopAccessService>();
builder.Services.AddScoped<ShopMemberService>();
builder.Services.AddScoped<AdminShopService>();

builder.Services.AddScoped<ProductService>();
builder.Services.AddScoped<SaviBiteBoxService>();

#endregion

#region 06 - FLASH SALE VÀ ƯU ĐÃI

builder.Services.AddScoped<OfferService>();
builder.Services.AddScoped<OfferDetailService>();
builder.Services.AddScoped<FlashSaleService>();

builder.Services.AddHostedService<FlashSaleLifecycleWorker>();

#endregion

#region 07 - ĐƠN HÀNG VÀ THANH TOÁN

builder.Services.AddScoped<OrderService>();
builder.Services.AddScoped<ShopOrderService>();

builder.Services.AddHostedService<OrderExpiryWorker>();

builder.Services.AddScoped<PaymentService>();
builder.Services.AddScoped<PickupService>();

#endregion

#region 08 - ĐÁNH GIÁ VÀ HOÀN TIỀN

builder.Services.AddScoped<ReviewService>();

builder.Services
    .AddOptions<RefundPolicyOptions>()
    .Bind(builder.Configuration.GetSection("RefundPolicy"))
    .Validate(
        options => options.WindowHours is >= 1 and <= 168,
        "RefundPolicy:WindowHours phải từ 1 đến 168."
    )
    .ValidateOnStart();

builder.Services.AddScoped<RefundService>();

#endregion

#region 09 - QUẢN TRỊ HỆ THỐNG

builder.Services.AddScoped<AdminUserService>();
builder.Services.AddScoped<AdminRefundService>();

#endregion

#region 10 - CORS

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy
            .AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

#endregion

// ======================================================
// BUILD APPLICATION
// ======================================================

var app = builder.Build();

#region 11 - DEVELOPMENT DATASET V4 CONFIGURATION

// ======================================================
// SAVIBITE DEVELOPMENT DATASET V4
//
// Chỉ sử dụng DevelopmentDataSeeder.cs.
//
// Bật Seeder bằng:
// SAVIBITE_RUN_SEED=true
//
// Mật khẩu tài khoản mẫu:
// SAVIBITE_SEED_PASSWORD
//
// Không tự Seed khi khởi động bình thường.
// Không sử dụng trên Production.
// ======================================================

bool runDevelopmentSeeder = string.Equals(
    Environment.GetEnvironmentVariable(
        "SAVIBITE_RUN_SEED"),
    "true",
    StringComparison.OrdinalIgnoreCase
);

if (runDevelopmentSeeder &&
    !app.Environment.IsDevelopment())
{
    throw new InvalidOperationException(
        "Không được chạy Development Seeder V4 " +
        "ngoài môi trường Development."
    );
}

#endregion

#region 12 - DEVELOPMENT DATABASE SEEDER V4

if (runDevelopmentSeeder)
{
    // ==========================================
    // 01 - KIỂM TRA MẬT KHẨU
    // ==========================================

    string? seedPassword =
        Environment.GetEnvironmentVariable(
            "SAVIBITE_SEED_PASSWORD"
        );

    if (string.IsNullOrWhiteSpace(seedPassword) ||
        seedPassword.Length < 12)
    {
        throw new InvalidOperationException(
            "Thiếu SAVIBITE_SEED_PASSWORD " +
            "hoặc mật khẩu dưới 12 ký tự."
        );
    }

    // ==========================================
    // 02 - TẠO DATABASE SCOPE
    // ==========================================

    using var scope = app.Services.CreateScope();

    var db = scope.ServiceProvider
        .GetRequiredService<SaviBiteDbContext>();

    // ==========================================
    // 03 - KIỂM TRA DATABASE ĐÍCH
    // ==========================================

    string databaseName =
        db.Database.GetDbConnection().Database;

    if (!string.Equals(
        databaseName,
        "SaviBiteAuthDev",
        StringComparison.OrdinalIgnoreCase))
    {
        throw new InvalidOperationException(
            "Seeder V4 chỉ được chạy trên " +
            "database SaviBiteAuthDev. " +
            $"Database hiện tại: {databaseName}"
        );
    }

    bool canConnect =
        await db.Database.CanConnectAsync();

    if (!canConnect)
    {
        throw new InvalidOperationException(
            "Không thể kết nối database SaviBiteAuthDev. " +
            "Hãy kiểm tra SQL Server LocalDB và Migration."
        );
    }

    // ==========================================
    // 04 - KIỂM TRA DATABASE TRỐNG
    // ==========================================

    int existingUsers =
        await db.Users.CountAsync();

    int existingShops =
        await db.Shops.CountAsync();

    int existingProducts =
        await db.Products.CountAsync();

    int existingOffers =
        await db.Offers.CountAsync();

    int existingOrders =
        await db.Orders.CountAsync();

    if (existingUsers > 0 ||
        existingShops > 0 ||
        existingProducts > 0 ||
        existingOffers > 0 ||
        existingOrders > 0)
    {
        throw new InvalidOperationException(
            "Database đã có dữ liệu. " +
            "Không thể chạy Seeder V4. " +
            "Cần sao lưu và reset Development database " +
            "trước khi tạo dataset mới."
        );
    }

    // ==========================================
    // 05 - CHẠY DEVELOPMENT SEEDER V4
    // ==========================================

    app.Logger.LogInformation(
        "========================================"
    );

    app.Logger.LogInformation(
        "SAVIBITE DEVELOPMENT DATASET V4"
    );

    app.Logger.LogInformation(
        "Database: {DatabaseName}",
        databaseName
    );

    app.Logger.LogInformation(
        "Bắt đầu khởi tạo dữ liệu mẫu V4."
    );

    await DevelopmentDataSeeder.SeedAsync(
        db,
        seedPassword
    );

    // ==========================================
    // 06 - XÁC NHẬN SỐ LƯỢNG SAU SEED
    // ==========================================

    int users =
        await db.Users.CountAsync();

    int shops =
        await db.Shops.CountAsync();

    int members =
        await db.ShopMembers.CountAsync();

    int products =
        await db.Products.CountAsync();

    int offers =
        await db.Offers.CountAsync();

    int orders =
        await db.Orders.CountAsync();

    int reviews =
        await db.Reviews.CountAsync();

    int activeFlashSales =
        await db.Offers.CountAsync(x =>
            x.OfferType == "FLASH_SALE" &&
            x.Status == "ACTIVE"
        );

    int activeBoxes =
        await db.Offers.CountAsync(x =>
            x.OfferType == "SAVIBITE_BOX" &&
            x.Status == "ACTIVE"
        );

    // ==========================================
    // 07 - KIỂM TRA DATASET V4
    // ==========================================

    if (users != 400 ||
        shops != 30 ||
        members != 90 ||
        products != 900 ||
        offers != 3000 ||
        orders != 12000 ||
        reviews != 3000 ||
        activeFlashSales != 450 ||
        activeBoxes != 150)
    {
        throw new InvalidOperationException(
            "Seeder V4 đã chạy nhưng số lượng dữ liệu " +
            "không đúng cấu hình mong đợi. " +
            "Cần kiểm tra database."
        );
    }

    // ==========================================
    // 08 - LOG KẾT QUẢ
    // ==========================================

    app.Logger.LogInformation(
        "Users: {Count}", users
    );

    app.Logger.LogInformation(
        "Shops: {Count}", shops
    );

    app.Logger.LogInformation(
        "ShopMembers: {Count}", members
    );

    app.Logger.LogInformation(
        "Products: {Count}", products
    );

    app.Logger.LogInformation(
        "Offers: {Count}", offers
    );

    app.Logger.LogInformation(
        "Active Flash Sales: {Count}",
        activeFlashSales
    );

    app.Logger.LogInformation(
        "Active SaviBite Boxes: {Count}",
        activeBoxes
    );

    app.Logger.LogInformation(
        "Orders: {Count}", orders
    );

    app.Logger.LogInformation(
        "Reviews: {Count}", reviews
    );

    app.Logger.LogInformation(
        "Seeder V4 hoàn tất thành công."
    );

    app.Logger.LogInformation(
        "========================================"
    );
}

#endregion

#region 13 - GLOBAL EXCEPTION HANDLER

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var exception = context.Features
            .Get<IExceptionHandlerFeature>()?.Error;

        app.Logger.LogError(
            exception,
            "Có lỗi khi xử lý request."
        );

        context.Response.StatusCode =
            StatusCodes.Status500InternalServerError;

        await context.Response.WriteAsJsonAsync(
            ApiResponse.Fail(
                "INTERNAL_ERROR",
                "Không thể xử lý yêu cầu. Vui lòng thử lại sau."
            )
        );
    });
});

#endregion

#region 14 - SWAGGER VÀ HTTPS

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseHttpsRedirection();
}

#endregion

#region 15 - STATIC FILES - ẢNH ĐẠI DIỆN

var avatarDirectory = Path.Combine(
    app.Environment.ContentRootPath,
    "wwwroot",
    "uploads",
    "avatars"
);

Directory.CreateDirectory(avatarDirectory);

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(
        avatarDirectory
    ),
    RequestPath = "/uploads/avatars"
});

#endregion

#region 16 - STATIC FILES - ẢNH SẢN PHẨM

var productImageDirectory = Path.Combine(
    app.Environment.ContentRootPath,
    "wwwroot",
    "uploads",
    "products"
);

Directory.CreateDirectory(productImageDirectory);

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(
        productImageDirectory
    ),
    RequestPath = "/uploads/products"
});

#endregion

#region 17 - REQUEST PIPELINE

app.UseRouting();

// Chỉ cho phép Frontend gọi CORS
// theo policy Development đã cấu hình.
if (app.Environment.IsDevelopment())
{
    app.UseCors("AllowFrontend");
}

// Giới hạn tần suất request.
app.UseRateLimiter();

// Xác thực JWT.
app.UseAuthentication();

// Từ chối tài khoản đã bị khóa.
app.UseMiddleware<ActiveAccountMiddleware>();

// Kiểm tra phân quyền.
app.UseAuthorization();

// Đăng ký API Controllers.
app.MapControllers();

#endregion

#region 18 - KHỞI CHẠY BACKEND




if (app.Environment.IsDevelopment() &&
    Environment.GetEnvironmentVariable("SAVIBITE_VERIFY_ADMIN_PASSWORD") == "true")
{
    using var scope = app.Services.CreateScope();

    var db = scope.ServiceProvider
        .GetRequiredService<SaviBiteDbContext>();

    var admin = await db.Users
        .FirstOrDefaultAsync(
            x => x.Email == "minhkhoi.nguyen@gmail.com");

    if (admin is null)
    {
        Console.WriteLine("[AUTH CHECK] Admin không tồn tại.");
    }
    else
    {
        var password = Environment.GetEnvironmentVariable(
            "SAVIBITE_SEED_PASSWORD");

        var result = new PasswordHasher<User>()
            .VerifyHashedPassword(
                admin,
                admin.PasswordHash,
                password ?? "");

        Console.WriteLine(
            $"[AUTH CHECK] Password verification: {result}");
    }
}



app.Run();

#endregion
