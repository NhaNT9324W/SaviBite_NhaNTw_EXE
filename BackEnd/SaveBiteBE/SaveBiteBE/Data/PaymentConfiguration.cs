using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Data;

public sealed class PaymentConfiguration
    : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> payment)
    {
        payment.ToTable("payments", table =>
        {
            table.HasCheckConstraint(
                "ck_payments_status",
                "[status] IN ('SUCCESS', 'FAILED')");

            table.HasCheckConstraint(
                "ck_payments_amount",
                "[amount] > 0");

            table.HasCheckConstraint(
                "ck_payments_provider",
                "[provider] = 'MOCK'");
        });

        payment.HasKey(x => x.Id);

        payment.Property(x => x.Id)
            .HasColumnName("id");

        payment.Property(x => x.OrderId)
            .HasColumnName("order_id");

        payment.Property(x => x.RequestId)
            .HasColumnName("request_id");

        payment.Property(x => x.Provider)
            .HasColumnName("provider")
            .HasMaxLength(20)
            .IsRequired();

        payment.Property(x => x.Status)
            .HasColumnName("status")
            .HasMaxLength(20)
            .IsRequired();

        payment.Property(x => x.Amount)
            .HasColumnName("amount")
            .HasPrecision(18, 2);

        payment.Property(x => x.TransactionReference)
            .HasColumnName("transaction_reference")
            .HasMaxLength(50)
            .IsRequired();

        payment.Property(x => x.CreatedAt)
            .HasColumnName("created_at");

        // Một đơn chỉ có một kết quả thanh toán mô phỏng.
        payment.HasIndex(x => x.OrderId)
            .IsUnique()
            .HasDatabaseName("ux_payments_order");

        payment.HasIndex(x => x.TransactionReference)
            .IsUnique()
            .HasDatabaseName("ux_payments_reference");

        payment.HasOne(x => x.Order)
            .WithMany()
            .HasForeignKey(x => x.OrderId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}