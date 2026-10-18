using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Data;

public sealed class AuditLogConfiguration
    : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> log)
    {
        log.ToTable("audit_logs");

        log.HasKey(x => x.Id);

        log.Property(x => x.Id)
            .HasColumnName("id");

        log.Property(x => x.ActorUserId)
            .HasColumnName("actor_user_id");

        log.Property(x => x.Action)
            .HasColumnName("action")
            .HasMaxLength(100)
            .IsRequired();

        log.Property(x => x.TargetType)
            .HasColumnName("target_type")
            .HasMaxLength(60)
            .IsRequired();

        log.Property(x => x.TargetId)
            .HasColumnName("target_id");

        log.Property(x => x.OldValuesJson)
            .HasColumnName("old_values_json")
            .IsRequired();

        log.Property(x => x.NewValuesJson)
            .HasColumnName("new_values_json")
            .IsRequired();

        log.Property(x => x.CreatedAt)
            .HasColumnName("created_at");

        log.HasIndex(x => new { x.Action, x.CreatedAt });

        log.HasOne(x => x.ActorUser)
            .WithMany()
            .HasForeignKey(x => x.ActorUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}