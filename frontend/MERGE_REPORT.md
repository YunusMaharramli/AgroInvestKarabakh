# AGROInvest frontend — build report (Part 1 + Part 2)

Stack: React 19 + TypeScript + Vite 8 + Tailwind CSS 4, react-router-dom 7 (language-prefixed routes),
i18next / react-i18next (az · en · ru), @vis.gl/react-google-maps (Google Maps JS API), Recharts (charts),
self-hosted fonts via @fontsource (Playfair Display + Manrope, Latin-Extended + Cyrillic).

Data: **mock** (decided with the client), **except accounts**: sign-up, email confirmation, login, resend link,
forgot/reset password and change password call the real backend (`src/services/backend.ts`). The backend emails a
**confirmation link** (`/confirm-email?token=…`) — in development the email is caught by Mailpit (http://localhost:8025).
The three test accounts below still log in against mock data, so the cabinets can be tried without the database. All data access goes through `src/services/api.ts`
(authService, landService, requestService, notificationService). Mock state lives in localStorage
(`src/services/db.ts`), seeded from `src/mocks/seed.ts` and `src/mocks/projects.json`.
Replace the service functions with HTTP calls to connect the real backend.

Business rule (decided with the client): **one winner per listing** — the landowner selects one investor;
the listing closes and every other pending request becomes "Not selected" (`requestService.selectWinner`).

## Routes (all prefixed with /az, /en or /ru; "/" redirects to the saved language, default az)

Public: `/` · `/about` · `/investments` · `/owners` · `/guides` · `/lands/:id`
Auth: `/login` · `/signup` (steps: `?step=check-email|role|profile-landowner|profile-investor`) · `/confirm-email?token=` · `/forgot-password` · `/reset-password?token=` · `/choose-cabinet`
(The email links have no language prefix; the router adds it and keeps the token.)
Landowner: `/owner` · `/owner/add-land` · `/owner/properties` · `/owner/properties/:id` · `/owner/requests` · `/owner/insights` · `/owner/settings`
Investor: `/investor` · `/investor/search` · `/investor/lands/:id` · `/investor/compare` · `/investor/investments` · `/investor/saved` · `/investor/settings`
Cabinet routes redirect to `/login` when logged out and to `/choose-cabinet` when the user lacks that cabinet.

## Components

- Layout: `Header` (logo, nav, Contact/Help dropdowns, login/cabinet button, language switcher, mobile drawer), `Footer` (brand band, two-column footer, bottom bar), `NewsletterForm`, `LanguageSwitcher`, `Logo` (temporary in-code wordmark), `SiteModalsProvider` (contact form modal, help centre with FAQ accordion)
- Sections: `HeroSlider` (crossfade + parallax), `PageHero`, `SplitSection`, `VideoSection`, `VideoSplitDark`, `VideoPlayer`, `ParallaxBanner`, `CTABanner`, `SectionHeading`, `CategoryGrid`, `ProjectsCarousel`, `FieldTypeCard`
- Map: `LandsMap` (colour-coded markers by group, legend + filter chips, info window, scroll-zoom after click), `PinPicker`, `SingleLandMap` — fall back to a location list when no API key is set
- UI kit: `Modal`, `ConfirmDialog`, `Drawer`, `ToastProvider/useToast`, `StatusBadge`, `RequestBadge`, `RiskBadge` (tooltip), `VerifiedBadge`, `ScoreGauge`, `ProgressBar`, `Tabs` (counters), `Stepper`, `RangeSlider` (dual), `Chips`, `Segmented`, `Toggle`, `StatCard`, `EmptyState`, `SkeletonCard`, `ErrorState`, `Field`, `Photo` (placeholder when a photo is missing), `Reveal`
- Auth: `AuthLayout` (split screen), `LoginPage`, `SignupPage` (3 steps + "check your email" link screen), `ConfirmEmailPage`, `ResetPasswordPage`, `ForgotPage`, `ChooseCabinetPage`
- Cabinets: `CabinetShell` (top bar, role switch / "Become…", notifications, account menu, collapsible sidebar, mobile tab bar), `SettingsPage`
- Landowner: `OwnerOverview`, `AddLandWizard` (6 steps, draft, drag-and-drop photos with cover + reorder, PDFs), `OwnerProperties` (grid/list, filters, ⋯ menu), `OwnerRequests` (table/cards, search, filter, sort, pagination, side drawer, select-winner dialog), `OwnerInsights` (bar chart, ranges, top regions, vs market)
- Investor: `InvestorOverview`, `InvestorSearch` (filter panel / bottom sheet, sort, list/map, load more), `LandResultCard`, `LandDetail` (gallery + lightbox, metrics + "Why this score?", key facts, map, sticky invest box + request modal), `InvestorInvestments` (tabs + status timeline), `InvestorSaved`
- Compare: `CompareProvider`, `CompareBar` (sticky, max 2), `ComparePage` (pickers, swap, table with "Better", radar chart, verdict)
- Scoring: `src/services/scoring.ts` → `scoreLand(land, filters)`, `landRisk(land)` (replaceable)

## Chat assistant (AgroKöməkçi)

Restored from the previous site as `src/components/assistant/AgroAssistant.tsx` (floating button on public pages and in
the cabinets, hidden on sign-in pages). It calls the backend `POST /api/ai/chat` (Gemini key stays on the server);
without the backend it shows a "no connection" message with the help line. Old route suggestions from the server
(`/opportunities`, `/lands/new`, …) are mapped to the new pages.

## Translation files

`src/locales/az.json`, `en.json`, `ru.json` (identical key sets). Top-level namespaces:
`meta, brand, lang, nav, contact, help, footer, form, home, video, about, investments, owners, guides, map, groups,
fieldTypes, fieldTypeInfo, regions, land, soil, irrigationTypes, models, crops, status, reqStatus, risk, auth, cabinet,
notifications, owner, requestMessages, investor, requests, compare, settings, common`.

## Configuration

`frontend/.env` (copy from `.env.example`):
- `GOOGLE_MAPS_API_KEY=` — Google Maps JavaScript API key (restrict it to your domains)
- `VITE_HIDE_TEST_ACCOUNTS=true` — hides the test-account hint on the login page

Test accounts (password `Test1234`): both@agroinvest.az (both cabinets), owner@agroinvest.az, investor@agroinvest.az.

## Assets still needed

- Logo file (a temporary in-code wordmark is used)
- Videos: how-it-works (Home), About intro, investor guide, owner guide → put files in `public/videos/` and set `VIDEOS` in `src/features/public/PublicPages.tsx`
- Category photos for: poultry, fishery, cold storage, forestry, holiday homes, residential, commercial, roadside, industry, logistics, sport, social (placeholders shown); the agrotourism, camping, renewable and processing cards use the closest available photo

## Not changed

The previous pages in `src/pages`, `src/components/{Header,Footer,AgroAssistant}.tsx` (the assistant now lives in `components/assistant`), `src/context/*` and `src/App.tsx`
(including the teammate's email-confirmation / password-reset pages that talk to the real backend) are still in the
repository but no longer rendered. They are the reference for the API calls when the mock services are replaced.
