import React, { lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChart3, Compass, Heart, Home, Inbox, LayoutGrid, Plus, Scale, Search, Settings, TrendingUp } from 'lucide-react';
import { applyLang, isLang, savedLang, useLocalePath } from './i18n';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { SiteModalsProvider } from '../components/layout/SiteModals';
import { ToastProvider } from '../components/ui/Overlay';
import { HomePage, AboutPage, InvestmentsPage, GuidesPage, NotFoundPage } from '../features/public/PublicPages';
import { PublicLandPage, LandDetail } from '../features/shared/LandDetail';
import { LoginPage, SignupPage, ForgotPage, ConfirmEmailPage, ResetPasswordPage } from '../features/auth/AuthPages';
import { CabinetShell } from '../features/cabinet/CabinetShell';
import { AgroAssistant } from '../components/assistant/AgroAssistant';

// Cabinet pages are loaded on demand so the public website stays light (charts etc. load only when needed)
const SettingsPage = lazy(() => import('../features/cabinet/SettingsPage').then(m => ({ default: m.SettingsPage })));
const InvestorOverview = lazy(() => import('../features/investor/InvestorPages').then(m => ({ default: m.InvestorOverview })));
const InvestorSearch = lazy(() => import('../features/investor/InvestorPages').then(m => ({ default: m.InvestorSearch })));
const InvestorInvestments = lazy(() => import('../features/investor/InvestorPages').then(m => ({ default: m.InvestorInvestments })));
const InvestorSaved = lazy(() => import('../features/investor/InvestorPages').then(m => ({ default: m.InvestorSaved })));
const ComparePage = lazy(() => import('../features/compare/ComparePage').then(m => ({ default: m.ComparePage })));
const AdminShell = lazy(() => import('../features/admin/AdminPages').then(m => ({ default: m.AdminShell })));
const AdminLandsPage = lazy(() => import('../features/admin/AdminPages').then(m => ({ default: m.AdminLandsPage })));
const AdminApplicationsPage = lazy(() => import('../features/admin/AdminApplicationsPage'));
const AdminLandEditor = lazy(() => import('../features/admin/AdminPages').then(m => ({ default: m.AdminLandEditor })));
const AdminInvestorsPage = lazy(() => import('../features/admin/AdminPanelPages').then(m => ({ default: m.AdminInvestorsPage })));
const AdminStatisticsPage = lazy(() => import('../features/admin/AdminPanelPages').then(m => ({ default: m.AdminStatisticsPage })));

import { CompareProvider } from '../features/compare/CompareContext';
import { authService, refreshPortal } from '../services/api';

/** Keeps i18next, <html lang> and storage in sync with the /:lang prefix; fixes unknown prefixes. */
const LangGuard: React.FC = () => {
  const { lang } = useParams();
  const { pathname, search, hash } = useLocation();
  useEffect(() => { if (isLang(lang)) applyLang(lang); }, [lang]);
  if (!isLang(lang)) return <Navigate to={`/${savedLang()}${pathname}${search}${hash}`} replace />;
  return <><Outlet /><AgroAssistant /></>;
};

const ScrollToTop: React.FC = () => {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) { const el = document.getElementById(hash.slice(1)); if (el) { el.scrollIntoView(); return; } }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
};

const PublicLayout: React.FC = () => (
  <>
    <Header />
    <main id="main"><Outlet /></main>
    <Footer />
  </>
);

const InvestorLayout: React.FC = () => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  return <CabinetShell role="investor" nav={[
    { to: lp('/investor'), label: t('investor.nav.overview'), icon: <Compass className="w-5 h-5" />, end: true },
    { to: lp('/investor/search'), label: t('investor.nav.search'), icon: <Search className="w-5 h-5" /> },
    { to: lp('/investor/compare'), label: t('investor.nav.compare'), icon: <Scale className="w-5 h-5" /> },
    { to: lp('/investor/investments'), label: t('investor.nav.investments'), icon: <TrendingUp className="w-5 h-5" /> },
    { to: lp('/investor/saved'), label: t('investor.nav.saved'), icon: <Heart className="w-5 h-5" /> },
    { to: lp('/investor/settings'), label: t('investor.nav.settings'), icon: <Settings className="w-5 h-5" /> },
  ]} />;
};

