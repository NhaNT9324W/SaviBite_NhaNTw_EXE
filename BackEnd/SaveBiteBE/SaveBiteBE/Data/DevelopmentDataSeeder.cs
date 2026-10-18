
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Data;

/// <summary>
/// SAVIBITE DEVELOPMENT DATASET V4
/// ------------------------------------------
/// Mô phỏng nền tảng Food Rescue đã vận hành
/// nhiều tháng tại thành phố Cần Thơ.
///
/// 400 Users
/// 30 Shops
/// 90 ShopMembers
/// 900 Products
/// 2400 Historical Offers
/// 600 Current Offers
/// 12000 Historical Orders
/// 3000 Reviews
/// Payments, Pickups, Refunds, AuditLogs
///
/// Chỉ sử dụng trong Development.
/// Không dùng dữ liệu này cho Production.
/// </summary>
public static class DevelopmentDataSeeder
{
    #region 01 - CẤU HÌNH V4

    private const int UserCount = 400;
    private const int ShopCount = 30;
    private const int ProductsPerShop = 30;
    private const int HistoricalOfferCount = 2400;
    private const int CurrentOfferCount = 600;
    private const int OrderCount = 12000;
    private const int ReviewCount = 3000;

    private const int OwnerStart = 1;
    private const int StaffStart = 31;
    private const int CustomerStart = 91;
    private const int CustomerCount = 306;
    private const int LockedStart = 397;

    private static readonly DateTime HistoryStart =
        new(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc);

    private static readonly string[] LastNames =
    [
        "Nguyễn", "Trần", "Lê", "Phạm", "Huỳnh",
        "Võ", "Đặng", "Bùi", "Đỗ", "Hồ",
        "Phan", "Dương", "Trương", "Mai", "Lý"
    ];

    private static readonly string[] MiddleNames =
    [
        "Minh", "Ngọc", "Hoàng", "Thảo",
        "Thanh", "Gia", "Khánh", "Quỳnh",
        "Thiên", "Nhật", "Phương", "Tuấn",
        "Hồng", "Đức", "Kim", "Bảo",
        "Quốc", "Mỹ", "Đình", "Tấn"
    ];

    private static readonly string[] FirstNames =
    [
        "Hân", "Phúc", "Vy", "Bảo", "Linh",
        "Khang", "Nhi", "Huy", "Trâm", "Đạt",
        "Thư", "Khôi", "Duy", "Ngân", "Long",
        "My", "Quân", "Tiên", "Tâm", "Kiệt",
        "Như", "Hiếu", "Trang", "Hải", "Yến",
        "Tú", "Thịnh", "Nhã", "Quỳnh", "Vân"
    ];

    private static readonly string[] ShopNames =
    [
        "Tiệm Bánh Góc Phố",
        "Bếp Nhà An",
        "Cà Phê Mộc Nhiên",
        "Bánh Nhà Hân",
        "Bếp Chiều Ấm",
        "Trà Nhà Mây",
        "Tiệm Bánh An Nhiên",
        "Cơm Nhà Gạo",
        "Cà Phê Hẻm Nhỏ",
        "Bánh Ngọt Mùa Thu",
        "Bếp Cô Út",
        "Trà Sữa Lá Nhỏ",
        "Tiệm Bánh Mộc",
        "Cơm Trưa Nhà Mình",
        "Cà Phê Ban Mai",
        "Bánh & Bơ",
        "Bếp Xưa",
        "Tiệm Trà Tháng Mười",
        "Bánh Nhà Nắng",
        "Bếp Mẹ Nấu",
        "Cà Phê Chút Bình Yên",
        "Tiệm Bánh Hoa Nắng",
        "Bếp Cơm Ấm",
        "Trà Sữa Nhà Lá",
        "Tiệm Bánh Mây Trắng",
        "Cơm Ngon Nhà Sen",
        "Cà Phê Phố Nhỏ",
        "Tiệm Bánh Hương Mai",
        "Bếp Thương Nhà",
        "Trà Sữa Góc Nhỏ"
    ];

    private static readonly string[] Streets =
    [
        "Đường 30 Tháng 4",
        "Đường Nguyễn Văn Cừ",
        "Đường Mậu Thân",
        "Đường 3 Tháng 2",
        "Đường Trần Hưng Đạo",
        "Đường Nguyễn Việt Hồng",
        "Đường Lý Tự Trọng",
        "Đường Nguyễn Trãi",
        "Đường Cách Mạng Tháng Tám",
        "Đường Võ Văn Kiệt",
        "Đường Quang Trung",
        "Đường Xô Viết Nghệ Tĩnh"
    ];

    // 4 nhóm kinh doanh:
    // 0: Bánh
    // 1: Cơm / Bếp
    // 2: Cà phê
    // 3: Trà / Trà sữa

