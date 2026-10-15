# Investor sign-up and administrator accounts

## Who logs in

| Account | How it is created | Role |
|---|---|---|
| Administrator | Only from the database (configuration list, see below). No sign-up. At most **10**. | `ADMIN` |
| Investor (applicant) | Sign-up page, one of four applicant types | `USER` |

Applicant types (`ApplicantType` on the user) are **profile data, not roles**: every applicant has the `USER` role.

| Type | Step 1 (account) | Step 3 (additional information) |
|---|---|---|
| `INDIVIDUAL` | full name, email, phone, password + confirm, terms. Alternatives shown (not connected yet): myGov ID, ASAN İmza, SİMA | marital status (single / married), income over the last 6 months, loan (yes → monthly payment), fixed income (yes → monthly amount), minimum funds for the initial payment |
| `LEGAL_ENTITY` | company name, company email, VÖEN (10 digits, unique), password + confirm, terms. Alternative shown: e-qanun.az | address, field of activity, activity start date, CEO, minimum company funds for a project |
| `FOREIGN_INDIVIDUAL` | name, email, password + confirm, terms. Alternative shown: visitor account for foreign citizens | living status in Azerbaijan, address, income source, loan (yes → monthly payment), minimum funds for a project |
| `FOREIGN_ENTITY` | full company name, foreign tax number, VÖEN in Azerbaijan (optional), company email, password + confirm, terms | country (ISO list), status in Azerbaijan, address, main field of activity, CEO |

## Flow

1. `POST /api/auth/register` with `applicantType` → account created, confirmation email sent, response carries a `signupToken` (24 h).
2. The sign-up page polls `POST /api/auth/signup/status { signupToken }` and shows *Təsdiq gözlənilir* / *E-poçt təsdiqləndi*. "Davam et" is enabled only after confirmation; the page also offers *resend link* and *back to login*.
3. `POST /api/auth/signup/details` with the type's fields (and the `signupToken`, or a signed-in session) → profile saved, account signed in → investor panel.

An applicant who leaves before step 3 can log in later: the login response has `user.needsOnboarding = true` and the site sends them to step 3; the investor panel stays closed until it is done. The data is shown under *Profil və ayarlar → İnvestor profili*.

Forgot password (investors): email link → new password → back to the login page.

## Administrators

* Listed under `Admins:Accounts` (email, first/last name, password). Locally the list is in the git-ignored
  `src/QarabagInvestmentPortal.Api/admins.local.json`; in other environments use user-secrets or environment variables
  (`Admins__Accounts__0__Email`, …).
* Written to the database at start-up (`AdminAccountSeeder`; runs when `Database:MigrateOnStartup` is on, or set `Admins:SeedOnStartup=true`): a missing account is created with the given password and a
  confirmed email; an existing account is promoted and **keeps its password**. Nothing is created beyond 10 admins.
* Admins cannot change their password (`/auth/change-password` → 403) and cannot use *forgot password* (403 with the
  message that this is an admin account). Their passwords are managed in the database only.
