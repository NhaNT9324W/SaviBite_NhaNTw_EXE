using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Data;

public sealed class ReviewConfiguration
    : IEntityTypeConfiguration<Review>
{
    public void Configure(EntityTypeBuilder<Review> review)
    {
        review.ToTable("reviews", table =>
        {
            table.HasCheckConstraint(
                "ck_reviews_rating",
                "[rating] >= 1 AND [rating] <= 5");

            table.HasCheckConstraint(
                "ck_reviews_status",
                "[status] IN ('ACTIVE', 'HIDDEN')");
        });

        review.HasKey(x => x.Id);

        review.Property(x => x.Id)
            .HasColumnName("id");

        review.Property(x => x.OrderId)
            .HasColumnName("order_id");

        review.Property(x => x.ShopId)
            .HasColumnName("shop_id");

        review.Property(x => x.UserId)
            .HasColumnName("user_id");

        review.Property(x => x.Rating)
            .HasColumnName("rating");

        review.Property(x => x.Comment)
            .HasColumnName("comment")
            .HasMaxLength(1000)
            .IsRequired();

        review.Property(x => x.ReviewerName)
            .HasColumnName("reviewer_name")
            .HasMaxLength(100)
            .IsRequired();

        review.Property(x => x.Status)
            .HasColumnName("status")
            .HasMaxLength(20)
            .IsRequired();

        review.Property(x => x.CreatedAt)
            .HasColumnName("created_at");

        review.Property(x => x.DeletedAt)
            .HasColumnName("deleted_at");

        // Một đơn chỉ có một đánh giá.
        review.HasIndex(x => x.OrderId)
            .IsUnique()
            .HasDatabaseName("ux_reviews_order");

        review.HasIndex(x => new
        {
            x.ShopId,
            x.CreatedAt
        })
            .HasDatabaseName("ix_reviews_shop_created");

        review.HasOne(x => x.Order)
            .WithMany()
            .HasForeignKey(x => x.OrderId)
            .OnDelete(DeleteBehavior.Restrict);

        review.HasOne(x => x.Shop)
            .WithMany()
            .HasForeignKey(x => x.ShopId)
            .OnDelete(DeleteBehavior.Restrict);

        review.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}