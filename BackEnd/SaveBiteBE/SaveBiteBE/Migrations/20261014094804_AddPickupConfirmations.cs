using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SaveBiteBE.Migrations
{
    /// <inheritdoc />
    public partial class AddPickupConfirmations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "pickup_confirmations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    shop_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    pickup_code = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: false),
                    issued_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    confirmed_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    confirmed_by_user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    confirmation_request_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pickup_confirmations", x => x.id);
                    table.CheckConstraint("ck_pickup_confirmation_fields", "([confirmed_at] IS NULL AND [confirmed_by_user_id] IS NULL AND [confirmation_request_id] IS NULL) OR ([confirmed_at] IS NOT NULL AND [confirmed_by_user_id] IS NOT NULL AND [confirmation_request_id] IS NOT NULL)");
                    table.ForeignKey(
                        name: "FK_pickup_confirmations_Orders_order_id",
                        column: x => x.order_id,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pickup_confirmations_shops_shop_id",
                        column: x => x.shop_id,
                        principalTable: "shops",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pickup_confirmations_users_confirmed_by_user_id",
                        column: x => x.confirmed_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_pickup_confirmations_confirmed_by_user_id",
                table: "pickup_confirmations",
                column: "confirmed_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_pickup_confirmations_shop_id",
                table: "pickup_confirmations",
                column: "shop_id");

            migrationBuilder.CreateIndex(
                name: "ux_pickup_confirmations_code",
                table: "pickup_confirmations",
                column: "pickup_code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_pickup_confirmations_order",
                table: "pickup_confirmations",
                column: "order_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "pickup_confirmations");
        }
    }
}