export const AppRouter: React.FC = () => {
  // Listings published by the ministry (real backend) join the site's land lists.
  const [loadError, setLoadError] = React.useState('');
  const [authReady, setAuthReady] = React.useState(!authService.hasBackendSession());
  useEffect(() => {
    let alive = true;
    const refresh = () => refreshPortal().then(() => { if (alive) setLoadError(''); }).catch(() => { if (alive) setLoadError('Portal məlumatları yüklənmədi. Səhifəni yeniləyin.'); });
    void authService.refreshRole().catch(() => false).finally(() => {
      if (alive) setAuthReady(true);
      void refresh();
    });
    const timer = window.setInterval(() => { void refresh(); }, 30000);
    return () => { alive = false; clearInterval(timer); };
  }, []);
  return (
  <BrowserRouter>
    <ToastProvider>
      <SiteModalsProvider>
        <CompareProvider>
          <ScrollToTop />
          {loadError && <p role="alert" className="bg-sand text-danger p-3 text-center">{loadError}</p>}
          {!authReady ? <div className="min-h-[100svh] grid place-items-center bg-cream" aria-busy="true"><div className="skeleton h-10 w-64" /></div> : <Routes>
            <Route path="/" element={<Navigate to={`/${savedLang()}`} replace />} />
            <Route path="/:lang" element={<LangGuard />}>
              <Route element={<PublicLayout />}>
                <Route index element={<HomePage />} />
                <Route path="about" element={<AboutPage />} />
                <Route path="investments" element={<InvestmentsPage />} />
                <Route path="owners" element={<Navigate to="../investments" replace />} />
                <Route path="guides" element={<GuidesPage />} />
                <Route path="lands/:id" element={<PublicLandPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
              <Route path="login" element={<LoginPage />} />
              <Route path="signup" element={<SignupPage />} />
              <Route path="forgot-password" element={<ForgotPage />} />
              {/* Links in the emails sent by the backend: /confirm-email?token=… and /reset-password?token=…
                  (LangGuard adds the language prefix and keeps the token). */}
              <Route path="confirm-email" element={<ConfirmEmailPage />} />
              <Route path="reset-password" element={<ResetPasswordPage />} />
              <Route path="verify-email" element={<Navigate to="../signup?step=check-email" replace />} />
              <Route path="choose-cabinet" element={<Navigate to="../investor" replace />} />
              <Route path="owner/*" element={<Navigate to="../investor" replace />} />
              <Route path="investor" element={<InvestorLayout />}>
                <Route index element={<InvestorOverview />} />
                <Route path="search" element={<InvestorSearch />} />
                <Route path="lands/:id" element={<LandDetail mode="investor" />} />
                <Route path="compare" element={<ComparePage />} />
                <Route path="investments" element={<InvestorInvestments />} />
                <Route path="saved" element={<InvestorSaved />} />
                <Route path="settings" element={<SettingsPage role="investor" />} />
              </Route>
              <Route path="admin" element={<React.Suspense fallback={null}><AdminShell /></React.Suspense>}>
                <Route index element={<AdminLandsPage />} />
                <Route path="applications" element={<AdminApplicationsPage />} />
                <Route path="investors" element={<AdminInvestorsPage />} />
                <Route path="statistics" element={<AdminStatisticsPage />} />
                <Route path="lands/new" element={<AdminLandEditor />} />
                <Route path="lands/:id" element={<AdminLandEditor />} />
              </Route>
            </Route>
          </Routes>}
        </CompareProvider>
      </SiteModalsProvider>
    </ToastProvider>
  </BrowserRouter>
  );
};
