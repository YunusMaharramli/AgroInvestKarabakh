using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QarabagInvestmentPortal.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AdminLandManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AdminNotes",
                schema: "portal",
                table: "lands",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ArchivedAt",
                schema: "portal",
                table: "lands",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "CadastralUnavailable",
                schema: "portal",
                table: "lands",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ClientRequestId",
                schema: "portal",
                table: "lands",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedById",
                schema: "portal",
                table: "lands",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Details",
                schema: "portal",
                table: "lands",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'{}'::jsonb");

            migrationBuilder.AddColumn<string>(
                name: "District",
                schema: "portal",
                table: "lands",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EntrySource",
                schema: "portal",
                table: "lands",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "Owner");

            migrationBuilder.AddColumn<string>(
                name: "OnBehalfOf",
                schema: "portal",
                table: "lands",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "PublishedAt",
                schema: "portal",
                table: "lands",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResponsibleUserId",
                schema: "portal",
                table: "lands",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Settlement",
                schema: "portal",
                table: "lands",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedById",
                schema: "portal",
                table: "lands",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Verification",
                schema: "portal",
                table: "lands",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "EvidencePending");

            migrationBuilder.AddColumn<string>(
                name: "VerificationNote",
                schema: "portal",
                table: "lands",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "VerifiedAt",
                schema: "portal",
                table: "lands",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VerifiedById",
                schema: "portal",
                table: "lands",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WaterAccess",
                schema: "portal",
                table: "lands",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Kind",
                schema: "portal",
                table: "land_documents",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "ownership");

            // Existing data: lands without an owner (state land / legacy import) were entered by admins;
            // owner lands keep EvidencePending. Nothing becomes "Verified" automatically.
            migrationBuilder.Sql("""
                UPDATE portal.lands SET "EntrySource" = 'Admin', "Verification" = 'AdminEntered' WHERE "OwnerId" IS NULL;
                UPDATE portal.lands SET "CreatedById" = COALESCE("OwnerId", "ReviewedById"), "UpdatedById" = COALESCE("OwnerId", "ReviewedById");
                UPDATE portal.lands SET "PublishedAt" = COALESCE("ReviewedAt", "CreatedAt") WHERE "Status" = 'Approved';
                """);

            migrationBuilder.CreateTable(
                name: "land_audit",
                schema: "portal",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    LandId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ActorId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Action = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Details = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    At = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_land_audit", x => x.Id);
                    table.ForeignKey(
                        name: "FK_land_audit_lands_LandId",
                        column: x => x.LandId,
                        principalSchema: "portal",
                        principalTable: "lands",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lands_CadastralNumber",
                schema: "portal",
                table: "lands",
                column: "CadastralNumber");

            migrationBuilder.CreateIndex(
                name: "IX_lands_ClientRequestId",
                schema: "portal",
                table: "lands",
                column: "ClientRequestId",
                unique: true,
                filter: "\"ClientRequestId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_land_audit_LandId_At",
                schema: "portal",
                table: "land_audit",
                columns: new[] { "LandId", "At" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "land_audit",
                schema: "portal");

            migrationBuilder.DropIndex(
                name: "IX_lands_CadastralNumber",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropIndex(
                name: "IX_lands_ClientRequestId",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "AdminNotes",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "ArchivedAt",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "CadastralUnavailable",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "ClientRequestId",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "CreatedById",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "Details",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "District",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "EntrySource",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "OnBehalfOf",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "PublishedAt",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "ResponsibleUserId",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "Settlement",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "UpdatedById",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "Verification",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "VerificationNote",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "VerifiedAt",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "VerifiedById",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "WaterAccess",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "Kind",
                schema: "portal",
                table: "land_documents");
        }
    }
}
