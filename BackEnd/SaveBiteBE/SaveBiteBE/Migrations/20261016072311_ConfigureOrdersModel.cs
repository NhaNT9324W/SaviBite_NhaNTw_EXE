using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SaveBiteBE.Migrations
{
    /// <inheritdoc />
    public partial class ConfigureOrdersModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OrderItems_Orders_OrderId",
                table: "OrderItems");

            migrationBuilder.DropForeignKey(
                name: "FK_OrderItems_offers_OfferId",
                table: "OrderItems");

            migrationBuilder.DropForeignKey(
                name: "FK_Orders_shops_ShopId",
                table: "Orders");

            migrationBuilder.DropForeignKey(
                name: "FK_Orders_users_UserId",
                table: "Orders");

            migrationBuilder.DropForeignKey(
                name: "FK_payments_Orders_order_id",
                table: "payments");

            migrationBuilder.DropForeignKey(
                name: "FK_pickup_confirmations_Orders_order_id",
                table: "pickup_confirmations");

            migrationBuilder.DropForeignKey(
                name: "FK_refund_payments_Orders_order_id",
                table: "refund_payments");

            migrationBuilder.DropForeignKey(
                name: "FK_refund_requests_Orders_order_id",
                table: "refund_requests");

            migrationBuilder.DropForeignKey(
                name: "FK_reviews_Orders_order_id",
                table: "reviews");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Orders",
                table: "Orders");

            migrationBuilder.DropIndex(
                name: "IX_Orders_UserId",
                table: "Orders");

            migrationBuilder.DropPrimaryKey(
                name: "PK_OrderItems",
                table: "OrderItems");

            migrationBuilder.DropIndex(
                name: "IX_OrderItems_OrderId",
                table: "OrderItems");

            migrationBuilder.RenameTable(
                name: "Orders",
                newName: "orders");

            migrationBuilder.RenameTable(
                name: "OrderItems",
                newName: "order_items");

            migrationBuilder.RenameColumn(
                name: "Status",
                table: "orders",
                newName: "status");

            migrationBuilder.RenameColumn(
                name: "Note",
                table: "orders",
                newName: "note");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "orders",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "orders",
                newName: "user_id");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "orders",
                newName: "updated_at");

            migrationBuilder.RenameColumn(
                name: "TotalAmount",
                table: "orders",
                newName: "total_amount");

            migrationBuilder.RenameColumn(
                name: "ShopName",
                table: "orders",
                newName: "shop_name");

            migrationBuilder.RenameColumn(
                name: "ShopId",
                table: "orders",
                newName: "shop_id");

            migrationBuilder.RenameColumn(
                name: "ShopAddress",
                table: "orders",
                newName: "shop_address");

            migrationBuilder.RenameColumn(
                name: "RequestId",
                table: "orders",
                newName: "request_id");

            migrationBuilder.RenameColumn(
                name: "RequestHash",
                table: "orders",
                newName: "request_hash");

            migrationBuilder.RenameColumn(
                name: "ReceiverPhone",
                table: "orders",
                newName: "receiver_phone");

            migrationBuilder.RenameColumn(
                name: "ReceiverName",
                table: "orders",
                newName: "receiver_name");

            migrationBuilder.RenameColumn(
                name: "PaymentStatus",
                table: "orders",
                newName: "payment_status");

            migrationBuilder.RenameColumn(
                name: "PaymentExpiresAt",
                table: "orders",
                newName: "payment_expires_at");

            migrationBuilder.RenameColumn(
                name: "OrderNumber",
                table: "orders",
                newName: "order_number");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "orders",
                newName: "created_at");

            migrationBuilder.RenameIndex(
                name: "IX_Orders_ShopId",
                table: "orders",
                newName: "IX_orders_shop_id");

            migrationBuilder.RenameColumn(
                name: "Quantity",
                table: "order_items",
                newName: "quantity");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "order_items",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "UnitPrice",
                table: "order_items",
                newName: "unit_price");

            migrationBuilder.RenameColumn(
                name: "StorageInstruction",
                table: "order_items",
                newName: "storage_instruction");

            migrationBuilder.RenameColumn(
                name: "PickupStartAt",
                table: "order_items",
                newName: "pickup_start_at");

            migrationBuilder.RenameColumn(
                name: "PickupEndAt",
                table: "order_items",
                newName: "pickup_end_at");

            migrationBuilder.RenameColumn(
                name: "OriginalValue",
                table: "order_items",
                newName: "original_value");

            migrationBuilder.RenameColumn(
                name: "OrderId",
                table: "order_items",
                newName: "order_id");

            migrationBuilder.RenameColumn(
                name: "OfferType",
                table: "order_items",
                newName: "offer_type");

            migrationBuilder.RenameColumn(
                name: "OfferTitle",
                table: "order_items",
                newName: "offer_title");

            migrationBuilder.RenameColumn(
                name: "OfferId",
                table: "order_items",
                newName: "offer_id");

            migrationBuilder.RenameColumn(
                name: "LineTotal",
                table: "order_items",
                newName: "line_total");

            migrationBuilder.RenameColumn(
                name: "ImageUrl",
                table: "order_items",
                newName: "image_url");

            migrationBuilder.RenameColumn(
                name: "AllergyInfo",
                table: "order_items",
                newName: "allergy_info");

            migrationBuilder.RenameIndex(
                name: "IX_OrderItems_OfferId",
                table: "order_items",
                newName: "IX_order_items_offer_id");

            migrationBuilder.AlterColumn<string>(
                name: "status",
                table: "orders",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "note",
                table: "orders",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "shop_name",
                table: "orders",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "shop_address",
                table: "orders",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "request_hash",
                table: "orders",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "receiver_phone",
                table: "orders",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "receiver_name",
                table: "orders",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "payment_status",
                table: "orders",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "order_number",
                table: "orders",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "storage_instruction",
                table: "order_items",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "offer_type",
                table: "order_items",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "offer_title",
                table: "order_items",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "image_url",
                table: "order_items",
                type: "nvarchar(2048)",
                maxLength: 2048,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "allergy_info",
                table: "order_items",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddPrimaryKey(
                name: "PK_orders",
                table: "orders",
                column: "id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_order_items",
                table: "order_items",
                column: "id");

            migrationBuilder.CreateIndex(
                name: "ix_orders_expiry",
                table: "orders",
                columns: new[] { "status", "payment_expires_at" });

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

            migrationBuilder.AddCheckConstraint(
                name: "ck_orders_payment_expiry",
                table: "orders",
                sql: "[payment_expires_at] > [created_at]");

            migrationBuilder.AddCheckConstraint(
                name: "ck_orders_payment_status",
                table: "orders",
                sql: "[payment_status] IN ('UNPAID', 'PAID', 'FAILED', 'REFUNDED')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_orders_status",
                table: "orders",
                sql: "[status] IN ('PENDING_PAYMENT', 'PAID', 'CONFIRMED', 'READY', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUND_REQUESTED', 'REFUNDED')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_orders_total_amount",
                table: "orders",
                sql: "[total_amount] > 0");

            migrationBuilder.CreateIndex(
                name: "ux_order_items_order_offer",
                table: "order_items",
                columns: new[] { "order_id", "offer_id" },
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_order_items_pickup",
                table: "order_items",
                sql: "[pickup_start_at] < [pickup_end_at]");

            migrationBuilder.AddCheckConstraint(
                name: "ck_order_items_price",
                table: "order_items",
                sql: "[unit_price] > 0 AND [original_value] > 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_order_items_quantity",
                table: "order_items",
                sql: "[quantity] > 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_order_items_total",
                table: "order_items",
                sql: "[line_total] = [unit_price] * [quantity]");

            migrationBuilder.AddCheckConstraint(
                name: "ck_order_items_type",
                table: "order_items",
                sql: "[offer_type] IN ('FLASH_SALE', 'SAVIBITE_BOX')");

            migrationBuilder.AddForeignKey(
                name: "FK_order_items_offers_offer_id",
                table: "order_items",
                column: "offer_id",
                principalTable: "offers",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_order_items_orders_order_id",
                table: "order_items",
                column: "order_id",
                principalTable: "orders",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_orders_shops_shop_id",
                table: "orders",
                column: "shop_id",
                principalTable: "shops",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_orders_users_user_id",
                table: "orders",
                column: "user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_payments_orders_order_id",
                table: "payments",
                column: "order_id",
                principalTable: "orders",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pickup_confirmations_orders_order_id",
                table: "pickup_confirmations",
                column: "order_id",
                principalTable: "orders",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_refund_payments_orders_order_id",
                table: "refund_payments",
                column: "order_id",
                principalTable: "orders",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_refund_requests_orders_order_id",
                table: "refund_requests",
                column: "order_id",
                principalTable: "orders",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_reviews_orders_order_id",
                table: "reviews",
                column: "order_id",
                principalTable: "orders",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_order_items_offers_offer_id",
                table: "order_items");

            migrationBuilder.DropForeignKey(
                name: "FK_order_items_orders_order_id",
                table: "order_items");

            migrationBuilder.DropForeignKey(
                name: "FK_orders_shops_shop_id",
                table: "orders");

            migrationBuilder.DropForeignKey(
                name: "FK_orders_users_user_id",
                table: "orders");

            migrationBuilder.DropForeignKey(
                name: "FK_payments_orders_order_id",
                table: "payments");

            migrationBuilder.DropForeignKey(
                name: "FK_pickup_confirmations_orders_order_id",
                table: "pickup_confirmations");

            migrationBuilder.DropForeignKey(
                name: "FK_refund_payments_orders_order_id",
                table: "refund_payments");

            migrationBuilder.DropForeignKey(
                name: "FK_refund_requests_orders_order_id",
                table: "refund_requests");

            migrationBuilder.DropForeignKey(
                name: "FK_reviews_orders_order_id",
                table: "reviews");

            migrationBuilder.DropPrimaryKey(
                name: "PK_orders",
                table: "orders");

            migrationBuilder.DropIndex(
                name: "ix_orders_expiry",
                table: "orders");

            migrationBuilder.DropIndex(
                name: "ix_orders_user_created",
                table: "orders");

            migrationBuilder.DropIndex(
                name: "ux_orders_order_number",
                table: "orders");

            migrationBuilder.DropIndex(
                name: "ux_orders_user_request",
                table: "orders");

            migrationBuilder.DropCheckConstraint(
                name: "ck_orders_payment_expiry",
                table: "orders");

            migrationBuilder.DropCheckConstraint(
                name: "ck_orders_payment_status",
                table: "orders");

            migrationBuilder.DropCheckConstraint(
                name: "ck_orders_status",
                table: "orders");

            migrationBuilder.DropCheckConstraint(
                name: "ck_orders_total_amount",
                table: "orders");

            migrationBuilder.DropPrimaryKey(
                name: "PK_order_items",
                table: "order_items");

            migrationBuilder.DropIndex(
                name: "ux_order_items_order_offer",
                table: "order_items");

            migrationBuilder.DropCheckConstraint(
                name: "ck_order_items_pickup",
                table: "order_items");

            migrationBuilder.DropCheckConstraint(
                name: "ck_order_items_price",
                table: "order_items");

            migrationBuilder.DropCheckConstraint(
                name: "ck_order_items_quantity",
                table: "order_items");

            migrationBuilder.DropCheckConstraint(
                name: "ck_order_items_total",
                table: "order_items");

            migrationBuilder.DropCheckConstraint(
                name: "ck_order_items_type",
                table: "order_items");

            migrationBuilder.RenameTable(
                name: "orders",
                newName: "Orders");

            migrationBuilder.RenameTable(
                name: "order_items",
                newName: "OrderItems");

            migrationBuilder.RenameColumn(
                name: "status",
                table: "Orders",
                newName: "Status");

            migrationBuilder.RenameColumn(
                name: "note",
                table: "Orders",
                newName: "Note");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "Orders",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "user_id",
                table: "Orders",
                newName: "UserId");

            migrationBuilder.RenameColumn(
                name: "updated_at",
                table: "Orders",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "total_amount",
                table: "Orders",
                newName: "TotalAmount");

            migrationBuilder.RenameColumn(
                name: "shop_name",
                table: "Orders",
                newName: "ShopName");

            migrationBuilder.RenameColumn(
                name: "shop_id",
                table: "Orders",
                newName: "ShopId");

            migrationBuilder.RenameColumn(
                name: "shop_address",
                table: "Orders",
                newName: "ShopAddress");

            migrationBuilder.RenameColumn(
                name: "request_id",
                table: "Orders",
                newName: "RequestId");

            migrationBuilder.RenameColumn(
                name: "request_hash",
                table: "Orders",
                newName: "RequestHash");

            migrationBuilder.RenameColumn(
                name: "receiver_phone",
                table: "Orders",
                newName: "ReceiverPhone");

            migrationBuilder.RenameColumn(
                name: "receiver_name",
                table: "Orders",
                newName: "ReceiverName");

            migrationBuilder.RenameColumn(
                name: "payment_status",
                table: "Orders",
                newName: "PaymentStatus");

            migrationBuilder.RenameColumn(
                name: "payment_expires_at",
                table: "Orders",
                newName: "PaymentExpiresAt");

            migrationBuilder.RenameColumn(
                name: "order_number",
                table: "Orders",
                newName: "OrderNumber");

            migrationBuilder.RenameColumn(
                name: "created_at",
                table: "Orders",
                newName: "CreatedAt");

            migrationBuilder.RenameIndex(
                name: "IX_orders_shop_id",
                table: "Orders",
                newName: "IX_Orders_ShopId");

            migrationBuilder.RenameColumn(
                name: "quantity",
                table: "OrderItems",
                newName: "Quantity");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "OrderItems",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "unit_price",
                table: "OrderItems",
                newName: "UnitPrice");

            migrationBuilder.RenameColumn(
                name: "storage_instruction",
                table: "OrderItems",
                newName: "StorageInstruction");

            migrationBuilder.RenameColumn(
                name: "pickup_start_at",
                table: "OrderItems",
                newName: "PickupStartAt");

            migrationBuilder.RenameColumn(
                name: "pickup_end_at",
                table: "OrderItems",
                newName: "PickupEndAt");

            migrationBuilder.RenameColumn(
                name: "original_value",
                table: "OrderItems",
                newName: "OriginalValue");

            migrationBuilder.RenameColumn(
                name: "order_id",
                table: "OrderItems",
                newName: "OrderId");

            migrationBuilder.RenameColumn(
                name: "offer_type",
                table: "OrderItems",
                newName: "OfferType");

            migrationBuilder.RenameColumn(
                name: "offer_title",
                table: "OrderItems",
                newName: "OfferTitle");

            migrationBuilder.RenameColumn(
                name: "offer_id",
                table: "OrderItems",
                newName: "OfferId");

            migrationBuilder.RenameColumn(
                name: "line_total",
                table: "OrderItems",
                newName: "LineTotal");

            migrationBuilder.RenameColumn(
                name: "image_url",
                table: "OrderItems",
                newName: "ImageUrl");

            migrationBuilder.RenameColumn(
                name: "allergy_info",
                table: "OrderItems",
                newName: "AllergyInfo");

            migrationBuilder.RenameIndex(
                name: "IX_order_items_offer_id",
                table: "OrderItems",
                newName: "IX_OrderItems_OfferId");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(30)",
                oldMaxLength: 30);

            migrationBuilder.AlterColumn<string>(
                name: "Note",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(1000)",
                oldMaxLength: 1000);

            migrationBuilder.AlterColumn<string>(
                name: "ShopName",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(200)",
                oldMaxLength: 200);

            migrationBuilder.AlterColumn<string>(
                name: "ShopAddress",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(1000)",
                oldMaxLength: 1000);

            migrationBuilder.AlterColumn<string>(
                name: "RequestHash",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(64)",
                oldMaxLength: 64);

            migrationBuilder.AlterColumn<string>(
                name: "ReceiverPhone",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(20)",
                oldMaxLength: 20);

            migrationBuilder.AlterColumn<string>(
                name: "ReceiverName",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<string>(
                name: "PaymentStatus",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(20)",
                oldMaxLength: 20);

            migrationBuilder.AlterColumn<string>(
                name: "OrderNumber",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(40)",
                oldMaxLength: 40);

            migrationBuilder.AlterColumn<string>(
                name: "StorageInstruction",
                table: "OrderItems",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(1000)",
                oldMaxLength: 1000);

            migrationBuilder.AlterColumn<string>(
                name: "OfferType",
                table: "OrderItems",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(30)",
                oldMaxLength: 30);

            migrationBuilder.AlterColumn<string>(
                name: "OfferTitle",
                table: "OrderItems",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(200)",
                oldMaxLength: 200);

            migrationBuilder.AlterColumn<string>(
                name: "ImageUrl",
                table: "OrderItems",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(2048)",
                oldMaxLength: 2048,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "AllergyInfo",
                table: "OrderItems",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(1000)",
                oldMaxLength: 1000);

            migrationBuilder.AddPrimaryKey(
                name: "PK_Orders",
                table: "Orders",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_OrderItems",
                table: "OrderItems",
                column: "Id");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_UserId",
                table: "Orders",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderItems_OrderId",
                table: "OrderItems",
                column: "OrderId");

            migrationBuilder.AddForeignKey(
                name: "FK_OrderItems_Orders_OrderId",
                table: "OrderItems",
                column: "OrderId",
                principalTable: "Orders",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_OrderItems_offers_OfferId",
                table: "OrderItems",
                column: "OfferId",
                principalTable: "offers",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Orders_shops_ShopId",
                table: "Orders",
                column: "ShopId",
                principalTable: "shops",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Orders_users_UserId",
                table: "Orders",
                column: "UserId",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_payments_Orders_order_id",
                table: "payments",
                column: "order_id",
                principalTable: "Orders",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pickup_confirmations_Orders_order_id",
                table: "pickup_confirmations",
                column: "order_id",
                principalTable: "Orders",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_refund_payments_Orders_order_id",
                table: "refund_payments",
                column: "order_id",
                principalTable: "Orders",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_refund_requests_Orders_order_id",
                table: "refund_requests",
                column: "order_id",
                principalTable: "Orders",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_reviews_Orders_order_id",
                table: "reviews",
                column: "order_id",
                principalTable: "Orders",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
