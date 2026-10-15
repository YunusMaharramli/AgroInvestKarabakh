using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QarabagInvestmentPortal.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CompetitionApplications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Status",
                schema: "portal",
                table: "proposals",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(16)",
                oldMaxLength: 16);

            migrationBuilder.AddColumn<string>(
                name: "ApplicantName",
                schema: "portal",
                table: "proposals",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ApplicantType",
                schema: "portal",
                table: "proposals",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "individual");

            migrationBuilder.AddColumn<string>(
                name: "TaxNumber",
                schema: "portal",
                table: "proposals",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);
            migrationBuilder.Sql("""
                UPDATE portal.proposals AS p
                SET "ApplicantName" = trim(u."FirstName" || ' ' || u."LastName"), "ApplicantType" = 'individual'
                FROM portal.users AS u WHERE u."Id" = p."InvestorId";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ApplicantName",
                schema: "portal",
                table: "proposals");

            migrationBuilder.DropColumn(
                name: "ApplicantType",
                schema: "portal",
                table: "proposals");

            migrationBuilder.DropColumn(
                name: "TaxNumber",
                schema: "portal",
                table: "proposals");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                schema: "portal",
                table: "proposals",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(32)",
                oldMaxLength: 32);
        }
    }
}
