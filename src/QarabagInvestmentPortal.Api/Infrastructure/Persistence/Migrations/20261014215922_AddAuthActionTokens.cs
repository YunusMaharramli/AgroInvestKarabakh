using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QarabagInvestmentPortal.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAuthActionTokens : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "auth_action_tokens",
                schema: "portal",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UserId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Purpose = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UsedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_auth_action_tokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_auth_action_tokens_users_UserId",
                        column: x => x.UserId,
                        principalSchema: "portal",
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_auth_action_tokens_TokenHash",
                schema: "portal",
                table: "auth_action_tokens",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_auth_action_tokens_UserId_Purpose",
                schema: "portal",
                table: "auth_action_tokens",
                columns: new[] { "UserId", "Purpose" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "auth_action_tokens",
                schema: "portal");
        }
    }
}
