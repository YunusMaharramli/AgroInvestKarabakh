using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QarabagInvestmentPortal.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmailConfirmationStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "EmailConfirmedAt",
                schema: "portal",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);
            migrationBuilder.Sql("""
                UPDATE portal.users
                SET "EmailConfirmedAt" = NOW()
                WHERE "EmailConfirmedAt" IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EmailConfirmedAt",
                schema: "portal",
                table: "users");
        }
    }
}
