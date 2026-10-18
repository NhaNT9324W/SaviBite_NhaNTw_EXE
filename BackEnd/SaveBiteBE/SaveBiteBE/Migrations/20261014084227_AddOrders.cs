using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SaveBiteBE.Migrations
{
    /// <inheritdoc />
    public partial class AddOrders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "orders",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    order_number = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    shop_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    request_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    request_hash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    payment_status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    receiver_name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    receiver_phone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    note = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    shop_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    shop_address = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    total_amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    payment_expires_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_orders", x => x.id);
                    table.CheckConstraint("ck_orders_payment_expiry", "[payment_expires_at] > [created_at]");
                    table.CheckConstraint("ck_orders_payment_status", "[payment_status] IN ('UNPAID', 'PAID', 'REFUNDED')");
                    table.CheckConstraint("ck_orders_status", "[status] IN ('PENDING_PAYMENT', 'CONFIRMED', 'READY', 'COMPLETED', 'CANCELLED', 'EXPIRED')");
                    table.CheckConstraint("ck_orders_total_amount", "[total_amount] > 0");
                    table.ForeignKey(
                        name: "FK_orders_shops_shop_id",
                        column: x => x.shop_id,
                        principalTable: "shops",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_orders_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "order_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    offer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    offer_type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    offer_title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    image_url = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    original_value = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    unit_price = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    quantity = table.Column<int>(type: "int", nullable: false),
                    line_total = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    pickup_start_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    pickup_end_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    allergy_info = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    storage_instruction = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_items", x => x.id);
                    table.CheckConstraint("ck_order_items_pickup", "[pickup_start_at] < [pickup_end_at]");
                    table.CheckConstraint("ck_order_items_price", "[unit_price] > 0 AND [original_value] > 0");
                    table.CheckConstraint("ck_order_items_quantity", "[quantity] > 0");
                    table.CheckConstraint("ck_order_items_total", "[line_total] = [unit_price] * [quantity]");
                    table.CheckConstraint("ck_order_items_type", "[offer_type] IN ('FLASH_SALE', 'SAVIBITE_BOX')");
                    table.ForeignKey(
                        name: "FK_order_items_offers_offer_id",
                        column: x => x.offer_id,
                        principalTable: "offers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_order_items_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_order_items_offer_id",
                table: "order_items",
                column: "offer_id");

            migrationBuilder.CreateIndex(
                name: "ux_order_items_order_offer",
                table: "order_items",
                columns: new[] { "order_id", "offer_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_orders_expiry",
                table: "orders",
                columns: new[] { "status", "payment_expires_at" });

            migrationBuilder.CreateIndex(
                name: "IX_orders_shop_id",
                table: "orders",
                column: "shop_id");

            migrationBuilder.CreateIndex(
                name: "ix_orders_user_created",
                table: "orders",
                columns: new[] { "user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ux_orders_order_number",
                table: "orders",
                column: "order_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_orders_user_request",
                table: "orders",
                columns: new[] { "user_id", "request_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "order_items");

            migrationBuilder.DropTable(
                name: "orders");
        }
    }
}
