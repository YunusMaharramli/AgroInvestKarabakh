using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QarabagInvestmentPortal.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InvestorApplicantSignup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ApplicantType",
                schema: "portal",
                table: "users",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "OnboardingCompletedAt",
                schema: "portal",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "ActivityStartDate",
                schema: "portal",
                table: "user_profiles",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ActivityStatus",
                schema: "portal",
                table: "user_profiles",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Address",
                schema: "portal",
                table: "user_profiles",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CeoName",
                schema: "portal",
                table: "user_profiles",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Country",
                schema: "portal",
                table: "user_profiles",
                type: "character varying(2)",
                maxLength: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "FixedMonthlyIncome",
                schema: "portal",
                table: "user_profiles",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ForeignTaxNumber",
                schema: "portal",
                table: "user_profiles",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "HasCredit",
                schema: "portal",
                table: "user_profiles",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "HasFixedIncome",
                schema: "portal",
                table: "user_profiles",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "IncomeLast6Months",
                schema: "portal",
                table: "user_profiles",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IncomeSource",
                schema: "portal",
                table: "user_profiles",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MaritalStatus",
                schema: "portal",
                table: "user_profiles",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MinimumFunds",
                schema: "portal",
                table: "user_profiles",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MonthlyCreditPayment",
                schema: "portal",
                table: "user_profiles",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResidencyStatus",
                schema: "portal",
                table: "user_profiles",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_profiles_TaxIdentificationNumber",
                schema: "portal",
                table: "user_profiles",
                column: "TaxIdentificationNumber");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_user_profiles_TaxIdentificationNumber",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "ApplicantType",
                schema: "portal",
                table: "users");

            migrationBuilder.DropColumn(
                name: "OnboardingCompletedAt",
                schema: "portal",
                table: "users");

            migrationBuilder.DropColumn(
                name: "ActivityStartDate",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "ActivityStatus",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "Address",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "CeoName",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "Country",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "FixedMonthlyIncome",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "ForeignTaxNumber",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "HasCredit",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "HasFixedIncome",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "IncomeLast6Months",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "IncomeSource",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "MaritalStatus",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "MinimumFunds",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "MonthlyCreditPayment",
                schema: "portal",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "ResidencyStatus",
                schema: "portal",
                table: "user_profiles");
        }
    }
}
