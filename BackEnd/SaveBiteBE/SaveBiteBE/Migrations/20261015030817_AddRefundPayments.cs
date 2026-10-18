using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SaveBiteBE.Migrations
{
    /// <inheritdoc />
    public partial class AddRefundPayments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "refund_payments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    refund_request_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    payment_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    provider = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    transaction_reference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refund_payments", x => x.id);
                    table.CheckConstraint("ck_refund_payments_amount", "[amount] > 0");
                    table.CheckConstraint("ck_refund_payments_provider", "[provider] = 'MOCK'");
                    table.CheckConstraint("ck_refund_payments_status", "[status] = 'SUCCESS'");
                    table.ForeignKey(
                        name: "FK_refund_payments_Orders_order_id",
                        column: x => x.order_id,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_refund_payments_payments_payment_id",
                        column: x => x.payment_id,
                        principalTable: "payments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_refund_payments_refund_requests_refund_request_id",
                        column: x => x.refund_request_id,
                        principalTable: "refund_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_refund_payments_order_id",
                table: "refund_payments",
                column: "order_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_refund_payments_payment_id",
                table: "refund_payments",
                column: "payment_id");

            migrationBuilder.CreateIndex(
                name: "IX_refund_payments_refund_request_id",
                table: "refund_payments",
                column: "refund_request_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_refund_payments_transaction_reference",
                table: "refund_payments",
                column: "transaction_reference",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "refund_payments");
        }
    }
}
