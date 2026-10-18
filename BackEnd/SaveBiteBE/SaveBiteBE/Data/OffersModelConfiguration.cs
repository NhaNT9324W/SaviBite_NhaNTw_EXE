using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Data;

/// <summary>
/// Cấu hình các bảng cửa hàng, danh mục, sản phẩm và ưu đãi.
/// </summary>
public static class OffersModelConfiguration
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        ConfigureShop(modelBuilder);
        ConfigureCategory(modelBuilder);
        ConfigureProduct(modelBuilder);
        ConfigureOffer(modelBuilder);

        MapColumns<Shop>(modelBuilder);
        MapColumns<Category>(modelBuilder);
        MapColumns<Product>(modelBuilder);
        MapColumns<Offer>(modelBuilder);
    }

    private static void ConfigureShop(ModelBuilder modelBuilder)
    {
        var builder = modelBuilder.Entity<Shop>();

        builder.ToTable("shops");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Name)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(x => x.Description)
            .HasMaxLength(2000);

        builder.Property(x => x.Phone)
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(x => x.Address)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(x => x.Latitude)
            .HasPrecision(10, 7);

        builder.Property(x => x.Longitude)
            .HasPrecision(10, 7);

        builder.Property(x => x.LogoUrl)
            .HasMaxLength(2048);

        builder.Property(x => x.CoverUrl)
            .HasMaxLength(2048);

        builder.Property(x => x.Status)
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(x => x.AverageRating)
            .HasPrecision(3, 2);

        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.Name);
    }

    private static void ConfigureCategory(ModelBuilder modelBuilder)
    {
        var builder = modelBuilder.Entity<Category>();

        builder.ToTable("categories");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(x => x.Slug)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(x => x.Status)
            .HasMaxLength(20)
            .IsRequired();

        builder.HasIndex(x => x.Slug)
            .IsUnique();
    }

    private static void ConfigureProduct(ModelBuilder modelBuilder)
    {
        var builder = modelBuilder.Entity<Product>();

        builder.ToTable("products", table =>
        {
            table.HasCheckConstraint(
                "ck_products_original_price",
                "[original_price] > 0"
            );
        });

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Name)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(x => x.Description)
            .HasMaxLength(2000);

        builder.Property(x => x.Ingredients)
            .HasMaxLength(2000);

        builder.Property(x => x.AllergyInfo)
            .HasMaxLength(1000);

        builder.Property(x => x.StorageInstruction)
            .HasMaxLength(1000);

        builder.Property(x => x.ImageUrl)
            .HasMaxLength(2048);

        builder.Property(x => x.OriginalPrice)
            .HasPrecision(18, 2);

        builder.Property(x => x.Status)
            .HasMaxLength(20)
            .IsRequired();

        builder.HasOne(x => x.Shop)
            .WithMany()
            .HasForeignKey(x => x.ShopId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.Category)
            .WithMany()
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => x.Status);
    }

    private static void ConfigureOffer(ModelBuilder modelBuilder)
    {
        var builder = modelBuilder.Entity<Offer>();

        builder.ToTable("offers", table =>
        {
            table.HasCheckConstraint(
                "ck_offers_type",
                "[offer_type] IN ('FLASH_SALE', 'SAVIBITE_BOX')"
            );

            table.HasCheckConstraint(
                "ck_offers_price",
                "[sale_price] > 0 AND [sale_price] < [original_value]"
            );

            table.HasCheckConstraint(
                "ck_offers_quantity",
                "[initial_quantity] >= 0 " +
                "AND [available_quantity] >= 0 " +
                "AND [available_quantity] <= [initial_quantity]"
            );

            table.HasCheckConstraint(
                "ck_offers_sale_time",
                "[sale_start_at] < [sale_end_at]"
            );

            table.HasCheckConstraint(
                "ck_offers_pickup_time",
                "[pickup_start_at] < [pickup_end_at]"
            );

            table.HasCheckConstraint(
                "ck_offers_flash_product",
                "[offer_type] <> 'FLASH_SALE' OR [product_id] IS NOT NULL"
            );
        });

        builder.HasKey(x => x.Id);

        builder.Property(x => x.OfferType)
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(x => x.Title)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(x => x.Description)
            .HasMaxLength(2000);

        builder.Property(x => x.OriginalValue)
            .HasPrecision(18, 2);

        builder.Property(x => x.SalePrice)
            .HasPrecision(18, 2);

        builder.Property(x => x.AllergyInfo)
            .HasMaxLength(1000);

        builder.Property(x => x.StorageInstruction)
            .HasMaxLength(1000);

        builder.Property(x => x.ImageUrl)
            .HasMaxLength(2048);

        builder.Property(x => x.Status)
            .HasMaxLength(20)
            .IsRequired();

        builder.HasOne(x => x.Shop)
            .WithMany()
            .HasForeignKey(x => x.ShopId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.Product)
            .WithMany()
            .HasForeignKey(x => x.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => new
        {
            x.Status,
            x.SaleEndAt,
            x.Id
        });
    }

    private static void MapColumns<TEntity>(
        ModelBuilder modelBuilder)
        where TEntity : class
    {
        // Chỉ áp dụng cho 4 Entity mới của feature này.
        foreach (
            var property in modelBuilder
                .Entity<TEntity>()
                .Metadata
                .GetProperties()
        )
        {
            var columnName = Regex.Replace(
                property.Name,
                "([a-z0-9])([A-Z])",
                "$1_$2"
            ).ToLowerInvariant();

            property.SetColumnName(columnName);
        }
    }
}