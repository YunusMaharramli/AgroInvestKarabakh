using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QarabagInvestmentPortal.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RentalApplicationResponsesAndConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AdditionalInformationResponse",
                schema: "portal",
                table: "rental_applications",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddForeignKey(
                name: "FK_rental_application_history_rental_applications_ApplicationId",
                schema: "portal",
                table: "rental_application_history",
                column: "ApplicationId",
                principalSchema: "portal",
                principalTable: "rental_applications",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_rental_leases_rental_applications_ApplicationId",
                schema: "portal",
                table: "rental_leases",
                column: "ApplicationId",
                principalSchema: "portal",
                principalTable: "rental_applications",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_rental_leases_rental_listings_ListingId",
                schema: "portal",
                table: "rental_leases",
                column: "ListingId",
                principalSchema: "portal",
                principalTable: "rental_listings",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_rental_application_history_rental_applications_ApplicationId",
                schema: "portal",
                table: "rental_application_history");

            migrationBuilder.DropForeignKey(
                name: "FK_rental_leases_rental_applications_ApplicationId",
                schema: "portal",
                table: "rental_leases");

            migrationBuilder.DropForeignKey(
                name: "FK_rental_leases_rental_listings_ListingId",
                schema: "portal",
                table: "rental_leases");

            migrationBuilder.DropColumn(
                name: "AdditionalInformationResponse",
                schema: "portal",
                table: "rental_applications");
        }
    }
}
