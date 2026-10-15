using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QarabagInvestmentPortal.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MinistryReviewFlow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OwnershipType",
                schema: "portal",
                table: "lands",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "Private");

            migrationBuilder.AddColumn<string>(
                name: "ClosureReason",
                schema: "portal",
                table: "investment_opportunities",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReviewNote",
                schema: "portal",
                table: "investment_opportunities",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ReviewedAt",
                schema: "portal",
                table: "investment_opportunities",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReviewedById",
                schema: "portal",
                table: "investment_opportunities",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ux_opportunities_one_draft_per_land",
                schema: "portal",
                table: "investment_opportunities",
                column: "LandId",
                unique: true,
                filter: "\"Status\" = 'Draft'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_opportunities_one_draft_per_land",
                schema: "portal",
                table: "investment_opportunities");

            migrationBuilder.DropColumn(
                name: "OwnershipType",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "ClosureReason",
                schema: "portal",
                table: "investment_opportunities");

            migrationBuilder.DropColumn(
                name: "ReviewNote",
                schema: "portal",
                table: "investment_opportunities");

            migrationBuilder.DropColumn(
                name: "ReviewedAt",
                schema: "portal",
                table: "investment_opportunities");

            migrationBuilder.DropColumn(
                name: "ReviewedById",
                schema: "portal",
                table: "investment_opportunities");
        }
    }
}
