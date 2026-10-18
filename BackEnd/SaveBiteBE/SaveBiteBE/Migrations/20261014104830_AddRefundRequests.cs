using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SaveBiteBE.Migrations
{
    /// <inheritdoc />
    public partial class AddRefundRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "audit_logs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    actor_user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    action = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    target_type = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    target_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    old_values_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    new_values_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_logs", x => x.id);
                    table.ForeignKey(
                        name: "FK_audit_logs_users_actor_user_id",
                        column: x => x.actor_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "refund_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    shop_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    request_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    request_hash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    order_number = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    shop_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    reason = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    requested_amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    approved_amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    resolution_note = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    handled_by_user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    deadline_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    resolved_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refund_requests", x => x.id);
                    table.CheckConstraint("ck_refund_requests_amount", "[requested_amount] > 0");
                    table.CheckConstraint("ck_refund_requests_approved_amount", "[approved_amount] IS NULL OR ([approved_amount] >= 0 AND [approved_amount] <= [requested_amount])");
                    table.CheckConstraint("ck_refund_requests_deadline", "[created_at] < [deadline_at]");
                    table.CheckConstraint("ck_refund_requests_status", "[status] IN ('PENDING', 'APPROVED', 'REJECTED', 'REFUNDED')");
                    table.ForeignKey(
                        name: "FK_refund_requests_Orders_order_id",
                        column: x => x.order_id,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_refund_requests_shops_shop_id",
                        column: x => x.shop_id,
                        principalTable: "shops",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_refund_requests_users_handled_by_user_id",
                        column: x => x.handled_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_refund_requests_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "refund_evidences",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    refund_request_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    stored_file_name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    file_type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    file_size = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refund_evidences", x => x.id);
                    table.ForeignKey(
                        name: "FK_refund_evidences_refund_requests_refund_request_id",
                        column: x => x.refund_request_id,
                        principalTable: "refund_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_audit_logs_action_created_at",
                table: "audit_logs",
                columns: new[] { "action", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_audit_logs_actor_user_id",
                table: "audit_logs",
                column: "actor_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_refund_evidences_refund_request_id",
                table: "refund_evidences",
                column: "refund_request_id");

            migrationBuilder.CreateIndex(
                name: "IX_refund_requests_handled_by_user_id",
                table: "refund_requests",
                column: "handled_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_refund_requests_shop_id",
                table: "refund_requests",
                column: "shop_id");

            migrationBuilder.CreateIndex(
                name: "ix_refund_requests_status_created",
                table: "refund_requests",
                columns: new[] { "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ux_refund_requests_pending_order",
                table: "refund_requests",
                column: "order_id",
                unique: true,
                filter: "[status] = 'PENDING'");

            migrationBuilder.CreateIndex(
                name: "ux_refund_requests_user_request",
                table: "refund_requests",
                columns: new[] { "user_id", "request_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "audit_logs");

            migrationBuilder.DropTable(
                name: "refund_evidences");

            migrationBuilder.DropTable(
                name: "refund_requests");
        }
    }
}