    private static readonly string[][] Catalog =
    [
        [
            "Croissant bơ",
            "Croissant hạnh nhân",
            "Bánh tart trứng",
            "Bánh su kem vani",
            "Bánh mì phô mai",
            "Bông lan trứng muối",
            "Tiramisu",
            "Mousse xoài",
            "Bánh quy bơ",
            "Bánh mì sữa",
            "Bánh cuộn kem",
            "Bánh chocolate",
            "Bánh chuối",
            "Bánh mì nguyên cám",
            "Bánh táo",
            "Croissant bơ mật ong",
            "Bánh mì phô mai tan chảy",
            "Bánh tart chanh",
            "Bánh bông lan cuộn kem",
            "Bánh quy chocolate chip",
            "Bánh su kem matcha",
            "Bánh chuối yến mạch",
            "Bánh mì bơ tỏi",
            "Bánh mousse dâu",
            "Bánh mì nguyên cám hạt",
            "Bánh donut đường",
            "Bánh bông lan phô mai",
            "Bánh tart dâu",
            "Bánh mì ngũ cốc",
            "Bánh kem mini"
        ],
        [
            "Cơm gà xé",
            "Cơm sườn nướng",
            "Cơm thịt kho trứng",
            "Cơm cá sốt cà",
            "Cơm gà chiên nước mắm",
            "Cơm bò xào",
            "Cơm chay rau củ",
            "Mì xào hải sản",
            "Bún thịt nướng",
            "Cơm sườn bì",
            "Cơm cá kho",
            "Cơm thịt nướng",
            "Nui xào bò",
            "Cơm gà nấm",
            "Cơm đậu hũ sốt nấm",
            "Cơm gà sốt nấm",
            "Cơm sườn mật ong",
            "Cơm cá kho tiêu",
            "Cơm bò lúc lắc",
            "Cơm chay nấm đậu hũ",
            "Bún gà nướng",
            "Mì xào bò rau củ",
            "Cơm thịt kho nước dừa",
            "Cơm gà xối mỡ",
            "Nui sốt bò bằm",
            "Cơm tôm rang",
            "Cơm cá chiên sả",
            "Bún chả giò",
            "Cơm trứng cuộn",
            "Mì Ý sốt bò"
        ],
        [
            "Cà phê sữa đá",
            "Bạc xỉu",
            "Cà phê đen",
            "Cappuccino",
            "Latte",
            "Matcha latte",
            "Trà đào cam sả",
            "Trà vải",
            "Trà chanh",
            "Trà sữa truyền thống",
            "Trà sữa trân châu",
            "Trà ô long",
            "Trà dâu",
            "Chocolate đá",
            "Sữa tươi trân châu đường đen",
            "Cà phê muối",
            "Latte caramel",
            "Cold brew cam",
            "Bạc xỉu kem sữa",
            "Matcha sữa yến mạch",
            "Cappuccino nóng",
            "Chocolate kem sữa",
            "Espresso tonic",
            "Americano đá",
            "Mocha chocolate",
            "Cà phê dừa",
            "Latte vani",
            "Cold brew sữa",
            "Cà phê hạnh nhân",
            "Chocolate nóng"
        ],
        [
            "Trà sữa truyền thống",
            "Trà sữa trân châu đen",
            "Trà sữa ô long",
            "Trà sữa matcha",
            "Trà đào cam sả",
            "Trà vải",
            "Trà chanh",
            "Trà dâu",
            "Trà tắc mật ong",
            "Trà sữa khoai môn",
            "Trà sữa chocolate",
            "Trà ô long kem sữa",
            "Trà xoài",
            "Trà cam",
            "Trà sữa đường đen",
            "Trà sữa ô long kem cheese",
            "Trà đào dứa",
            "Trà vải hoa nhài",
            "Trà sữa trân châu hoàng kim",
            "Trà chanh mật ong",
            "Trà dâu tằm",
            "Trà sữa khoai môn trân châu",
            "Trà xoài nhiệt đới",
            "Trà sữa matcha trân châu",
            "Trà cam quế",
            "Trà sữa hạt dẻ",
            "Trà ổi hồng",
            "Trà sữa caramel",
            "Trà dứa bạc hà",
            "Trà sữa pudding trứng"
        ]
    ];

    private static readonly string[][] BoxNames =
    [
        [
            "Hộp bánh ngọt bất ngờ",
            "Hộp bánh mì tiết kiệm",
            "Hộp bánh chiều ấm áp",
            "Hộp bánh cuối ngày",
            "Hộp bánh nhỏ xinh"
        ],
        [
            "Hộp cơm gia đình",
            "Hộp bữa trưa tiết kiệm",
            "Hộp món ngon nhà bếp",
            "Hộp bữa ăn cuối ngày",
            "Hộp cơm ấm lòng"
        ],
        [
            "Hộp bánh và cà phê",
            "Hộp đồ uống bất ngờ",
            "Hộp cà phê chiều",
            "Hộp thức uống tiết kiệm",
            "Hộp cà phê và món nhẹ"
        ],
        [
            "Hộp trà sữa bất ngờ",
            "Hộp trà trái cây",
            "Hộp giải nhiệt tiết kiệm",
            "Hộp trà chiều",
            "Hộp thức uống cuối ngày"
        ]
    ];

    private static readonly string[] GoodReviews =
    [
        "Đồ ăn ngon, giá rất hợp lý.",
        "Mình đã mua vài lần và khá hài lòng.",
        "Nhận hàng đúng giờ, nhân viên nhiệt tình.",
        "Sản phẩm còn tốt, đóng gói cẩn thận.",
        "Giảm giá nhiều mà chất lượng vẫn ổn.",
        "Cửa hàng dễ tìm, nhận hàng nhanh.",
        "Món ăn hợp khẩu vị, sẽ quay lại.",
        "Hộp bất ngờ có nhiều món khá thú vị.",
        "Đồ ăn đúng mô tả, trải nghiệm tốt.",
        "Đặt hàng đơn giản, tiết kiệm được nhiều."
    ];

    private static readonly string[] AverageReviews =
    [
        "Giá tốt nhưng mình phải chờ hơi lâu.",
        "Chất lượng ổn, phần ăn hơi ít.",
        "Đồ ăn được nhưng bao bì cần cải thiện.",
        "Món ăn ổn, chưa thật sự nổi bật.",
        "Hộp bất ngờ khá thú vị nhưng chưa hợp khẩu vị."
    ];

    private static readonly string[] BadReviews =
    [
        "Món hơi nguội khi mình đến nhận.",
        "Thời gian chuẩn bị lâu hơn dự kiến.",
        "Phần ăn chưa giống mô tả.",
        "Bao bì chưa chắc chắn.",
        "Trải nghiệm nhận hàng chưa tốt."
    ];

    private static readonly string[] RefundReasons =
    [
        "Sản phẩm nhận được không đúng mô tả.",
        "Một phần đơn hàng bị thiếu.",
        "Bao bì bị hỏng khi nhận hàng.",
        "Chất lượng món ăn chưa đạt yêu cầu."
    ];

    #endregion

    #region 02 - ĐIỀU PHỐI SEEDER

    public static async Task SeedAsync(
        SaviBiteDbContext db,
        string developmentPassword,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(developmentPassword)
            || developmentPassword.Length < 12)
        {
            throw new InvalidOperationException(
                "Mật khẩu Development phải có ít nhất 12 ký tự.");
        }

        // Không cho chạy nhầm Production.
        string databaseName =
            db.Database.GetDbConnection().Database;

        if (!string.Equals(
            databaseName,
            "SaviBiteAuthDev",
            StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "Seeder V4 chỉ được phép chạy " +
                "trên database SaviBiteAuthDev.");
        }

        // Database cần được reset và migrate trước.
        bool hasData =
            await db.Users.AnyAsync(ct) ||
            await db.Shops.AnyAsync(ct) ||
            await db.Categories.AnyAsync(ct) ||
            await db.Products.AnyAsync(ct) ||
            await db.Offers.AnyAsync(ct) ||
            await db.Orders.AnyAsync(ct) ||
            await db.Payments.AnyAsync(ct) ||
            await db.RefundRequests.AnyAsync(ct);

        if (hasData)
        {
            throw new InvalidOperationException(
                "Database không trống. " +
                "Không được trộn dữ liệu V4 với dữ liệu cũ.");
        }

        var now = DateTime.UtcNow;

        if (now <= HistoryStart.AddDays(30))
        {
            throw new InvalidOperationException(
                "Chưa đủ khoảng thời gian tạo dữ liệu lịch sử.");
        }

        var random = new Random(20261018);

        await using var transaction =
            await db.Database.BeginTransactionAsync(ct);

