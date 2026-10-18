using Microsoft.EntityFrameworkCore;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Data;

public static class OrdersModelConfiguration
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        ConfigureOrder(modelBuilder);
        ConfigureOrderItem(modelBuilder);
    }

    private static void ConfigureOrder(ModelBuilder modelBuilder)
    {
        var order = modelBuilder.Entity<Order>();

        order.ToTable("orders", table =>
        {
            table.HasCheckConstraint(
    "ck_orders_status",
    "[status] IN (" +
    "'PENDING_PAYMENT', 'PAID', 'CONFIRMED', " +
    "'READY', 'READY_FOR_PICKUP', 'COMPLETED', " +
    "'CANCELLED', 'EXPIRED', " +
    "'REFUND_REQUESTED', 'REFUNDED')");

            table.HasCheckConstraint(
            "ck_orders_payment_status",
            "[payment_status] IN (" +
            "'UNPAID', 'PAID', 'FAILED', 'REFUNDED')");

            table.HasCheckConstraint(
                "ck_orders_total_amount",
                "[total_amount] > 0");

            table.HasCheckConstraint(
                "ck_orders_payment_expiry",
                "[payment_expires_at] > [created_at]");
        });

        order.HasKey(x => x.Id);

        order.Property(x => x.Id)
            .HasColumnName("id");

        order.Property(x => x.OrderNumber)
            .HasColumnName("order_number")
            .HasMaxLength(40)
            .IsRequired();

        order.Property(x => x.UserId)
            .HasColumnName("user_id");

        order.Property(x => x.ShopId)
            .HasColumnName("shop_id");

        order.Property(x => x.RequestId)
            .HasColumnName("request_id");

        order.Property(x => x.RequestHash)
            .HasColumnName("request_hash")
            .HasMaxLength(64)
            .IsRequired();

        order.Property(x => x.Status)
            .HasColumnName("status")
            .HasMaxLength(30)
            .IsRequired();

        order.Property(x => x.PaymentStatus)
            .HasColumnName("payment_status")
            .HasMaxLength(20)
            .IsRequired();

        order.Property(x => x.ReceiverName)
            .HasColumnName("receiver_name")
            .HasMaxLength(100)
            .IsRequired();

        order.Property(x => x.ReceiverPhone)
            .HasColumnName("receiver_phone")
            .HasMaxLength(20)
            .IsRequired();

        order.Property(x => x.Note)
            .HasColumnName("note")
            .HasMaxLength(1000)
            .IsRequired();

        order.Property(x => x.ShopName)
            .HasColumnName("shop_name")
            .HasMaxLength(200)
            .IsRequired();

        order.Property(x => x.ShopAddress)
            .HasColumnName("shop_address")
            .HasMaxLength(1000)
            .IsRequired();

        order.Property(x => x.TotalAmount)
            .HasColumnName("total_amount")
            .HasPrecision(18, 2);

        order.Property(x => x.PaymentExpiresAt)
            .HasColumnName("payment_expires_at");

        order.Property(x => x.CreatedAt)
            .HasColumnName("created_at");

        order.Property(x => x.UpdatedAt)
            .HasColumnName("updated_at");

        order.HasIndex(x => x.OrderNumber)
            .IsUnique()
            .HasDatabaseName("ux_orders_order_number");

        order.HasIndex(x => new
        {
            x.UserId,
            x.RequestId
        })
            .IsUnique()
            .HasDatabaseName("ux_orders_user_request");

        order.HasIndex(x => new
        {
            x.Status,
            x.PaymentExpiresAt
        })
            .HasDatabaseName("ix_orders_expiry");

        order.HasIndex(x => new
        {
            x.UserId,
            x.CreatedAt
        })
            .HasDatabaseName("ix_orders_user_created");

        order.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        order.HasOne(x => x.Shop)
            .WithMany()
            .HasForeignKey(x => x.ShopId)
            .OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigureOrderItem(
        ModelBuilder modelBuilder)
    {
        var item = modelBuilder.Entity<OrderItem>();

        item.ToTable("order_items", table =>
        {
            table.HasCheckConstraint(
                "ck_order_items_quantity",
                "[quantity] > 0");

            table.HasCheckConstraint(
                "ck_order_items_price",
                "[unit_price] > 0 AND [original_value] > 0");

            table.HasCheckConstraint(
                "ck_order_items_total",
                "[line_total] = [unit_price] * [quantity]");

            table.HasCheckConstraint(
                "ck_order_items_type",
                "[offer_type] IN ('FLASH_SALE', 'SAVIBITE_BOX')");

            table.HasCheckConstraint(
                "ck_order_items_pickup",
                "[pickup_start_at] < [pickup_end_at]");
        });

        item.HasKey(x => x.Id);

        item.Property(x => x.Id)
            .HasColumnName("id");

        item.Property(x => x.OrderId)
            .HasColumnName("order_id");

        item.Property(x => x.OfferId)
            .HasColumnName("offer_id");

        item.Property(x => x.OfferType)
            .HasColumnName("offer_type")
            .HasMaxLength(30)
            .IsRequired();

        item.Property(x => x.OfferTitle)
            .HasColumnName("offer_title")
            .HasMaxLength(200)
            .IsRequired();

        item.Property(x => x.ImageUrl)
            .HasColumnName("image_url")
            .HasMaxLength(2048);

        item.Property(x => x.OriginalValue)
            .HasColumnName("original_value")
            .HasPrecision(18, 2);

        item.Property(x => x.UnitPrice)
            .HasColumnName("unit_price")
            .HasPrecision(18, 2);

        item.Property(x => x.Quantity)
            .HasColumnName("quantity");

        item.Property(x => x.LineTotal)
            .HasColumnName("line_total")
            .HasPrecision(18, 2);

        item.Property(x => x.PickupStartAt)
            .HasColumnName("pickup_start_at");

        item.Property(x => x.PickupEndAt)
            .HasColumnName("pickup_end_at");

        item.Property(x => x.AllergyInfo)
            .HasColumnName("allergy_info")
            .HasMaxLength(1000)
            .IsRequired();

        item.Property(x => x.StorageInstruction)
            .HasColumnName("storage_instruction")
            .HasMaxLength(1000)
            .IsRequired();

        item.HasIndex(x => new
        {
            x.OrderId,
            x.OfferId
        })
            .IsUnique()
            .HasDatabaseName("ux_order_items_order_offer");

        item.HasOne(x => x.Order)
            .WithMany(x => x.Items)
            .HasForeignKey(x => x.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        item.HasOne(x => x.Offer)
            .WithMany()
            .HasForeignKey(x => x.OfferId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}