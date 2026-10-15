using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Features.Admin;
using QarabagInvestmentPortal.Api.Features.Favorites;
using QarabagInvestmentPortal.Api.Features.Lands;
using QarabagInvestmentPortal.Api.Features.Notifications;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Features.Proposals;
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
    public DbSet<InvestmentOpportunity> Opportunities => Set<InvestmentOpportunity>();
    public DbSet<Proposal> Proposals => Set<Proposal>();
    public DbSet<ProposalDocument> ProposalDocuments => Set<ProposalDocument>();
    public DbSet<ProposalHistoryEntry> ProposalHistory => Set<ProposalHistoryEntry>();
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
            e.Property(x => x.ReviewNote).HasMaxLength(2000);
            e.Property(x => x.OwnerNote).HasMaxLength(2000);
            e.Property(x => x.ReviewedById).HasMaxLength(64);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.OwnerId);
            e.HasMany(x => x.Documents).WithOne().HasForeignKey(d => d.LandId).OnDelete(DeleteBehavior.Cascade);
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
            e.Property(x => x.CreatedById).HasMaxLength(64);
            e.HasIndex(x => x.Status);

            // One active (published) opportunity per land.
            e.HasIndex(x => x.LandId)
                .IsUnique()
                .HasFilter("\"Status\" = 'Active'")
                .HasDatabaseName("ux_opportunities_one_active_per_land");
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
