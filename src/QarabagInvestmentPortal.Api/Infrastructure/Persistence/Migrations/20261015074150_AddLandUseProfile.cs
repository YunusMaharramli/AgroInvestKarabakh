using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QarabagInvestmentPortal.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLandUseProfile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Attributes",
                schema: "portal",
                table: "lands",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'{}'::jsonb");

            migrationBuilder.AddColumn<string>(
                name: "BoundaryGeoJson",
                schema: "portal",
                table: "lands",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CadastralNumber",
                schema: "portal",
                table: "lands",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "CategoryConvertible",
                schema: "portal",
                table: "lands",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CurrentUse",
                schema: "portal",
                table: "lands",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Encumbrances",
                schema: "portal",
                table: "lands",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "HasEncumbrance",
                schema: "portal",
                table: "lands",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LandUse",
                schema: "portal",
                table: "lands",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "LegalCategory",
                schema: "portal",
                table: "lands",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OwnershipForm",
                schema: "portal",
                table: "lands",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RoadAccessType",
                schema: "portal",
                table: "lands",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "RoadDistanceKm",
                schema: "portal",
                table: "lands",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "SettlementDistanceKm",
                schema: "portal",
                table: "lands",
                type: "double precision",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "land_photos",
                schema: "portal",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    LandId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    StorageKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    UploadedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_land_photos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_land_photos_lands_LandId",
                        column: x => x.LandId,
                        principalSchema: "portal",
                        principalTable: "lands",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Existing lands: fill the land-use key from the old type name, and use the full name for "Bağçılıq".
            migrationBuilder.Sql("""
                UPDATE portal.lands SET "LandUse" = CASE "AgricultureType"
                    WHEN 'Əkinçilik' THEN 'crops'
                    WHEN 'Bağçılıq və çoxillik əkinlər' THEN 'orchards'
                    WHEN 'İstixana təsərrüfatı' THEN 'greenhouse'
                    WHEN 'Heyvandarlıq' THEN 'livestock'
                    WHEN 'Quşçuluq' THEN 'poultry'
                    WHEN 'Otlaq və örüş' THEN 'pasture'
                    WHEN 'Arıçılıq' THEN 'beekeeping'
                    WHEN 'Balıqçılıq təsərrüfatı' THEN 'fishery'
                    WHEN 'Tingçilik və şitilçilik' THEN 'nursery'
                    WHEN 'Qarışıq kənd təsərrüfatı' THEN 'mixed'
                    WHEN 'Kənd təsərrüfatı məhsullarının emalı və qablaşdırılması' THEN 'processing'
                    WHEN 'Kənd təsərrüfatı məhsullarının saxlanması və soyuducu anbarlar' THEN 'coldStorage'
                    WHEN 'Kənd təsərrüfatı texnikası üçün saxlama və servis sahələri' THEN 'machinery'
                    WHEN 'Meşəçilik və oduncaq istehsalı' THEN 'forestry'
                    WHEN 'Aqroturizm və kənd qonaq evləri' THEN 'agrotourism'
                    WHEN 'Bağ və istirahət evlərinin tikintisi' THEN 'holidayHomes'
                    WHEN 'Yaşayış binalarının tikintisi' THEN 'residential'
                    WHEN 'Ticarət və ofis obyektlərinin tikintisi' THEN 'commercial'
                    WHEN 'Restoran və yolkənarı xidmət obyektləri' THEN 'roadside'
                    WHEN 'Sənaye müəssisələri və emalatxanalar' THEN 'industry'
                    WHEN 'Anbar və logistika mərkəzləri' THEN 'logistics'
                    WHEN 'Bərpa olunan enerji layihələri' THEN 'renewable'
                    WHEN 'İdman və istirahət obyektləri' THEN 'sport'
                    WHEN 'Düşərgə və açıq hava turizmi' THEN 'camping'
                    WHEN 'Sosial və ictimai xidmət obyektləri' THEN 'social'
                    WHEN 'Bağçılıq' THEN 'orchards'
                    ELSE "LandUse" END
                WHERE "LandUse" = '';
                UPDATE portal.lands SET "AgricultureType" = 'Bağçılıq və çoxillik əkinlər' WHERE "AgricultureType" = 'Bağçılıq';
                """);

            migrationBuilder.CreateIndex(
                name: "IX_lands_LandUse",
                schema: "portal",
                table: "lands",
                column: "LandUse");

            migrationBuilder.CreateIndex(
                name: "IX_land_photos_LandId_SortOrder",
                schema: "portal",
                table: "land_photos",
                columns: new[] { "LandId", "SortOrder" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "land_photos",
                schema: "portal");

            migrationBuilder.DropIndex(
                name: "IX_lands_LandUse",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "Attributes",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "BoundaryGeoJson",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "CadastralNumber",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "CategoryConvertible",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "CurrentUse",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "Encumbrances",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "HasEncumbrance",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "LandUse",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "LegalCategory",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "OwnershipForm",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "RoadAccessType",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "RoadDistanceKm",
                schema: "portal",
                table: "lands");

            migrationBuilder.DropColumn(
                name: "SettlementDistanceKm",
                schema: "portal",
                table: "lands");
        }
    }
}
