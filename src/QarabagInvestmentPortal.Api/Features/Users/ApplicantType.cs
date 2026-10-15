namespace QarabagInvestmentPortal.Api.Features.Users;

/// <summary>
/// The kind of investor (applicant). Chosen at sign-up and kept on the account as profile data.
/// It never grants permissions: authorization uses <see cref="UserRole"/> only.
/// </summary>
public enum ApplicantType
{
    Individual,
    LegalEntity,
    ForeignIndividual,
    ForeignEntity,
}

public enum MaritalStatus
{
    Single,
    Married,
}
