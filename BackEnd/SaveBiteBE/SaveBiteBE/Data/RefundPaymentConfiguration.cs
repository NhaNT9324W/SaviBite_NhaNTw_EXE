using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Data;

public sealed class RefundPaymentConfiguration
    : IEntityTypeConfiguration<RefundPayment>
{
    public void Configure(
        EntityTypeBuilder<RefundPayment> builder)
    {
        builder.ToTable("refund_payments", table =>
        {
            table.HasCheckConstraint(
                "ck_refund_payments_amount",
                "[amount] > 0");

            table.HasCheckConstraint(
                "ck_refund_payments_provider",
                "[provider] = 'MOCK'");

            table.HasCheckConstraint(
                "ck_refund_payments_status",
                "[status] = 'SUCCESS'");
        });

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnName("id");

        builder.Property(x => x.RefundRequestId)
            .HasColumnName("refund_request_id");

        builder.Property(x => x.OrderId)
            .HasColumnName("order_id");

        builder.Property(x => x.PaymentId)
            .HasColumnName("payment_id");

        builder.Property(x => x.Provider)
            .HasColumnName("provider")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(x => x.Status)
            .HasColumnName("status")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(x => x.Amount)
            .HasColumnName("amount")
            .HasPrecision(18, 2);

        builder.Property(x => x.TransactionReference)
            .HasColumnName("transaction_reference")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(x => x.CreatedAt)
            .HasColumnName("created_at");

        builder.HasOne(x => x.RefundRequest)
            .WithMany()
            .HasForeignKey(x => x.RefundRequestId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.Order)
            .WithMany()
            .HasForeignKey(x => x.OrderId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.Payment)
            .WithMany()
            .HasForeignKey(x => x.PaymentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => x.RefundRequestId)
            .IsUnique();

        // Phiên bản hiện tại: mỗi đơn chỉ hoàn thành công một lần.
        builder.HasIndex(x => x.OrderId)
            .IsUnique();

        builder.HasIndex(x => x.TransactionReference)
            .IsUnique();
    }
}