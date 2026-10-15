using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QarabagInvestmentPortal.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLoginAttemptState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "login_attempt_states",
                schema: "portal",
                columns: table => new
                {
                    IpAddress = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: false),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    FailedAttempts = table.Column<int>(type: "integer", nullable: false),
                    CompletedBlocks = table.Column<int>(type: "integer", nullable: false),
                    BlockedUntil = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_login_attempt_states", x => new { x.IpAddress, x.Email });
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "login_attempt_states",
                schema: "portal");
        }
    }
}
