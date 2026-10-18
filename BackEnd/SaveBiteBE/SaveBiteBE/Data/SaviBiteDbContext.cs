using Microsoft.EntityFrameworkCore;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Data;

/// <summary>
/// Quản lý kết nối và cấu hình dữ liệu SaviBite bằng EF Core.
/// </summary>
public class SaviBiteDbContext : DbContext
{
    public SaviBiteDbContext(
        DbContextOptions<SaviBiteDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();

    public DbSet<RefreshToken> RefreshTokens =>
        Set<RefreshToken>();

    public DbSet<Shop> Shops => Set<Shop>();

    public DbSet<Category> Categories => Set<Category>();

    public DbSet<Product> Products => Set<Product>();

    public DbSet<Offer> Offers => Set<Offer>();

    public DbSet<ShopMember> ShopMembers =>
        Set<ShopMember>();

    public DbSet<Order> Orders => Set<Order>();

    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<Payment> Payments => Set<Payment>();

    public DbSet<PickupConfirmation> PickupConfirmations =>
    Set<PickupConfirmation>();

    public DbSet<Review> Reviews => Set<Review>();

    public DbSet<RefundRequest> RefundRequests =>
    Set<RefundRequest>();

    public DbSet<RefundEvidence> RefundEvidences =>
        Set<RefundEvidence>();

    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    public DbSet<RefundPayment> RefundPayments =>
    Set<RefundPayment>();

    protected override void OnModelCreating(
        ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        var user = modelBuilder.Entity<User>();

        user.ToTable("users");

        user.HasKey(x => x.Id);

        user.Property(x => x.Id)
            .HasColumnName("id");

        user.Property(x => x.Email)
            .HasColumnName("email")
            .HasMaxLength(254)
            .IsRequired();

        user.Property(x => x.Phone)
            .HasColumnName("phone")
            .HasMaxLength(20)
            .IsRequired();

        user.Property(x => x.PasswordHash)
            .HasColumnName("password_hash")
            .HasMaxLength(512)
            .IsRequired();

        user.Property(x => x.FullName)
            .HasColumnName("full_name")
            .HasMaxLength(100)
            .IsRequired();

        user.Property(x => x.AvatarUrl)
            .HasColumnName("avatar_url")
            .HasMaxLength(2048);

        user.Property(x => x.SystemRole)
            .HasColumnName("system_role")
            .HasMaxLength(20)
            .IsRequired();

        user.Property(x => x.Status)
            .HasColumnName("status")
            .HasMaxLength(20)
            .IsRequired();

        user.Property(x => x.CreatedAt)
            .HasColumnName("created_at");

        user.Property(x => x.UpdatedAt)
            .HasColumnName("updated_at");

        user.Property(x => x.DeletedAt)
            .HasColumnName("deleted_at");

        user.HasIndex(x => x.Email)
            .IsUnique()
            .HasDatabaseName("ux_users_email");

        user.HasIndex(x => x.Phone)
            .IsUnique()
            .HasDatabaseName("ux_users_phone");

        // Cấu hình sản phẩm và ưu đãi.
        OffersModelConfiguration.Configure(modelBuilder);

        // Cấu hình đơn hàng và chi tiết đơn hàng.
        OrdersModelConfiguration.Configure(modelBuilder);

        // Cấu hình thanh toán.
        modelBuilder.ApplyConfiguration(
            new PaymentConfiguration());

        RefundsModelConfiguration.Configure(modelBuilder);

        modelBuilder.ApplyConfiguration(
            new AuditLogConfiguration());

        modelBuilder.ApplyConfiguration(
    new PickupConfirmationConfiguration());

        modelBuilder.ApplyConfiguration(
            new RefreshTokenConfiguration());

        modelBuilder.ApplyConfiguration(
            new ShopMemberConfiguration());

        modelBuilder.ApplyConfiguration(
    new ReviewConfiguration());

        modelBuilder.ApplyConfiguration(
    new RefundPaymentConfiguration());
    }
}