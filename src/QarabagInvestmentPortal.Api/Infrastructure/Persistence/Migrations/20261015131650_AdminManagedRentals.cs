using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QarabagInvestmentPortal.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AdminManagedRentals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "rental_applicant_profiles",
                schema: "portal",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UserId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ApplicantType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ForeignKind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    FullLegalName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Citizenship = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CountryOfResidence = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ResidenceAddress = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    IdDocumentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IdDocumentNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Fin = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    LegalName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    LegalForm = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CountryOfIncorporation = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RegistrationIdentifier = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TaxIdentifier = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RegisteredAddress = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ContactPhone = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ContactEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ContactAddress = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    RepresentativeName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    RepresentativePosition = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    AuthorityToAct = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ConsentGrantedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ConsentVersion = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rental_applicant_profiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_rental_applicant_profiles_users_UserId",
                        column: x => x.UserId,
                        principalSchema: "portal",
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "rental_application_history",
                schema: "portal",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ApplicationId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ActorId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Comment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rental_application_history", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "rental_audit",
                schema: "portal",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ActorId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Action = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ObjectType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ObjectId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    At = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rental_audit", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "rental_leases",
                schema: "portal",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ListingId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ApplicationId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    AgreementReference = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    StartsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    EndsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    FinalizedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    FinalizedById = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    EndedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rental_leases", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "rental_listings",
                schema: "portal",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PropertyType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    OwnerCategory = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    LegalDesignation = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Region = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Area = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    AreaUnit = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    PermittedUse = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    RentAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    PaymentPeriod = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    MinimumLeaseMonths = table.Column<int>(type: "integer", nullable: true),
                    MaximumLeaseMonths = table.Column<int>(type: "integer", nullable: true),
                    DepositAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    AdditionalCharges = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Infrastructure = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    PhotoUrls = table.Column<string[]>(type: "text[]", nullable: false),
                    AuthorityBasis = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    AuthorityReference = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    AuthorityReviewed = table.Column<bool>(type: "boolean", nullable: false),
                    Procedure = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ProcedureReference = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ProcedureNotes = table.Column<string>(type: "character varying(3000)", maxLength: 3000, nullable: false),
                    EligibilityRules = table.Column<string>(type: "character varying(3000)", maxLength: 3000, nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    WithdrawalReason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedById = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UpdatedById = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    PublishedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rental_listings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "rental_applications",
                schema: "portal",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ReferenceNumber = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ListingId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ApplicantUserId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ApplicantProfileId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    IntendedUse = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    ProposedLeaseMonths = table.Column<int>(type: "integer", nullable: true),
                    Message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    ApplicantSnapshot = table.Column<string>(type: "jsonb", nullable: true),
                    DecisionReason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    DecidedById = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    DecidedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    SubmittedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rental_applications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_rental_applications_rental_applicant_profiles_ApplicantProf~",
                        column: x => x.ApplicantProfileId,
                        principalSchema: "portal",
                        principalTable: "rental_applicant_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_rental_applications_rental_listings_ListingId",
                        column: x => x.ListingId,
                        principalSchema: "portal",
                        principalTable: "rental_listings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_rental_applications_users_ApplicantUserId",
                        column: x => x.ApplicantUserId,
                        principalSchema: "portal",
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "rental_document_requirements",
                schema: "portal",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ListingId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ApplicantScope = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Kind = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Label = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    IsRequired = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rental_document_requirements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_rental_document_requirements_rental_listings_ListingId",
                        column: x => x.ListingId,
                        principalSchema: "portal",
                        principalTable: "rental_listings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "rental_listing_documents",
                schema: "portal",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ListingId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Kind = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    FileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    StorageKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    UploadedById = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UploadedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rental_listing_documents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_rental_listing_documents_rental_listings_ListingId",
                        column: x => x.ListingId,
                        principalSchema: "portal",
                        principalTable: "rental_listings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "rental_application_documents",
                schema: "portal",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ApplicationId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Kind = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    FileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    StorageKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    UploadedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rental_application_documents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_rental_application_documents_rental_applications_Applicatio~",
                        column: x => x.ApplicationId,
                        principalSchema: "portal",
                        principalTable: "rental_applications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_rental_applicant_profiles_UserId",
                schema: "portal",
                table: "rental_applicant_profiles",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_rental_application_documents_ApplicationId_Kind",
                schema: "portal",
                table: "rental_application_documents",
                columns: new[] { "ApplicationId", "Kind" });

            migrationBuilder.CreateIndex(
                name: "IX_rental_application_history_ApplicationId_CreatedAt",
                schema: "portal",
                table: "rental_application_history",
                columns: new[] { "ApplicationId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_rental_applications_ApplicantProfileId",
                schema: "portal",
                table: "rental_applications",
                column: "ApplicantProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_rental_applications_ApplicantUserId",
                schema: "portal",
                table: "rental_applications",
                column: "ApplicantUserId");

            migrationBuilder.CreateIndex(
                name: "IX_rental_applications_ListingId_ApplicantUserId",
                schema: "portal",
                table: "rental_applications",
                columns: new[] { "ListingId", "ApplicantUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_rental_applications_ListingId_Status",
                schema: "portal",
                table: "rental_applications",
                columns: new[] { "ListingId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_rental_applications_ReferenceNumber",
                schema: "portal",
                table: "rental_applications",
                column: "ReferenceNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_rental_audit_ObjectType_ObjectId_At",
                schema: "portal",
                table: "rental_audit",
                columns: new[] { "ObjectType", "ObjectId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_rental_document_requirements_ListingId_ApplicantScope_Kind",
                schema: "portal",
                table: "rental_document_requirements",
                columns: new[] { "ListingId", "ApplicantScope", "Kind" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_rental_leases_ApplicationId",
                schema: "portal",
                table: "rental_leases",
                column: "ApplicationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_rental_leases_one_active_per_listing",
                schema: "portal",
                table: "rental_leases",
                column: "ListingId",
                unique: true,
                filter: "\"EndedAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_rental_listing_documents_ListingId",
                schema: "portal",
                table: "rental_listing_documents",
                column: "ListingId");

            migrationBuilder.CreateIndex(
                name: "IX_rental_listings_Status_OwnerCategory",
                schema: "portal",
                table: "rental_listings",
                columns: new[] { "Status", "OwnerCategory" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "rental_application_documents",
                schema: "portal");

            migrationBuilder.DropTable(
                name: "rental_application_history",
                schema: "portal");

            migrationBuilder.DropTable(
                name: "rental_audit",
                schema: "portal");

            migrationBuilder.DropTable(
                name: "rental_document_requirements",
                schema: "portal");

            migrationBuilder.DropTable(
                name: "rental_leases",
                schema: "portal");

            migrationBuilder.DropTable(
                name: "rental_listing_documents",
                schema: "portal");

            migrationBuilder.DropTable(
                name: "rental_applications",
                schema: "portal");

            migrationBuilder.DropTable(
                name: "rental_applicant_profiles",
                schema: "portal");

            migrationBuilder.DropTable(
                name: "rental_listings",
                schema: "portal");
        }
    }
}
