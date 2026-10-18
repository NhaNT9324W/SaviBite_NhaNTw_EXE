using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SaveBiteBE.Migrations
{
    /// <inheritdoc />
    public partial class AddShopMemberSoftDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "deleted_at",
                table: "shop_members",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "deleted_at",
                table: "shop_members");
        }
    }
}