        try
        {
            Console.WriteLine(
                "[V4] Bắt đầu sinh dữ liệu.");

            var users = await SeedUsersAsync(
                db, developmentPassword, random, ct);

            var categories =
                await SeedCategoriesAsync(db, ct);

            var shops =
                await SeedShopsAsync(db, random, ct);

            await SeedMembersAsync(
                db, users, shops, ct);

            var products = await SeedProductsAsync(
                db, shops, categories, ct);

            var offers = await SeedOffersAsync(
                db, shops, products, now, random, ct);

            var orders = await SeedOrdersAsync(
                db, users, shops, offers, random, ct);

            var payments = await SeedPaymentsAsync(
                db, orders, ct);

            await SeedPickupsAsync(
                db, orders, users, ct);

            await SeedReviewsAsync(
                db, orders, users, random, ct);

            await SeedRefundsAsync(
                db, orders, payments, users, now, ct);

            await SeedAuditLogsAsync(
                db, users, shops, ct);

            await UpdateRatingsAsync(db, shops, ct);

            await ValidateAsync(db, ct);

            await transaction.CommitAsync(ct);

            Console.WriteLine(
                "[V4] COMMIT dữ liệu thành công.");
        }
        catch
        {
            await transaction.RollbackAsync(ct);
            db.ChangeTracker.Clear();

            Console.WriteLine(
                "[V4] Có lỗi. Transaction đã rollback.");

            throw;
        }
    }

    #endregion

    #region 03 - USERS

    private static async Task<List<User>> SeedUsersAsync(
        SaviBiteDbContext db,
        string password,
        Random random,
        CancellationToken ct)
    {
        var users = new List<User>();
        var hasher = new PasswordHasher<User>();

        var admin = new User
        {
            FullName = "Nguyễn Minh Khôi",
            Email = "minhkhoi.nguyen@savibite.example",
            Phone = "0900000001",
            SystemRole = "ADMIN",
            Status = "ACTIVE",
            CreatedAt = HistoryStart.AddDays(-60),
            UpdatedAt = HistoryStart.AddDays(-60)
        };

        admin.PasswordHash =
            hasher.HashPassword(admin, password);

        users.Add(admin);

        // OWNER: users[1] - users[30]
        // STAFF: users[31] - users[90]
        // CUSTOMER: users[91] - users[396]
        // LOCKED: users[397] - users[399]

        for (int i = 1; i < UserCount; i++)
        {
            string family =
                LastNames[random.Next(LastNames.Length)];

            string middle =
                MiddleNames[random.Next(MiddleNames.Length)];

            string first =
                FirstNames[random.Next(FirstNames.Length)];

            string fullName =
                $"{family} {middle} {first}";

            string localPart = Normalize(
                $"{first}.{middle}.{family}");

            // Không dùng demo, test hoặc số ID trong local-part.
            // Tên miền .example là tên miền dự trữ.
            // Không thể gửi email ra ngoài tới địa chỉ này.
            string email =
                $"{localPart}{i:D3}@savibite.example";

            DateTime created = HistoryStart.AddDays(
                -random.Next(5, 60));

            var user = new User
            {
                FullName = fullName,
                Email = email,
                Phone = $"09{10000000 + i:D8}",

                SystemRole = "USER",

                Status = i >= LockedStart
                    ? "LOCKED"
                    : "ACTIVE",

                CreatedAt = created,
                UpdatedAt = created
            };

            user.PasswordHash =
                hasher.HashPassword(user, password);

            users.Add(user);
        }

        db.Users.AddRange(users);
        await db.SaveChangesAsync(ct);
        db.ChangeTracker.Clear();

        Console.WriteLine($"[V4] Users: {users.Count}");

        return users;
    }

    #endregion

    #region 04 - CATEGORIES

    private static async Task<List<Category>>
        SeedCategoriesAsync(
            SaviBiteDbContext db,
            CancellationToken ct)
    {
        var data = new (string Name, string Slug)[]
        {
            ("Bánh ngọt và bánh mì", "banh-ngot-banh-mi"),
            ("Cơm và món chính", "com-mon-chinh"),
            ("Cà phê và đồ uống", "ca-phe-do-uong"),
            ("Đồ ăn chế biến sẵn", "do-an-che-bien-san")
        };

        var categories = data.Select(x => new Category
        {
            Name = x.Name,
            Slug = x.Slug,
            Status = "ACTIVE",
            CreatedAt = HistoryStart.AddDays(-60)
        }).ToList();

        db.Categories.AddRange(categories);
        await db.SaveChangesAsync(ct);
        db.ChangeTracker.Clear();

        Console.WriteLine(
            $"[V4] Categories: {categories.Count}");

        return categories;
    }

    #endregion

    #region 05 - SHOPS

    private static int GetShopGroup(string name)
    {
        string value = name.ToLowerInvariant();

        if (value.Contains("trà"))
            return 3;

        if (value.Contains("cà phê"))
            return 2;

        if (value.Contains("bếp") ||
            value.Contains("cơm"))
            return 1;

        return 0;
    }

    private static string GetShopDescription(int group)
    {
        return group switch
        {
            0 => "Tiệm bánh phục vụ bánh mì và " +
                 "bánh ngọt được chuẩn bị trong ngày.",

            1 => "Bếp ăn gia đình với các suất cơm " +
                 "và món chính theo thực đơn.",

            2 => "Quán cà phê phục vụ đồ uống " +
                 "và các món pha chế.",

            _ => "Cửa hàng trà và trà sữa " +
                 "với nhiều hương vị khác nhau."
        };
    }

    private static async Task<List<Shop>> SeedShopsAsync(
        SaviBiteDbContext db,
        Random random,
        CancellationToken ct)
    {
        var shops = new List<Shop>();

        for (int i = 0; i < ShopCount; i++)
        {
            int group = GetShopGroup(ShopNames[i]);

            string status = i switch
            {
                27 => "PENDING",
                28 => "SUSPENDED",
                29 => "REJECTED",
                _ => "APPROVED"
            };

            string area = (i % 3) switch
            {
                0 => "Ninh Kiều",
                1 => "Bình Thủy",
                _ => "Cái Răng"
            };

            DateTime created = HistoryStart.AddDays(
                -random.Next(10, 45));

            shops.Add(new Shop
            {
                Name = ShopNames[i],
                Description = GetShopDescription(group),
                Phone = $"029236{1000 + i:D4}",

                Address =
                    $"{Streets[i % Streets.Length]}, " +
                    $"{area}, Cần Thơ",

                Status = status,
                AverageRating = 0m,

                // Chỉ dùng tọa độ khi có dữ liệu xác minh.
                Latitude = null,
                Longitude = null,
                LogoUrl = null,
                CoverUrl = null,

                CreatedAt = created,
                UpdatedAt = created
            });
        }

        db.Shops.AddRange(shops);
        await db.SaveChangesAsync(ct);
        db.ChangeTracker.Clear();

        Console.WriteLine($"[V4] Shops: {shops.Count}");

        return shops;
    }

    #endregion

    #region 06 - SHOP MEMBERS

    private static async Task SeedMembersAsync(
        SaviBiteDbContext db,
        List<User> users,
        List<Shop> shops,
        CancellationToken ct)
    {
        var members = new List<ShopMember>();

        for (int i = 0; i < ShopCount; i++)
        {
            members.Add(new ShopMember
            {
                ShopId = shops[i].Id,
                UserId = users[OwnerStart + i].Id,
                MemberRole = "OWNER",
                Status = "ACTIVE",
                JoinedAt = shops[i].CreatedAt
            });

            for (int j = 0; j < 2; j++)
            {
                int index = StaffStart + i * 2 + j;

                members.Add(new ShopMember
                {
                    ShopId = shops[i].Id,
                    UserId = users[index].Id,
                    MemberRole = "STAFF",
                    Status = "ACTIVE",

                    JoinedAt =
                        shops[i].CreatedAt.AddDays(j + 1)
                });
            }
        }

        db.ShopMembers.AddRange(members);
        await db.SaveChangesAsync(ct);
        db.ChangeTracker.Clear();

        Console.WriteLine(
            $"[V4] ShopMembers: {members.Count}");
    }

    #endregion

    #region 07 - PRODUCTS

    private static (
        string Ingredients,
        string AllergyInfo,
        string Storage
    ) GetFoodInfo(int group)
    {
        return group switch
        {
            0 => (
                "Bột mì, bơ, đường và thành phần theo món.",
                "Có thể chứa gluten, sữa, trứng và hạt.",
                "Bảo quản theo hướng dẫn, ưu tiên dùng trong ngày."
            ),

            1 => (
                "Gạo, thịt hoặc rau củ theo từng món.",
                "Có thể chứa trứng, đậu nành, cá hoặc gluten.",
                "Bảo quản ở nhiệt độ phù hợp; dùng trong ngày."
            ),

            2 => (
                "Cà phê, trà, sữa và nguyên liệu pha chế.",
                "Một số món có chứa sữa hoặc các loại hạt.",
                "Dùng trong ngày theo hướng dẫn cửa hàng."
            ),

            _ => (
                "Trà, sữa, trái cây hoặc topping tùy món.",
                "Một số món có thể chứa sữa hoặc đậu nành.",
                "Dùng trong ngày theo hướng dẫn cửa hàng."
            )
        };
    }

    private static async Task<List<Product>> SeedProductsAsync(
        SaviBiteDbContext db,
        List<Shop> shops,
        List<Category> categories,
        CancellationToken ct)
    {
        var products = new List<Product>();

        for (int s = 0; s < shops.Count; s++)
        {
            var shop = shops[s];
            int group = GetShopGroup(shop.Name);

            int categoryIndex = group == 3 ? 2 : group;

            for (int p = 0; p < ProductsPerShop; p++)
            {
                string name = Catalog[group][p];

                decimal price = group switch
                {
                    0 => 25000m + p % 10 * 4000m,
                    1 => 35000m + p % 10 * 5000m,
                    2 => 25000m + p % 10 * 3000m,
                    _ => 25000m + p % 10 * 3000m
                };

                var info = GetFoodInfo(group);

                products.Add(new Product
                {
                    ShopId = shop.Id,
                    CategoryId =
                        categories[categoryIndex].Id,

                    Name = name,

                    Description =
                        $"{name} do {shop.Name} " +
                        "chuẩn bị và phục vụ trong ngày.",

                    Ingredients = info.Ingredients,
                    AllergyInfo = info.AllergyInfo,

                    StorageInstruction = info.Storage,

                    OriginalPrice = price,

                    Status = p == 29
                        ? "INACTIVE"
                        : "ACTIVE",

                    ImageUrl = null,

                    CreatedAt =
                        shop.CreatedAt.AddDays(2),

                    UpdatedAt =
                        shop.CreatedAt.AddDays(2)
                });
            }
        }

        db.Products.AddRange(products);
        await db.SaveChangesAsync(ct);
        db.ChangeTracker.Clear();

        Console.WriteLine(
            $"[V4] Products: {products.Count}");

        return products;
    }

    #endregion

    #region 08 - OFFERS

    private static Offer CreateOffer(
        Shop shop,
        Product product,
        bool isBox,
        int boxIndex,
        DateTime start,
        DateTime end,
        int quantity,
        string status,
        decimal discount)
    {
        int group = GetShopGroup(shop.Name);

        string boxName =
            BoxNames[group][boxIndex % BoxNames[group].Length];

        decimal original = isBox
            ? 90000m + boxIndex % 5 * 10000m
            : product.OriginalPrice;

        decimal sale = RoundThousand(
            original * (1m - discount));

        return new Offer
        {
            ShopId = shop.Id,

            ProductId = isBox
                ? null
                : product.Id,

            OfferType = isBox
                ? "SAVIBITE_BOX"
                : "FLASH_SALE",

            Title = isBox
                ? $"{boxName} - {shop.Name}"
                : $"{product.Name} ưu đãi cuối ngày",

            Description = isBox
                ? "Hộp thực phẩm bất ngờ gồm các món " +
                  "được cửa hàng lựa chọn từ thực phẩm " +
                  "còn lại trong ngày. Thành phần " +
                  "thực tế có thể thay đổi."
                : product.Description,

            OriginalValue = original,
            SalePrice = sale,

            InitialQuantity = quantity,
            AvailableQuantity = quantity,

            SaleStartAt = start,
            SaleEndAt = end,

            PickupStartAt = end.AddMinutes(15),
            PickupEndAt = end.AddHours(3),

            AllergyInfo = product.AllergyInfo,

            StorageInstruction =
                product.StorageInstruction,

            ImageUrl = null,

            Status = status,

            CreatedAt = start.AddDays(-1),
            UpdatedAt = start.AddDays(-1)
        };
    }

    private static async Task<List<Offer>> SeedOffersAsync(
        SaviBiteDbContext db,
        List<Shop> shops,
        List<Product> products,
        DateTime now,
        Random random,
        CancellationToken ct)
    {
        var offers = new List<Offer>();

        var approved = shops
            .Where(x => x.Status == "APPROVED")
            .ToList();

        var lookup = products
            .Where(x => x.Status == "ACTIVE")
            .GroupBy(x => x.ShopId)
            .ToDictionary(
                x => x.Key,
                x => x.ToList());

        int historyDays = Math.Max(
            1,
            (int)(now.Date - HistoryStart.Date).TotalDays - 4);

        // ==========================================
        // 2400 OFFERS LỊCH SỬ
        // ==========================================

        for (int i = 0; i < HistoricalOfferCount; i++)
        {
            var shop = approved[i % approved.Count];

            var selection = lookup[shop.Id];

            var product = selection[
                (i / approved.Count) % selection.Count];

            DateTime start;

            // Một số ưu đãi kết thúc gần hiện tại
            // để có thể sinh Refund PENDING.
            if (i < 12)
            {
                start = now.AddHours(
                    -22 + i * 1.2);
            }
            else
            {
                int day = (i * 37) % historyDays;

                start = HistoryStart
                    .AddDays(day)
                    .AddHours(7 + i % 6);
            }

            DateTime end = start.AddHours(4);

            bool isBox = i % 5 == 0;

            int quantity = random.Next(14, 31);

            decimal discount =
                0.35m + i % 4 * 0.05m;

            offers.Add(CreateOffer(
                shop,
                product,
                isBox,
                i,
                start,
                end,
                quantity,
                "ENDED",
                discount));
        }

        // ==========================================
        // 600 OFFERS ĐANG BÁN
        // ==========================================

        for (int i = 0; i < CurrentOfferCount; i++)
        {
            var shop = approved[i % approved.Count];

            var selection = lookup[shop.Id];

            int index =
                (i / approved.Count + 5) %
                selection.Count;

            var product = selection[index];

            // 450 Flash Sale và 150 Box.
            bool isBox = i % 4 == 0;

            DateTime start =
                now.AddMinutes(-20);

            DateTime end =
                now.AddHours(12 + i % 3);

            int quantity =
                random.Next(12, 35);

            decimal discount =
                isBox ? 0.50m : 0.40m;

            offers.Add(CreateOffer(
                shop,
                product,
                isBox,
                i,
                start,
                end,
                quantity,
                "ACTIVE",
                discount));
        }

        db.Offers.AddRange(offers);

        await db.SaveChangesAsync(ct);
        db.ChangeTracker.Clear();

        Console.WriteLine(
            $"[V4] Offers: {offers.Count}");

        return offers;
    }

    #endregion

    #region 09 - ORDERS

    private sealed record SeedOrderRow(
        Order Order,
        Offer Offer,
        int ShopIndex);

    private static async Task<List<SeedOrderRow>>
        SeedOrdersAsync(
            SaviBiteDbContext db,
            List<User> users,
            List<Shop> shops,
            List<Offer> offers,
            Random random,
            CancellationToken ct)
    {
        var rows = new List<SeedOrderRow>();

        var historical = offers
            .Where(x => x.Status == "ENDED")
            .ToList();

        var shopIndexes = shops
            .Select((shop, index) => new
            {
                shop.Id,
                Index = index
            })
            .ToDictionary(x => x.Id, x => x.Index);

        var soldCounts = new Dictionary<Guid, int>();

        var orderBatch = new List<Order>();
        var itemBatch = new List<OrderItem>();

        for (int i = 0; i < OrderCount; i++)
        {
            var offer = historical[
                i % historical.Count];

            var shop = shops[
                shopIndexes[offer.ShopId]];

            var customer = users[
                CustomerStart +
                random.Next(CustomerCount)];

            DateTime created =
                offer.SaleStartAt.AddMinutes(
                    20 + random.Next(0, 100));

            // Tất cả ưu đãi lịch sử có cửa sổ
            // mở bán dài 4 giờ.
            if (created >= offer.SaleEndAt)
            {
                created =
                    offer.SaleEndAt.AddMinutes(-30);
            }

            string status = (i % 100) switch
            {
                < 93 => "COMPLETED",
                < 97 => "CANCELLED",
                _ => "EXPIRED"
            };

            bool paid = status == "COMPLETED";

            string orderNumber =
                $"SB{created:yyyyMMdd}{i + 1:D6}";

            decimal amount = offer.SalePrice;

            var order = new Order
            {
                OrderNumber = orderNumber,

                UserId = customer.Id,
                ShopId = shop.Id,

                RequestId = Guid.NewGuid(),

                RequestHash = Sha256(
                    $"ORDER-{orderNumber}"),

                Status = status,

                PaymentStatus = paid
                    ? "PAID"
                    : "UNPAID",

                ReceiverName =
                    customer.FullName,

                ReceiverPhone =
                    customer.Phone,

                Note = i % 9 == 0
                    ? "Nhờ cửa hàng chuẩn bị sẵn."
                    : string.Empty,

                ShopName = shop.Name,
                ShopAddress = shop.Address,

                TotalAmount = amount,

                PaymentExpiresAt =
                    created.AddMinutes(15),

                CreatedAt = created,

                UpdatedAt = paid
                    ? offer.PickupStartAt.AddMinutes(25)
                    : created.AddMinutes(15)
            };

            var item = new OrderItem
            {
                OrderId = order.Id,
                OfferId = offer.Id,

                OfferType = offer.OfferType,
                OfferTitle = offer.Title,

                ImageUrl = offer.ImageUrl,

                OriginalValue = offer.OriginalValue,
                UnitPrice = offer.SalePrice,

                Quantity = 1,
                LineTotal = amount,

                PickupStartAt = offer.PickupStartAt,
                PickupEndAt = offer.PickupEndAt,

                AllergyInfo = offer.AllergyInfo,

                StorageInstruction =
                    offer.StorageInstruction
            };

            rows.Add(new SeedOrderRow(
                order,
                offer,
                shopIndexes[shop.Id]));

            orderBatch.Add(order);
            itemBatch.Add(item);

            if (paid)
            {
                soldCounts.TryGetValue(
                    offer.Id, out int sold);

                sold++;

                if (sold > offer.InitialQuantity)
                {
                    throw new InvalidOperationException(
                        "Đơn hàng vượt tồn kho Offer.");
                }

                soldCounts[offer.Id] = sold;
            }

            if (orderBatch.Count >= 250)
            {
                await SaveOrderBatchAsync(
                    db,
                    orderBatch,
                    itemBatch,
                    ct);

                orderBatch.Clear();
                itemBatch.Clear();
            }
        }

        if (orderBatch.Count > 0)
        {
            await SaveOrderBatchAsync(
                db,
                orderBatch,
                itemBatch,
                ct);
        }

        // Trừ tồn kho các Offer lịch sử.
        foreach (var offer in historical)
        {
            soldCounts.TryGetValue(
                offer.Id, out int sold);

            int remaining =
                offer.InitialQuantity - sold;

            if (remaining < 0)
            {
                throw new InvalidOperationException(
                    "Tồn kho Offer không hợp lệ.");
            }

            await db.Offers
                .Where(x => x.Id == offer.Id)
                .ExecuteUpdateAsync(
                    update => update.SetProperty(
                        x => x.AvailableQuantity,
                        remaining),
                    ct);
        }

        db.ChangeTracker.Clear();

        Console.WriteLine(
            $"[V4] Orders: {rows.Count}");

        return rows;
    }

    private static async Task SaveOrderBatchAsync(
        SaviBiteDbContext db,
        List<Order> orders,
        List<OrderItem> items,
        CancellationToken ct)
    {
        db.Orders.AddRange(orders);
        await db.SaveChangesAsync(ct);

        db.OrderItems.AddRange(items);
        await db.SaveChangesAsync(ct);

        db.ChangeTracker.Clear();
    }

    #endregion

    #region 10 - PAYMENTS

    private static async Task<Dictionary<Guid, Payment>>
        SeedPaymentsAsync(
            SaviBiteDbContext db,
            List<SeedOrderRow> rows,
            CancellationToken ct)
    {
        var result =
            new Dictionary<Guid, Payment>();

        var batch = new List<Payment>();

        int sequence = 0;

        foreach (var row in rows)
        {
            if (row.Order.PaymentStatus != "PAID")
                continue;

            sequence++;

            var payment = new Payment
            {
                OrderId = row.Order.Id,

                RequestId = Guid.NewGuid(),

                Provider = "MOCK",
                Status = "SUCCESS",

                Amount =
                    row.Order.TotalAmount,

                TransactionReference =
                    $"MOCK-V4-{sequence:D9}",

                CreatedAt =
                    row.Order.CreatedAt.AddMinutes(3)
            };

            result.Add(
                row.Order.Id,
                payment);

            batch.Add(payment);

            if (batch.Count >= 250)
            {
                db.Payments.AddRange(batch);
                await db.SaveChangesAsync(ct);

                db.ChangeTracker.Clear();
                batch.Clear();
            }
        }

        if (batch.Count > 0)
        {
            db.Payments.AddRange(batch);
            await db.SaveChangesAsync(ct);
            db.ChangeTracker.Clear();
        }

        Console.WriteLine(
            $"[V4] Payments: {result.Count}");

        return result;
    }

    #endregion

    #region 11 - PICKUP CONFIRMATIONS

    private static async Task SeedPickupsAsync(
        SaviBiteDbContext db,
        List<SeedOrderRow> rows,
        List<User> users,
        CancellationToken ct)
    {
        var batch = new List<PickupConfirmation>();

        int sequence = 0;

        foreach (var row in rows)
        {
            if (row.Order.Status != "COMPLETED")
                continue;

            sequence++;

            int staffIndex =
                StaffStart + row.ShopIndex * 2;

            var pickup = new PickupConfirmation
            {
                OrderId = row.Order.Id,
                ShopId = row.Order.ShopId,

                PickupCode =
                    $"P{sequence:D9}",

                IssuedAt =
                    row.Order.CreatedAt.AddMinutes(5),

                ConfirmedAt =
                    row.Offer.PickupStartAt.AddMinutes(25),

                ConfirmedByUserId =
                    users[staffIndex].Id,

                ConfirmationRequestId =
                    Guid.NewGuid()
            };

            batch.Add(pickup);

            if (batch.Count >= 250)
            {
                db.PickupConfirmations
                    .AddRange(batch);

                await db.SaveChangesAsync(ct);

                db.ChangeTracker.Clear();
                batch.Clear();
            }
        }

        if (batch.Count > 0)
        {
            db.PickupConfirmations
                .AddRange(batch);

            await db.SaveChangesAsync(ct);
            db.ChangeTracker.Clear();
        }

        Console.WriteLine(
            $"[V4] Pickups: {sequence}");
    }

    #endregion

    #region 12 - REVIEWS

    private static async Task SeedReviewsAsync(
        SaviBiteDbContext db,
        List<SeedOrderRow> rows,
        List<User> users,
        Random random,
        CancellationToken ct)
    {
        var names = users.ToDictionary(
            x => x.Id,
            x => x.FullName);

        var completed = rows
            .Where(x =>
                x.Order.Status == "COMPLETED")
            .OrderBy(x => x.Order.CreatedAt)
            .Take(ReviewCount)
            .ToList();

        var batch = new List<Review>();

        foreach (var row in completed)
        {
            int rating = random.Next(100) switch
            {
                < 46 => 5,
                < 78 => 4,
                < 92 => 3,
                < 97 => 2,
                _ => 1
            };

            string comment = rating switch
            {
                >= 4 => GoodReviews[
                    random.Next(GoodReviews.Length)],

                3 => AverageReviews[
                    random.Next(AverageReviews.Length)],

                _ => BadReviews[
                    random.Next(BadReviews.Length)]
            };

            batch.Add(new Review
            {
                OrderId = row.Order.Id,
                ShopId = row.Order.ShopId,
                UserId = row.Order.UserId,

                ReviewerName =
                    names[row.Order.UserId],

                Rating = rating,
                Comment = comment,

                Status = "ACTIVE",

                CreatedAt =
                    row.Offer.PickupEndAt.AddHours(2)
            });

            if (batch.Count >= 200)
            {
                db.Reviews.AddRange(batch);
                await db.SaveChangesAsync(ct);

                db.ChangeTracker.Clear();
                batch.Clear();
            }
        }

        if (batch.Count > 0)
        {
            db.Reviews.AddRange(batch);
            await db.SaveChangesAsync(ct);
            db.ChangeTracker.Clear();
        }

        Console.WriteLine(
            $"[V4] Reviews: {completed.Count}");
    }

    #endregion

    #region 13 - REFUNDS

    private static async Task SeedRefundsAsync(
        SaviBiteDbContext db,
        List<SeedOrderRow> rows,
        Dictionary<Guid, Payment> payments,
        List<User> users,
        DateTime now,
        CancellationToken ct)
    {
        var requests = new List<RefundRequest>();
        var refundPayments = new List<RefundPayment>();

        var completed = rows
            .Where(x =>
                x.Order.Status == "COMPLETED" &&
                payments.ContainsKey(x.Order.Id))
            .OrderBy(x => x.Offer.PickupEndAt)
            .ToList();

        int sequence = 0;

        // ======================================
        // REFUND LỊCH SỬ
        // ======================================

        var historical = completed
            .Where(x =>
                x.Offer.PickupEndAt <
                now.AddDays(-2))
            .Where((_, index) =>
                index % 40 == 0)
            .Take(120)
            .ToList();

        foreach (var row in historical)
        {
            sequence++;

            bool accepted =
                sequence % 10 < 4;

            DateTime created =
                row.Offer.PickupEndAt.AddHours(1);

            DateTime resolved =
                created.AddHours(3);

            string status = accepted
                ? "REFUNDED"
                : "REJECTED";

            var request = NewRefundRequest(
                row,
                users[0].Id,
                created,
                status,
                sequence);

            request.ResolvedAt = resolved;

            requests.Add(request);

            if (accepted)
            {
                refundPayments.Add(new RefundPayment
                {
                    RefundRequestId =
                        request.Id,

                    OrderId = row.Order.Id,

                    PaymentId =
                        payments[row.Order.Id].Id,

                    Provider = "MOCK",
                    Status = "SUCCESS",

                    Amount =
                        row.Order.TotalAmount,

                    TransactionReference =
                        $"REF-V4-{sequence:D9}",

                    CreatedAt = resolved
                });
            }
        }

        // ======================================
        // REFUND GẦN HIỆN TẠI
        // ======================================

        var recent = completed
            .Where(x =>
                x.Offer.PickupEndAt >=
                now.AddHours(-20) &&
                x.Offer.PickupEndAt <=
                now.AddHours(-1))
            .Where(x =>
                !requests.Any(r =>
                    r.OrderId == x.Order.Id))
            .Take(8)
            .ToList();

        foreach (var row in recent)
        {
            sequence++;

            bool pending =
                sequence % 2 == 0;

            DateTime created =
                row.Offer.PickupEndAt.AddMinutes(45);

            var request = NewRefundRequest(
                row,
                users[0].Id,
                created,
                pending ? "PENDING" : "APPROVED",
                sequence);

            if (pending)
            {
                request.HandledByUserId = null;
                request.ResolutionNote = string.Empty;
                request.ResolvedAt = null;
            }
            else
            {
                request.ResolvedAt =
                    created.AddMinutes(30);
            }

            requests.Add(request);
        }

        db.RefundRequests.AddRange(requests);

        await db.SaveChangesAsync(ct);
        db.ChangeTracker.Clear();

        if (refundPayments.Count > 0)
        {
            db.RefundPayments
                .AddRange(refundPayments);

            await db.SaveChangesAsync(ct);
            db.ChangeTracker.Clear();
        }

        // ======================================
        // ĐỒNG BỘ ORDER VỚI REFUND
        // ======================================

        foreach (var refund in requests)
        {
            string orderStatus =
                refund.Status switch
                {
                    "REFUNDED" => "REFUNDED",

                    "PENDING" or "APPROVED" =>
                        "REFUND_REQUESTED",

                    _ => "COMPLETED"
                };

            string paymentStatus =
                refund.Status == "REFUNDED"
                    ? "REFUNDED"
                    : "PAID";

            await db.Orders
                .Where(x =>
                    x.Id == refund.OrderId)
                .ExecuteUpdateAsync(
                    update => update
                        .SetProperty(
                            x => x.Status,
                            orderStatus)
                        .SetProperty(
                            x => x.PaymentStatus,
                            paymentStatus)
                        .SetProperty(
                            x => x.UpdatedAt,
                            refund.ResolvedAt ??
                            refund.CreatedAt),
                    ct);
        }

        db.ChangeTracker.Clear();

        Console.WriteLine(
            $"[V4] RefundRequests: {requests.Count}");

        Console.WriteLine(
            $"[V4] RefundPayments: {refundPayments.Count}");
    }

    private static RefundRequest NewRefundRequest(
        SeedOrderRow row,
        Guid adminId,
        DateTime created,
        string status,
        int sequence)
    {
        bool accepted =
            status is "REFUNDED" or "APPROVED";

        return new RefundRequest
        {
            OrderId = row.Order.Id,
            ShopId = row.Order.ShopId,
            UserId = row.Order.UserId,

            RequestId = Guid.NewGuid(),

            RequestHash = Sha256(
                $"REFUND-{row.Order.OrderNumber}"),

            OrderNumber =
                row.Order.OrderNumber,

            ShopName =
                row.Order.ShopName,

            Reason = RefundReasons[
                sequence % RefundReasons.Length],

            RequestedAmount =
                row.Order.TotalAmount,

            ApprovedAmount = accepted
                ? row.Order.TotalAmount
                : null,

            Status = status,

            ResolutionNote = status switch
            {
                "REFUNDED" =>
                    "Đã hoàn tiền cho khách hàng.",

                "APPROVED" =>
                    "Yêu cầu hợp lệ, chờ hoàn tiền.",

                "REJECTED" =>
                    "Chưa đủ căn cứ chấp nhận hoàn tiền.",

                _ => string.Empty
            },

            HandledByUserId =
                status == "PENDING"
                    ? null
                    : adminId,

            CreatedAt = created,

            DeadlineAt =
                created.AddHours(24)
        };
    }

    #endregion

    #region 14 - AUDIT LOGS

    private static async Task SeedAuditLogsAsync(
        SaviBiteDbContext db,
        List<User> users,
        List<Shop> shops,
        CancellationToken ct)
    {
        var logs = new List<AuditLog>();

        foreach (var shop in shops)
        {
            if (shop.Status == "PENDING")
                continue;

            string action = shop.Status switch
            {
                "APPROVED" => "APPROVE_SHOP",
                "SUSPENDED" => "SUSPEND_SHOP",
                "REJECTED" => "REJECT_SHOP",
                _ => "UPDATE_SHOP"
            };

            logs.Add(new AuditLog
            {
                ActorUserId = users[0].Id,

                Action = action,
                TargetType = "SHOP",
                TargetId = shop.Id,

                OldValuesJson =
                    JsonSerializer.Serialize(
                        new { status = "PENDING" }),

                NewValuesJson =
                    JsonSerializer.Serialize(
                        new { status = shop.Status }),

                CreatedAt =
                    shop.CreatedAt.AddDays(1)
            });
        }

        foreach (var user in users.Where(
            x => x.Status == "LOCKED"))
        {
            logs.Add(new AuditLog
            {
                ActorUserId = users[0].Id,

                Action = "LOCK_USER",
                TargetType = "USER",
                TargetId = user.Id,

                OldValuesJson =
                    JsonSerializer.Serialize(
                        new { status = "ACTIVE" }),

                NewValuesJson =
                    JsonSerializer.Serialize(
                        new { status = "LOCKED" }),

                CreatedAt =
                    HistoryStart.AddDays(100)
            });
        }

        db.AuditLogs.AddRange(logs);

        await db.SaveChangesAsync(ct);
        db.ChangeTracker.Clear();

        Console.WriteLine(
            $"[V4] AuditLogs: {logs.Count}");
    }

    #endregion

    #region 15 - SHOP RATINGS

    private static async Task UpdateRatingsAsync(
        SaviBiteDbContext db,
        List<Shop> shops,
        CancellationToken ct)
    {
        var ratings = await db.Reviews
            .Where(x => x.Status == "ACTIVE")
            .GroupBy(x => x.ShopId)
            .Select(x => new
            {
                ShopId = x.Key,
                Average = x.Average(r => r.Rating)
            })
            .ToListAsync(ct);

        var lookup = ratings.ToDictionary(
            x => x.ShopId,
            x => Math.Round(
                (decimal)x.Average,
                2));

        foreach (var shop in shops)
        {
            decimal rating = lookup.TryGetValue(
                shop.Id,
                out decimal average)
                    ? average
                    : 0m;

            await db.Shops
                .Where(x => x.Id == shop.Id)
                .ExecuteUpdateAsync(
                    update => update.SetProperty(
                        x => x.AverageRating,
                        rating),
                    ct);
        }

        db.ChangeTracker.Clear();
    }

    #endregion

    #region 16 - VALIDATE DATABASE

    private static async Task ValidateAsync(
        SaviBiteDbContext db,
        CancellationToken ct)
    {
        int users =
            await db.Users.CountAsync(ct);

        int shops =
            await db.Shops.CountAsync(ct);

        int members =
            await db.ShopMembers.CountAsync(ct);

        int products =
            await db.Products.CountAsync(ct);

        int offers =
            await db.Offers.CountAsync(ct);

        int orders =
            await db.Orders.CountAsync(ct);

        int items =
            await db.OrderItems.CountAsync(ct);

        int reviews =
            await db.Reviews.CountAsync(ct);

        int payments =
            await db.Payments.CountAsync(ct);

        int boxes = await db.Offers.CountAsync(
            x => x.OfferType == "SAVIBITE_BOX" &&
                 x.Status == "ACTIVE",
            ct);

        int activeFlashSales =
            await db.Offers.CountAsync(
                x => x.OfferType == "FLASH_SALE" &&
                     x.Status == "ACTIVE",
                ct);

        if (users != UserCount ||
            shops != ShopCount ||
            members != ShopCount * 3 ||
            products != ShopCount * ProductsPerShop ||
            offers != HistoricalOfferCount +
                      CurrentOfferCount ||
            orders != OrderCount ||
            items != OrderCount ||
            reviews != ReviewCount ||
            boxes != 150 ||
            activeFlashSales != 450)
        {
            throw new InvalidOperationException(
                "Số lượng dữ liệu V4 không đúng cấu hình.");
        }

        bool invalidStock =
            await db.Offers.AnyAsync(
                x => x.AvailableQuantity < 0 ||
                     x.AvailableQuantity >
                     x.InitialQuantity,
                ct);

        bool invalidPrice =
            await db.OrderItems.AnyAsync(
                x => x.Quantity <= 0 ||
                     x.UnitPrice <= 0 ||
                     x.LineTotal !=
                     x.UnitPrice * x.Quantity,
                ct);

        bool invalidOrderTotal =
            await db.Orders.AnyAsync(
                order =>
                    order.TotalAmount !=
                    db.OrderItems
                        .Where(item =>
                            item.OrderId == order.Id)
                        .Sum(item => item.LineTotal),
                ct);

        bool invalidShop =
            await db.OrderItems
                .Join(
                    db.Orders,
                    item => item.OrderId,
                    order => order.Id,
                    (item, order) =>
                        new { item, order })
                .Join(
                    db.Offers,
                    x => x.item.OfferId,
                    offer => offer.Id,
                    (x, offer) => new
                    {
                        OrderShop = x.order.ShopId,
                        OfferShop = offer.ShopId
                    })
                .AnyAsync(
                    x => x.OrderShop != x.OfferShop,
                    ct);

        bool invalidOrderTime =
            await db.OrderItems
                .Join(
                    db.Orders,
                    item => item.OrderId,
                    order => order.Id,
                    (item, order) =>
                        new { item, order })
                .Join(
                    db.Offers,
                    x => x.item.OfferId,
                    offer => offer.Id,
                    (x, offer) => new
                    {
                        CreatedAt = x.order.CreatedAt,
                        Start = offer.SaleStartAt,
                        End = offer.SaleEndAt
                    })
                .AnyAsync(
                    x => x.CreatedAt < x.Start ||
                         x.CreatedAt >= x.End,
                    ct);

        bool invalidPayment =
            await db.Payments
                .Join(
                    db.Orders,
                    payment => payment.OrderId,
                    order => order.Id,
                    (payment, order) => new
                    {
                        payment.Amount,
                        order.TotalAmount
                    })
                .AnyAsync(
                    x => x.Amount != x.TotalAmount,
                    ct);

        if (invalidStock ||
            invalidPrice ||
            invalidOrderTotal ||
            invalidShop ||
            invalidOrderTime ||
            invalidPayment)
        {
            throw new InvalidOperationException(
                "Dữ liệu V4 không nhất quán về " +
                "tồn kho, giá, đơn hàng hoặc thanh toán.");
        }

        Console.WriteLine(
            "========================================");

        Console.WriteLine(
            "SAVIBITE DEVELOPMENT DATASET V4");

        Console.WriteLine($"Users:       {users}");
        Console.WriteLine($"Shops:       {shops}");
        Console.WriteLine($"ShopMembers: {members}");
        Console.WriteLine($"Products:    {products}");
        Console.WriteLine($"Offers:      {offers}");
        Console.WriteLine($"Active Flash:{activeFlashSales}");
        Console.WriteLine($"Active Boxes:{boxes}");
        Console.WriteLine($"Orders:      {orders}");
        Console.WriteLine($"OrderItems:  {items}");
        Console.WriteLine($"Payments:    {payments}");
        Console.WriteLine($"Reviews:     {reviews}");

        Console.WriteLine(
            "========================================");
    }

    #endregion

    #region 17 - HÀM HỖ TRỢ

    private static decimal RoundThousand(
        decimal value)
    {
        return Math.Round(
            value / 1000m,
            0,
            MidpointRounding.AwayFromZero
        ) * 1000m;
    }

    private static string Sha256(string input)
    {
        byte[] bytes =
            Encoding.UTF8.GetBytes(input);

        return Convert.ToHexString(
            SHA256.HashData(bytes))
            .ToLowerInvariant();
    }

    private static string Normalize(string input)
    {
        string normalized = input
            .Replace('đ', 'd')
            .Replace('Đ', 'D')
            .Normalize(NormalizationForm.FormD);

        var result = new StringBuilder();

        foreach (char c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c)
                == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            if (char.IsLetterOrDigit(c))
            {
                result.Append(
                    char.ToLowerInvariant(c));
            }
            else if (
                char.IsWhiteSpace(c) ||
                c == '.')
            {
                result.Append('.');
            }
        }

        return result.ToString()
            .Normalize(NormalizationForm.FormC);
    }

    #endregion
}
