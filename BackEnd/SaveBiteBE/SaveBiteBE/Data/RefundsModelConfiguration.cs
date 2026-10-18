using Microsoft.EntityFrameworkCore;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Data;

public static class RefundsModelConfiguration
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        var request = modelBuilder.Entity<RefundRequest>();

        request.ToTable("refund_requests", table =>
        {
            table.HasCheckConstraint(
                "ck_refund_requests_status",
                "[status] IN ('PENDING', 'APPROVED', 'REJECTED', 'REFUNDED')");

            table.HasCheckConstraint(
                "ck_refund_requests_amount",
                "[requested_amount] > 0");

            table.HasCheckConstraint(
                "ck_refund_requests_approved_amount",
                "[approved_amount] IS NULL OR " +
                "([approved_amount] >= 0 AND " +
                "[approved_amount] <= [requested_amount])");

            table.HasCheckConstraint(
                "ck_refund_requests_deadline",
                "[created_at] < [deadline_at]");
        });

        request.HasKey(x => x.Id);

        request.Property(x => x.Id).HasColumnName("id");
        request.Property(x => x.OrderId).HasColumnName("order_id");
        request.Property(x => x.ShopId).HasColumnName("shop_id");
        request.Property(x => x.UserId).HasColumnName("user_id");
        request.Property(x => x.RequestId).HasColumnName("request_id");

        request.Property(x => x.RequestHash)
            .HasColumnName("request_hash")
            .HasMaxLength(64)
            .IsRequired();

        request.Property(x => x.OrderNumber)
            .HasColumnName("order_number")
            .HasMaxLength(40)
            .IsRequired();

        request.Property(x => x.ShopName)
            .HasColumnName("shop_name")
            .HasMaxLength(200)
            .IsRequired();

        request.Property(x => x.Reason)
            .HasColumnName("reason")
            .HasMaxLength(2000)
            .IsRequired();

        request.Property(x => x.RequestedAmount)
            .HasColumnName("requested_amount")
            .HasPrecision(18, 2);

        request.Property(x => x.ApprovedAmount)
            .HasColumnName("approved_amount")
            .HasPrecision(18, 2);

        request.Property(x => x.Status)
            .HasColumnName("status")
            .HasMaxLength(20)
            .IsRequired();

        request.Property(x => x.ResolutionNote)
            .HasColumnName("resolution_note")
            .HasMaxLength(2000)
            .IsRequired();

        request.Property(x => x.HandledByUserId)
            .HasColumnName("handled_by_user_id");

        request.Property(x => x.CreatedAt)
            .HasColumnName("created_at");

        request.Property(x => x.DeadlineAt)
            .HasColumnName("deadline_at");

        request.Property(x => x.ResolvedAt)
            .HasColumnName("resolved_at");

        request.HasIndex(x => new { x.UserId, x.RequestId })
            .IsUnique()
            .HasDatabaseName("ux_refund_requests_user_request");

        request.HasIndex(x => x.OrderId)
            .IsUnique()
            .HasFilter("[status] = 'PENDING'")
            .HasDatabaseName("ux_refund_requests_pending_order");

        request.HasIndex(x => new { x.Status, x.CreatedAt })
            .HasDatabaseName("ix_refund_requests_status_created");

        request.HasOne(x => x.Order)
            .WithMany()
            .HasForeignKey(x => x.OrderId)
            .OnDelete(DeleteBehavior.Restrict);

        request.HasOne(x => x.Shop)
            .WithMany()
            .HasForeignKey(x => x.ShopId)
            .OnDelete(DeleteBehavior.Restrict);

        request.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        request.HasOne(x => x.HandledByUser)
            .WithMany()
            .HasForeignKey(x => x.HandledByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        var evidence = modelBuilder.Entity<RefundEvidence>();

        evidence.ToTable("refund_evidences");

        evidence.HasKey(x => x.Id);

        evidence.Property(x => x.Id)
            .HasColumnName("id");

        evidence.Property(x => x.RefundRequestId)
            .HasColumnName("refund_request_id");

        evidence.Property(x => x.StoredFileName)
            .HasColumnName("stored_file_name")
            .HasMaxLength(100)
            .IsRequired();

        evidence.Property(x => x.FileType)
            .HasColumnName("file_type")
            .HasMaxLength(30)
            .IsRequired();

        evidence.Property(x => x.FileSize)
            .HasColumnName("file_size");

        evidence.Property(x => x.CreatedAt)
            .HasColumnName("created_at");

        evidence.HasOne(x => x.RefundRequest)
            .WithMany(x => x.Evidences)
            .HasForeignKey(x => x.RefundRequestId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}