using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Data;

public sealed class PickupConfirmationConfiguration
    : IEntityTypeConfiguration<PickupConfirmation>
{
    public void Configure(
        EntityTypeBuilder<PickupConfirmation> pickup)
    {
        pickup.ToTable("pickup_confirmations", table =>
        {
            table.HasCheckConstraint(
                "ck_pickup_confirmation_fields",
                "(" +
                "[confirmed_at] IS NULL AND " +
                "[confirmed_by_user_id] IS NULL AND " +
                "[confirmation_request_id] IS NULL" +
                ") OR (" +
                "[confirmed_at] IS NOT NULL AND " +
                "[confirmed_by_user_id] IS NOT NULL AND " +
                "[confirmation_request_id] IS NOT NULL" +
                ")");
        });

        pickup.HasKey(x => x.Id);

        pickup.Property(x => x.Id)
            .HasColumnName("id");

        pickup.Property(x => x.OrderId)
            .HasColumnName("order_id");

        pickup.Property(x => x.ShopId)
            .HasColumnName("shop_id");

        pickup.Property(x => x.PickupCode)
            .HasColumnName("pickup_code")
            .HasMaxLength(12)
            .IsRequired();

        pickup.Property(x => x.IssuedAt)
            .HasColumnName("issued_at");

        pickup.Property(x => x.ConfirmedAt)
            .HasColumnName("confirmed_at");

        pickup.Property(x => x.ConfirmedByUserId)
            .HasColumnName("confirmed_by_user_id");

        pickup.Property(x => x.ConfirmationRequestId)
            .HasColumnName("confirmation_request_id");

        pickup.HasIndex(x => x.OrderId)
            .IsUnique()
            .HasDatabaseName("ux_pickup_confirmations_order");

        pickup.HasIndex(x => x.PickupCode)
            .IsUnique()
            .HasDatabaseName("ux_pickup_confirmations_code");

        pickup.HasOne(x => x.Order)
            .WithMany()
            .HasForeignKey(x => x.OrderId)
            .OnDelete(DeleteBehavior.Restrict);

        pickup.HasOne(x => x.Shop)
            .WithMany()
            .HasForeignKey(x => x.ShopId)
            .OnDelete(DeleteBehavior.Restrict);

        pickup.HasOne(x => x.ConfirmedByUser)
            .WithMany()
            .HasForeignKey(x => x.ConfirmedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}