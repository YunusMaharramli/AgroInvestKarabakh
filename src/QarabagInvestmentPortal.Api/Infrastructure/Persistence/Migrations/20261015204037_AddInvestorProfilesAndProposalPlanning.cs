using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QarabagInvestmentPortal.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInvestorProfilesAndProposalPlanning : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "AdditionalFinancingRequired",
                schema: "portal",
                table: "user_profiles",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "AnnualRevenue",
                schema: "portal",
                table: "user_profiles",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CitizenshipCountry",
                schema: "portal",
                table: "user_profiles",
                type: "character varying(2)",
                maxLength: 2,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "DateOfBirth",
                schema: "portal",
                table: "user_profiles",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DebtRepaymentAmount",
                schema: "portal",
                table: "user_profiles",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DebtRepaymentFrequency",
                schema: "portal",
                table: "user_profiles",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExperienceDescription",
                schema: "portal",
                table: "user_profiles",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ExperienceYears",
                schema: "portal",
                table: "user_profiles",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FinancialCurrency",
                schema: "portal",
                table: "user_profiles",
                type: "character varying(3)",
                maxLength: 3,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FinancialReportingPeriod",
                schema: "portal",
                table: "user_profiles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IdentityDocumentNumber",
                schema: "portal",
                table: "user_profiles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IdentityDocumentType",
                schema: "portal",
                table: "user_profiles",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IncomePeriod",
                schema: "portal",
                table: "user_profiles",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IncomeStability",
                schema: "portal",
                table: "user_profiles",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LegalForm",
                schema: "portal",
                table: "user_profiles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LiquidFundsAvailable",
                schema: "portal",
                table: "user_profiles",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MonthlyNetIncome",
                schema: "portal",
                table: "user_profiles",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "NetProfitOrLoss",
                schema: "portal",
                table: "user_profiles",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OperatingAddress",
                schema: "portal",
                table: "user_profiles",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "OperatingCashFlow",
                schema: "portal",
                table: "user_profiles",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OperationalCapacity",
                schema: "portal",
                table: "user_profiles",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "OutstandingDebt",
                schema: "portal",
                table: "user_profiles",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "OwnContribution",
                schema: "portal",
                table: "user_profiles",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PostInvestmentReserve",
                schema: "portal",
                table: "user_profiles",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreviousProjects",
                schema: "portal",
                table: "user_profiles",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "RegistrationDate",
                schema: "portal",
                table: "user_profiles",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RepresentativeRole",
                schema: "portal",
                table: "user_profiles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResidenceCountry",
                schema: "portal",
                table: "user_profiles",
                type: "character varying(2)",
                maxLength: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "AdditionalFinancingRequested",
                schema: "portal",
                table: "proposals",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ExpectedAnnualRevenue",
                schema: "portal",
                table: "proposals",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExpectedProduction",
                schema: "portal",
                table: "proposals",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "FundingGap",
                schema: "portal",
                table: "proposals",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ProjectCosts",
                schema: "portal",
                table: "proposals",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "investor_profile_documents",
                schema: "portal",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UserId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    FileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Category = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    StorageKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    UploadedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_investor_profile_documents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_investor_profile_documents_user_profiles_UserId",
                        column: x => x.UserId,
                        principalSchema: "portal",
                        principalTable: "user_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_investor_profile_documents_users_UserId",
                        column: x => x.UserId,
                        principalSchema: "portal",
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_investor_profile_documents_UserId_UploadedAt",
                schema: "portal",
                table: "investor_profile_documents",
                columns: new[] { "UserId", "UploadedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "investor_profile_documents",
                schema: "portal");

            migrationBuilder.DropColumn(
                name: "AdditionalFinancingRequired",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "AnnualRevenue",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "CitizenshipCountry",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "DateOfBirth",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "DebtRepaymentAmount",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "DebtRepaymentFrequency",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "ExperienceDescription",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "ExperienceYears",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "FinancialCurrency",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "FinancialReportingPeriod",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "IdentityDocumentNumber",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "IdentityDocumentType",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "IncomePeriod",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "IncomeStability",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "LegalForm",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "LiquidFundsAvailable",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "MonthlyNetIncome",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "NetProfitOrLoss",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "OperatingAddress",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "OperatingCashFlow",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "OperationalCapacity",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "OutstandingDebt",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "OwnContribution",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "PostInvestmentReserve",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "PreviousProjects",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "RegistrationDate",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "RepresentativeRole",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "ResidenceCountry",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "AdditionalFinancingRequested",
                schema: "portal",
                table: "proposals");

            migrationBuilder.DropColumn(
                name: "ExpectedAnnualRevenue",
                schema: "portal",
                table: "proposals");

            migrationBuilder.DropColumn(
                name: "ExpectedProduction",
                schema: "portal",
                table: "proposals");

            migrationBuilder.DropColumn(
                name: "FundingGap",
                schema: "portal",
                table: "proposals");

            migrationBuilder.DropColumn(
                name: "ProjectCosts",
                schema: "portal",
                table: "proposals");
        }
    }
}
