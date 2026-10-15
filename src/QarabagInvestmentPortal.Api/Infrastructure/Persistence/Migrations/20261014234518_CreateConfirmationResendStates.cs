using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QarabagInvestmentPortal.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CreateConfirmationResendStates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "confirmation_resend_states",
                schema: "portal",
                columns: table => new
                {
                    IpAddress = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: false),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    SentInWindow = table.Column<int>(type: "integer", nullable: false),
                    WindowStartedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    BlockedUntil = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_confirmation_resend_states", x => new { x.IpAddress, x.Email });
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "confirmation_resend_states",
                schema: "portal");
        }
    }
}
