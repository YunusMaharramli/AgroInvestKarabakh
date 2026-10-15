using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Features.Admin;
using QarabagInvestmentPortal.Api.Features.Chat;
using QarabagInvestmentPortal.Api.Features.Favorites;
using QarabagInvestmentPortal.Api.Features.Lands;
using QarabagInvestmentPortal.Api.Features.Notifications;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Features.Proposals;
using QarabagInvestmentPortal.Api.Features.Rentals;
using QarabagInvestmentPortal.Api.Features.Users;
using QarabagInvestmentPortal.Api.Infrastructure.Import;

namespace QarabagInvestmentPortal.Api.Infrastructure.Persistence;

/// <summary>The single EF Core context for the whole portal (schema "portal").</summary>
public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public const string Schema = "portal";
    public const string ProposalReferenceSequence = "proposal_reference_seq";

    public DbSet<User> Users => Set<User>();
    public DbSet<AuthActionToken> AuthActionTokens => Set<AuthActionToken>();
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<Land> Lands => Set<Land>();
    public DbSet<LandDocument> LandDocuments => Set<LandDocument>();
    public DbSet<LandPhoto> LandPhotos => Set<LandPhoto>();
    public DbSet<LandAuditEntry> LandAudit => Set<LandAuditEntry>();
    public DbSet<InvestmentOpportunity> Opportunities => Set<InvestmentOpportunity>();
    public DbSet<Proposal> Proposals => Set<Proposal>();
    public DbSet<ProposalDocument> ProposalDocuments => Set<ProposalDocument>();
    public DbSet<ProposalHistoryEntry> ProposalHistory => Set<ProposalHistoryEntry>();
    public DbSet<RentalListing> RentalListings => Set<RentalListing>();
    public DbSet<RentalDocumentRequirement> RentalDocumentRequirements => Set<RentalDocumentRequirement>();
    public DbSet<RentalListingDocument> RentalListingDocuments => Set<RentalListingDocument>();
    public DbSet<RentalApplicantProfile> RentalApplicantProfiles => Set<RentalApplicantProfile>();
    public DbSet<RentalApplication> RentalApplications => Set<RentalApplication>();
    public DbSet<RentalApplicationDocument> RentalApplicationDocuments => Set<RentalApplicationDocument>();
    public DbSet<RentalApplicationHistory> RentalApplicationHistory => Set<RentalApplicationHistory>();
    public DbSet<RentalLease> RentalLeases => Set<RentalLease>();
    public DbSet<RentalAuditEntry> RentalAudit => Set<RentalAuditEntry>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<Favorite> Favorites => Set<Favorite>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<IntegrationLog> IntegrationLogs => Set<IntegrationLog>();
    public DbSet<ImportRun> ImportRuns => Set<ImportRun>();
    public DbSet<LoginAttemptState> LoginAttemptStates => Set<LoginAttemptState>();
    public DbSet<ConfirmationResendState> ConfirmationResendStates
    => Set<ConfirmationResendState>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
        modelBuilder.HasSequence<long>(ProposalReferenceSequence).StartsAt(1);

        modelBuilder.Entity<User>(e =>
        {
            e.ToTable("users");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.Email).HasMaxLength(256).IsRequired();
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.FirstName).HasMaxLength(100).IsRequired();
            e.Property(x => x.LastName).HasMaxLength(100).IsRequired();
            e.Property(x => x.Phone).HasMaxLength(32);
            e.Property(x => x.Role).HasConversion<string>().HasMaxLength(16);
            e.Property(x => x.PasswordHash).HasMaxLength(200).IsRequired();
            e.Ignore(x => x.FullName);
            e.HasOne(x => x.Profile).WithOne().HasForeignKey<UserProfile>(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LoginAttemptState>(e =>
        {
            e.ToTable("login_attempt_states");
            e.HasKey(x => new { x.IpAddress, x.Email });
            e.Property(x => x.IpAddress).HasMaxLength(45);
            e.Property(x => x.Email).HasMaxLength(256);
        });

        modelBuilder.Entity<ConfirmationResendState>(e =>
        {
            e.ToTable("confirmation_resend_states");
            e.HasKey(x => new { x.IpAddress, x.Email });
            e.Property(x => x.IpAddress).HasMaxLength(45).IsRequired();
            e.Property(x => x.Email).HasMaxLength(256).IsRequired();
        });

        modelBuilder.Entity<AuthActionToken>(e =>
        {
            e.ToTable("auth_action_tokens");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.UserId).HasMaxLength(64).IsRequired();
            e.Property(x => x.Purpose).HasConversion<string>().HasMaxLength(32);
            e.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();

            e.HasIndex(x => x.TokenHash).IsUnique();
            e.HasIndex(x => new { x.UserId, x.Purpose });
            e.HasOne<User>().WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserProfile>(e =>
        {
            e.ToTable("user_profiles");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.UserId).HasMaxLength(64);
            e.HasIndex(x => x.UserId).IsUnique();
            e.Property(x => x.CompanyName).HasMaxLength(200);
            e.Property(x => x.TaxIdentificationNumber).HasMaxLength(20);
            e.Property(x => x.BusinessActivity).HasMaxLength(1000);
        });

        modelBuilder.Entity<Land>(e =>
        {
            e.ToTable("lands");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.OwnerId).HasMaxLength(64);
            e.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.Region).HasMaxLength(100).IsRequired();
            e.Property(x => x.AgricultureType).HasMaxLength(100).IsRequired();
            e.Property(x => x.IntendedUse).HasMaxLength(500);
            e.Property(x => x.Description).HasMaxLength(4000);
            e.Property(x => x.ImageUrl).HasMaxLength(500);
            e.Property(x => x.SoilQuality).HasMaxLength(500);
            e.Property(x => x.WaterSupply).HasMaxLength(500);
            e.Property(x => x.EstimatedInvestmentRequirement).HasPrecision(18, 2);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(32);
            e.Property(x => x.OwnershipType).HasConversion<string>().HasMaxLength(16);
            e.Property(x => x.ReviewNote).HasMaxLength(2000);
            e.Property(x => x.OwnerNote).HasMaxLength(2000);
            e.Property(x => x.ReviewedById).HasMaxLength(64);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.OwnerId);
            e.HasMany(x => x.Documents).WithOne().HasForeignKey(d => d.LandId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Photos).WithOne().HasForeignKey(p => p.LandId).OnDelete(DeleteBehavior.Cascade);

            // Land-use type and common core (see LandUseCatalog / LandSuitability).
            e.Property(x => x.LandUse).HasMaxLength(32).HasDefaultValue(string.Empty);
            e.Property(x => x.CadastralNumber).HasMaxLength(50);
            e.Property(x => x.LegalCategory).HasMaxLength(32);
            e.Property(x => x.OwnershipForm).HasMaxLength(16);
            e.Property(x => x.Encumbrances).HasMaxLength(1000);
            e.Property(x => x.BoundaryGeoJson).HasColumnType("jsonb");
            e.Property(x => x.RoadAccessType).HasMaxLength(16);
            e.Property(x => x.CurrentUse).HasMaxLength(500);
            e.Property(x => x.Attributes).HasColumnType("jsonb").HasDefaultValueSql("'{}'::jsonb");
            e.HasIndex(x => x.LandUse);

            // Admin land management.
            e.Property(x => x.District).HasMaxLength(100);
            e.Property(x => x.Settlement).HasMaxLength(100);
            e.Property(x => x.WaterAccess).HasMaxLength(32);
            e.Property(x => x.Details).HasColumnType("jsonb").HasDefaultValueSql("'{}'::jsonb");
            e.Property(x => x.AdminNotes).HasMaxLength(4000);
            e.Property(x => x.EntrySource).HasConversion<string>().HasMaxLength(16);
            e.Property(x => x.OnBehalfOf).HasMaxLength(200);
            e.Property(x => x.CreatedById).HasMaxLength(64);
            e.Property(x => x.UpdatedById).HasMaxLength(64);
            e.Property(x => x.ResponsibleUserId).HasMaxLength(64);
            e.Property(x => x.Verification).HasConversion<string>().HasMaxLength(16);
            e.Property(x => x.VerifiedById).HasMaxLength(64);
            e.Property(x => x.VerificationNote).HasMaxLength(2000);
            e.Property(x => x.ClientRequestId).HasMaxLength(64);
            e.HasIndex(x => x.ClientRequestId).IsUnique().HasFilter("\"ClientRequestId\" IS NOT NULL");
            e.HasIndex(x => x.CadastralNumber);
        });

        modelBuilder.Entity<LandAuditEntry>(e =>
        {
            e.ToTable("land_audit");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.LandId).HasMaxLength(64);
            e.Property(x => x.ActorId).HasMaxLength(64).IsRequired();
            e.Property(x => x.Action).HasMaxLength(32).IsRequired();
            e.Property(x => x.Details).HasMaxLength(2000);
            e.HasOne<Land>().WithMany().HasForeignKey(x => x.LandId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.LandId, x.At });
        });

        modelBuilder.Entity<LandPhoto>(e =>
        {
            e.ToTable("land_photos");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.LandId).HasMaxLength(64);
            e.Property(x => x.ContentType).HasMaxLength(100).IsRequired();
            e.Property(x => x.StorageKey).HasMaxLength(500).IsRequired();
            e.HasIndex(x => new { x.LandId, x.SortOrder });
        });

        modelBuilder.Entity<LandDocument>(e =>
        {
            e.ToTable("land_documents");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.LandId).HasMaxLength(64);
            e.Property(x => x.FileName).HasMaxLength(255).IsRequired();
            e.Property(x => x.ContentType).HasMaxLength(100).IsRequired();
            e.Property(x => x.StorageKey).HasMaxLength(500).IsRequired();
            e.Property(x => x.UploadedById).HasMaxLength(64);
            e.Property(x => x.Kind).HasMaxLength(32).HasDefaultValue("ownership");
        });

        modelBuilder.Entity<InvestmentOpportunity>(e =>
        {
            e.ToTable("investment_opportunities");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.LandId).HasMaxLength(64);
            e.HasOne(x => x.Land).WithMany().HasForeignKey(x => x.LandId).OnDelete(DeleteBehavior.Restrict);
            e.Property(x => x.Source).HasConversion<string>().HasMaxLength(16);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(16);
            e.Property(x => x.Title).HasMaxLength(300).IsRequired();
            e.Property(x => x.Description).HasMaxLength(4000);
            e.Property(x => x.ContactPhone).HasMaxLength(32);
            e.Property(x => x.WinnerProposalId).HasMaxLength(64);
            e.Property(x => x.ClosureReason).HasMaxLength(2000);
            e.Property(x => x.ReviewNote).HasMaxLength(2000);
            e.Property(x => x.ReviewedById).HasMaxLength(64);
            e.Property(x => x.CreatedById).HasMaxLength(64);
            e.HasIndex(x => x.Status);

            // One active (published) opportunity per land.
            e.HasIndex(x => x.LandId, "active_opportunity_per_land")
                .IsUnique()
                .HasFilter("\"Status\" = 'Active'")
                .HasDatabaseName("ux_opportunities_one_active_per_land");
            e.HasIndex(x => x.LandId, "draft_opportunity_per_land")
                .IsUnique()
                .HasFilter("\"Status\" = 'Draft'")
                .HasDatabaseName("ux_opportunities_one_draft_per_land");
        });

        modelBuilder.Entity<Proposal>(e =>
        {
            e.ToTable("proposals");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.ReferenceNumber).HasMaxLength(32).IsRequired();
            e.HasIndex(x => x.ReferenceNumber).IsUnique();
            e.Property(x => x.OpportunityId).HasMaxLength(64);
            e.Property(x => x.InvestorId).HasMaxLength(64);
            e.HasOne(x => x.Opportunity).WithMany().HasForeignKey(x => x.OpportunityId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Investor).WithMany().HasForeignKey(x => x.InvestorId).OnDelete(DeleteBehavior.Restrict);
            e.Property(x => x.ProposedInvestmentAmount).HasPrecision(18, 2);
            e.Property(x => x.BusinessPlanSummary).HasMaxLength(4000);
            e.Property(x => x.EstimatedImplementationPeriod).HasMaxLength(100);
            e.Property(x => x.ContactPhone).HasMaxLength(32);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(16);

            // One proposal per investor per opportunity, and at most one winner per opportunity.
            e.HasIndex(x => new { x.OpportunityId, x.InvestorId }).IsUnique();
            e.HasIndex(x => x.OpportunityId)
                .IsUnique()
                .HasFilter("\"Status\" = 'Selected'")
                .HasDatabaseName("ux_proposals_one_winner_per_opportunity");
            e.HasIndex(x => x.InvestorId);

            e.HasMany(x => x.Documents).WithOne().HasForeignKey(d => d.ProposalId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.History).WithOne().HasForeignKey(h => h.ProposalId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ProposalDocument>(e =>
        {
            e.ToTable("proposal_documents");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.ProposalId).HasMaxLength(64);
            e.Property(x => x.FileName).HasMaxLength(255).IsRequired();
            e.Property(x => x.ContentType).HasMaxLength(100).IsRequired();
            e.Property(x => x.StorageKey).HasMaxLength(500).IsRequired();
        });

        modelBuilder.Entity<ProposalHistoryEntry>(e =>
        {
            e.ToTable("proposal_history");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.ProposalId).HasMaxLength(64);
            e.Property(x => x.Status).HasMaxLength(64);
            e.Property(x => x.ChangedBy).HasMaxLength(200);
            e.Property(x => x.Comment).HasMaxLength(4000);
        });

        modelBuilder.Entity<RentalListing>(e =>
        {
            e.ToTable("rental_listings");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.PropertyType).HasConversion<string>().HasMaxLength(32);
            e.Property(x => x.OwnerCategory).HasConversion<string>().HasMaxLength(16);
            e.Property(x => x.Procedure).HasConversion<string>().HasMaxLength(32);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(16);
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.Description).HasMaxLength(4000).IsRequired();
            e.Property(x => x.LegalDesignation).HasMaxLength(200).IsRequired();
            e.Property(x => x.Region).HasMaxLength(100).IsRequired();
            e.Property(x => x.Address).HasMaxLength(500).IsRequired();
            e.Property(x => x.Area).HasPrecision(18, 2);
            e.Property(x => x.AreaUnit).HasMaxLength(8).IsRequired();
            e.Property(x => x.PermittedUse).HasMaxLength(1000).IsRequired();
            e.Property(x => x.RentAmount).HasPrecision(18, 2);
            e.Property(x => x.Currency).HasMaxLength(3).IsRequired();
            e.Property(x => x.PaymentPeriod).HasMaxLength(12).IsRequired();
            e.Property(x => x.DepositAmount).HasPrecision(18, 2);
            e.Property(x => x.AdditionalCharges).HasMaxLength(1000);
            e.Property(x => x.Infrastructure).HasMaxLength(2000);
            e.Property(x => x.PhotoUrls).HasColumnType("text[]");
            e.Property(x => x.AuthorityBasis).HasMaxLength(1000).IsRequired();
            e.Property(x => x.AuthorityReference).HasMaxLength(300).IsRequired();
            e.Property(x => x.ProcedureReference).HasMaxLength(500);
            e.Property(x => x.ProcedureNotes).HasMaxLength(3000);
            e.Property(x => x.EligibilityRules).HasMaxLength(3000);
            e.Property(x => x.WithdrawalReason).HasMaxLength(2000);
            e.Property(x => x.CreatedById).HasMaxLength(64).IsRequired();
            e.Property(x => x.UpdatedById).HasMaxLength(64).IsRequired();
            e.HasIndex(x => new { x.Status, x.OwnerCategory });
            e.HasMany(x => x.DocumentRequirements).WithOne().HasForeignKey(x => x.ListingId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Documents).WithOne().HasForeignKey(x => x.ListingId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RentalDocumentRequirement>(e =>
        {
            e.ToTable("rental_document_requirements");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.ListingId).HasMaxLength(64);
            e.Property(x => x.ApplicantScope).HasMaxLength(32).IsRequired();
            e.Property(x => x.Kind).HasMaxLength(64).IsRequired();
            e.Property(x => x.Label).HasMaxLength(200).IsRequired();
            e.HasIndex(x => new { x.ListingId, x.ApplicantScope, x.Kind }).IsUnique();
        });

        modelBuilder.Entity<RentalListingDocument>(e =>
        {
            e.ToTable("rental_listing_documents");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.ListingId).HasMaxLength(64);
            e.Property(x => x.Kind).HasMaxLength(64).IsRequired();
            e.Property(x => x.FileName).HasMaxLength(255).IsRequired();
            e.Property(x => x.ContentType).HasMaxLength(100).IsRequired();
            e.Property(x => x.StorageKey).HasMaxLength(500).IsRequired();
            e.Property(x => x.UploadedById).HasMaxLength(64).IsRequired();
        });

        modelBuilder.Entity<RentalApplicantProfile>(e =>
        {
            e.ToTable("rental_applicant_profiles");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.UserId).HasMaxLength(64).IsRequired();
            e.Property(x => x.ApplicantType).HasConversion<string>().HasMaxLength(32);
            e.Property(x => x.ForeignKind).HasConversion<string>().HasMaxLength(16);
            e.HasIndex(x => x.UserId).IsUnique();
            foreach (var property in new[] { nameof(RentalApplicantProfile.FullLegalName), nameof(RentalApplicantProfile.LegalName) })
                e.Property<string>(property).HasMaxLength(300);
            e.Property(x => x.Citizenship).HasMaxLength(100);
            e.Property(x => x.CountryOfResidence).HasMaxLength(100);
            e.Property(x => x.ResidenceAddress).HasMaxLength(500);
            e.Property(x => x.IdDocumentType).HasMaxLength(100);
            e.Property(x => x.IdDocumentNumber).HasMaxLength(100);
            e.Property(x => x.Fin).HasMaxLength(32);
            e.Property(x => x.LegalForm).HasMaxLength(100);
            e.Property(x => x.CountryOfIncorporation).HasMaxLength(100);
            e.Property(x => x.RegistrationIdentifier).HasMaxLength(100);
            e.Property(x => x.TaxIdentifier).HasMaxLength(100);
            e.Property(x => x.RegisteredAddress).HasMaxLength(500);
            e.Property(x => x.ContactPhone).HasMaxLength(32).IsRequired();
            e.Property(x => x.ContactEmail).HasMaxLength(256).IsRequired();
            e.Property(x => x.ContactAddress).HasMaxLength(500);
            e.Property(x => x.RepresentativeName).HasMaxLength(300);
            e.Property(x => x.RepresentativePosition).HasMaxLength(100);
            e.Property(x => x.AuthorityToAct).HasMaxLength(500);
            e.Property(x => x.ConsentVersion).HasMaxLength(64).IsRequired();
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RentalApplication>(e =>
        {
            e.ToTable("rental_applications");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.ReferenceNumber).HasMaxLength(32).IsRequired();
            e.Property(x => x.ListingId).HasMaxLength(64).IsRequired();
            e.Property(x => x.ApplicantUserId).HasMaxLength(64).IsRequired();
            e.Property(x => x.ApplicantProfileId).HasMaxLength(64).IsRequired();
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(40);
            e.Property(x => x.IntendedUse).HasMaxLength(1000).IsRequired();
            e.Property(x => x.Message).HasMaxLength(2000);
            e.Property(x => x.AdditionalInformationResponse).HasMaxLength(2000).IsRequired();
            e.Property(x => x.ApplicantSnapshot).HasColumnType("jsonb");
            e.Property(x => x.DecisionReason).HasMaxLength(2000);
            e.Property(x => x.DecidedById).HasMaxLength(64);
            e.HasIndex(x => x.ReferenceNumber).IsUnique();
            e.HasIndex(x => new { x.ListingId, x.ApplicantUserId }).IsUnique();
            e.HasIndex(x => new { x.ListingId, x.Status });
            e.HasOne(x => x.Listing).WithMany().HasForeignKey(x => x.ListingId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<RentalApplicantProfile>().WithMany().HasForeignKey(x => x.ApplicantProfileId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.ApplicantUserId).OnDelete(DeleteBehavior.Restrict);
            e.HasMany(x => x.Documents).WithOne().HasForeignKey(x => x.ApplicationId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RentalApplicationDocument>(e =>
        {
            e.ToTable("rental_application_documents");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.ApplicationId).HasMaxLength(64);
            e.Property(x => x.Kind).HasMaxLength(64).IsRequired();
            e.Property(x => x.FileName).HasMaxLength(255).IsRequired();
            e.Property(x => x.ContentType).HasMaxLength(100).IsRequired();
            e.Property(x => x.StorageKey).HasMaxLength(500).IsRequired();
            e.HasIndex(x => new { x.ApplicationId, x.Kind });
        });

        modelBuilder.Entity<RentalApplicationHistory>(e =>
        {
            e.ToTable("rental_application_history");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.ApplicationId).HasMaxLength(64);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(40);
            e.Property(x => x.ActorId).HasMaxLength(64).IsRequired();
            e.Property(x => x.Comment).HasMaxLength(2000);
            e.HasIndex(x => new { x.ApplicationId, x.CreatedAt });
            e.HasOne<RentalApplication>().WithMany().HasForeignKey(x => x.ApplicationId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RentalLease>(e =>
        {
            e.ToTable("rental_leases");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.ListingId).HasMaxLength(64).IsRequired();
            e.Property(x => x.ApplicationId).HasMaxLength(64).IsRequired();
            e.Property(x => x.AgreementReference).HasMaxLength(200).IsRequired();
            e.Property(x => x.FinalizedById).HasMaxLength(64).IsRequired();
            e.HasIndex(x => x.ApplicationId).IsUnique();
            e.HasIndex(x => x.ListingId).IsUnique().HasFilter("\"EndedAt\" IS NULL").HasDatabaseName("ux_rental_leases_one_active_per_listing");
            e.HasOne<RentalListing>().WithMany().HasForeignKey(x => x.ListingId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<RentalApplication>().WithMany().HasForeignKey(x => x.ApplicationId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<RentalAuditEntry>(e =>
        {
            e.ToTable("rental_audit");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.ActorId).HasMaxLength(64).IsRequired();
            e.Property(x => x.Action).HasMaxLength(64).IsRequired();
            e.Property(x => x.ObjectType).HasMaxLength(32).IsRequired();
            e.Property(x => x.ObjectId).HasMaxLength(64).IsRequired();
            e.HasIndex(x => new { x.ObjectType, x.ObjectId, x.At });
        });

        modelBuilder.Entity<ChatMessage>(e =>
        {
            e.ToTable("chat_messages");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.ProposalId).HasMaxLength(64).IsRequired();
            e.Property(x => x.SenderId).HasMaxLength(64).IsRequired();
            e.Property(x => x.Body).HasMaxLength(2000).IsRequired();
            e.HasIndex(x => new { x.ProposalId, x.CreatedAt, x.Id });
            e.HasOne<Proposal>().WithMany().HasForeignKey(x => x.ProposalId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.SenderId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Favorite>(e =>
        {
            e.ToTable("favorites");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.UserId).HasMaxLength(64);
            e.Property(x => x.LandId).HasMaxLength(64);
            e.HasIndex(x => new { x.UserId, x.LandId }).IsUnique();
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Land).WithMany().HasForeignKey(x => x.LandId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Notification>(e =>
        {
            e.ToTable("notifications");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.UserId).HasMaxLength(64);
            e.Property(x => x.Title).HasMaxLength(300);
            e.Property(x => x.Message).HasMaxLength(2000);
            e.HasIndex(x => new { x.UserId, x.CreatedAt });
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<IntegrationLog>(e =>
        {
            e.ToTable("integration_logs");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.IntegrationType).HasMaxLength(100);
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.RequestPayload).HasColumnType("jsonb");
            e.Property(x => x.ResponsePayload).HasColumnType("jsonb");
        });

        modelBuilder.Entity<ImportRun>(e =>
        {
            e.ToTable("import_runs");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.Source).HasMaxLength(100);
            e.HasIndex(x => x.Source).IsUnique();
            e.Property(x => x.Summary).HasMaxLength(2000);
        });
    }
}
