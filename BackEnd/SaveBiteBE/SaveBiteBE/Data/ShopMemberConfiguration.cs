using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SaveBiteBE.Entities;

namespace SaveBiteBE.Data;

public class ShopMemberConfiguration
    : IEntityTypeConfiguration<ShopMember>
{
    public void Configure(
        EntityTypeBuilder<ShopMember> builder)
    {
        builder.ToTable("shop_members", table =>
        {
            table.HasCheckConstraint(
                "ck_shop_members_role",
                "[member_role] IN ('OWNER', 'STAFF')"
            );

            table.HasCheckConstraint(
                "ck_shop_members_status",
                "[status] IN ('ACTIVE', 'LOCKED')"
            );
        });

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnName("id");

        builder.Property(x => x.ShopId)
            .HasColumnName("shop_id");

        builder.Property(x => x.UserId)
            .HasColumnName("user_id");

        builder.Property(x => x.MemberRole)
            .HasColumnName("member_role")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(x => x.Status)
            .HasColumnName("status")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(x => x.JoinedAt)
            .HasColumnName("joined_at");

        builder.Property(x => x.DeletedAt)
            .HasColumnName("deleted_at");

        builder.HasOne(x => x.Shop)
            .WithMany()
            .HasForeignKey(x => x.ShopId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => new
        {
            x.ShopId,
            x.UserId
        })
            .IsUnique()
            .HasDatabaseName("ux_shop_members_shop_user");

        builder.HasIndex(x => x.UserId)
            .HasDatabaseName("ix_shop_members_user");
    }
}