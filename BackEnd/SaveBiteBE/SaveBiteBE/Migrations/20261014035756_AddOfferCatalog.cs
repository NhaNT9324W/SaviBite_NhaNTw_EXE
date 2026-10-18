using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SaveBiteBE.Migrations
{
    /// <inheritdoc />
    public partial class AddOfferCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "categories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    slug = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_categories", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "shops",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    phone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    latitude = table.Column<decimal>(type: "decimal(10,7)", precision: 10, scale: 7, nullable: true),
                    longitude = table.Column<decimal>(type: "decimal(10,7)", precision: 10, scale: 7, nullable: true),
                    logo_url = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    cover_url = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    average_rating = table.Column<decimal>(type: "decimal(3,2)", precision: 3, scale: 2, nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    deleted_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shops", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "products",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    shop_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    category_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    ingredients = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    allergy_info = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    storage_instruction = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    image_url = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    original_price = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    deleted_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_products", x => x.id);
                    table.CheckConstraint("ck_products_original_price", "[original_price] > 0");
                    table.ForeignKey(
                        name: "FK_products_categories_category_id",
                        column: x => x.category_id,
                        principalTable: "categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_products_shops_shop_id",
                        column: x => x.shop_id,
                        principalTable: "shops",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "offers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    shop_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    product_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    offer_type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    original_value = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    sale_price = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    initial_quantity = table.Column<int>(type: "int", nullable: false),
                    available_quantity = table.Column<int>(type: "int", nullable: false),
                    sale_start_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    sale_end_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    pickup_start_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    pickup_end_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    allergy_info = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    storage_instruction = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    image_url = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    deleted_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_offers", x => x.id);
                    table.CheckConstraint("ck_offers_flash_product", "[offer_type] <> 'FLASH_SALE' OR [product_id] IS NOT NULL");
                    table.CheckConstraint("ck_offers_pickup_time", "[pickup_start_at] < [pickup_end_at]");
                    table.CheckConstraint("ck_offers_price", "[sale_price] > 0 AND [sale_price] < [original_value]");
                    table.CheckConstraint("ck_offers_quantity", "[initial_quantity] >= 0 AND [available_quantity] >= 0 AND [available_quantity] <= [initial_quantity]");
                    table.CheckConstraint("ck_offers_sale_time", "[sale_start_at] < [sale_end_at]");
                    table.CheckConstraint("ck_offers_type", "[offer_type] IN ('FLASH_SALE', 'SAVIBITE_BOX')");
                    table.ForeignKey(
                        name: "FK_offers_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_offers_shops_shop_id",
                        column: x => x.shop_id,
                        principalTable: "shops",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_categories_slug",
                table: "categories",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_offers_product_id",
                table: "offers",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "IX_offers_shop_id",
                table: "offers",
                column: "shop_id");

            migrationBuilder.CreateIndex(
                name: "IX_offers_status_sale_end_at_id",
                table: "offers",
                columns: new[] { "status", "sale_end_at", "id" });

            migrationBuilder.CreateIndex(
                name: "IX_products_category_id",
                table: "products",
                column: "category_id");

            migrationBuilder.CreateIndex(
                name: "IX_products_shop_id",
                table: "products",
                column: "shop_id");

            migrationBuilder.CreateIndex(
                name: "IX_products_status",
                table: "products",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_shops_name",
                table: "shops",
                column: "name");

            migrationBuilder.CreateIndex(
                name: "IX_shops_status",
                table: "shops",
                column: "status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "offers");

            migrationBuilder.DropTable(
                name: "products");

            migrationBuilder.DropTable(
                name: "categories");

            migrationBuilder.DropTable(
                name: "shops");
        }
    }
}
