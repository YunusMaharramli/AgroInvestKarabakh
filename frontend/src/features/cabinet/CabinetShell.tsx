import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, ChevronsLeft, ChevronsRight, HelpCircle, LogOut, Settings, User, Globe, Repeat } from 'lucide-react';
import { Logo } from '../../components/layout/Logo';
import { LanguageSwitcher } from '../../components/layout/LanguageSwitcher';
import { useFormat, useLocalePath } from '../../app/i18n';
import { authService, notificationService, useCurrentUser, useDbValue } from '../../services/api';
import { ConfirmDialog, useDismiss, useToast } from '../../components/ui/Overlay';
import { useSiteModals } from '../../components/layout/SiteModals';
import { useLandNameById } from '../shared/landText';
import { CompareBar } from '../compare/CompareContext';
import type { CabinetRole } from '../../types/agro';

export interface NavItem { to: string; label: string; icon: React.ReactNode; end?: boolean }

const initials = (name: string) => name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

export const Avatar: React.FC<{ name: string; size?: 'sm' | 'md'; gold?: boolean }> = ({ name, size = 'md', gold }) => (
  <span className={`rounded-full grid place-items-center font-bold shrink-0 ${size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'} ${gold ? 'bg-gold text-forest' : 'bg-brand text-white'}`} aria-hidden="true">{initials(name)}</span>
);

const Notifications: React.FC<{ userId: string }> = ({ userId }) => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  const landName = useLandNameById();
  const f = useFormat();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), ref);
  const items = useDbValue(() => notificationService.forUser(userId));
  const unread = items.filter(n => !n.read).length;
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="true"
        aria-label={`${t('cabinet.notifications')}${unread ? ` (${unread} ${t('cabinet.unread')})` : ''}`} className="relative p-2.5 rounded-full hover:bg-sand">
        <Bell className="w-5 h-5" />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-danger ring-2 ring-white" aria-hidden="true" />}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-white border border-line shadow-[var(--shadow-lift)] z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <p className="font-bold">{t('cabinet.notifications')}</p>
            {unread > 0 && <button type="button" onClick={() => notificationService.markAllRead(userId)} className="text-xs font-bold text-leaf-dark hover:underline">{t('cabinet.markAll')}</button>}
          </div>
          <ul className="max-h-96 overflow-y-auto divide-y divide-line">
            {items.length === 0 && <li className="p-6 text-center text-muted text-sm">{t('cabinet.noNotifications')}</li>}
            {items.map(n => (
              <li key={n.id}>
                <Link to={n.link ? lp(n.link) : '#'} onClick={() => { notificationService.markRead(n.id); setOpen(false); }} className="flex gap-3 px-4 py-3 hover:bg-cream">
                  <span className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.read ? 'bg-transparent' : 'bg-danger'}`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className={`block text-sm ${n.read ? 'text-muted' : 'font-semibold'}`}>{t(n.textKey, { ...n.values, land: n.values?.land ? landName(String(n.values.land)) : '' })}</span>
                    <span className="block text-xs text-muted mt-0.5">{f.date(n.createdAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const AccountMenu: React.FC<{ role: CabinetRole }> = ({ role }) => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  const navigate = useNavigate();
  const user = useCurrentUser()!;
  const { openHelp } = useSiteModals();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), ref);
  const base = role === 'landowner' ? '/owner' : '/investor';
  const item = 'flex items-center gap-3 w-full px-4 py-2.5 text-sm font-semibold hover:bg-sage text-left';
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="menu" aria-label={t('cabinet.account')} className="flex items-center rounded-full hover:ring-2 hover:ring-sand">
        <Avatar name={user.fullName} gold={role === 'investor'} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white border border-line shadow-[var(--shadow-lift)] z-50 py-2">
          <div className="px-4 py-2 border-b border-line mb-1">
            <p className="font-bold truncate">{user.fullName}</p>
            <p className="text-xs text-muted truncate">{user.email}</p>
          </div>
          <Link role="menuitem" to={lp(`${base}/settings`)} className={item} onClick={() => setOpen(false)}><User className="w-4 h-4 text-leaf" />{t('cabinet.profile')}</Link>
          <Link role="menuitem" to={lp(`${base}/settings#preferences`)} className={item} onClick={() => setOpen(false)}><Settings className="w-4 h-4 text-leaf" />{t('cabinet.settings')}</Link>
          <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); openHelp('faq'); }}><HelpCircle className="w-4 h-4 text-leaf" />{t('cabinet.help')}</button>
          <Link role="menuitem" to={lp('/')} className={item} onClick={() => setOpen(false)}><Globe className="w-4 h-4 text-leaf" />{t('cabinet.website')}</Link>
          <button role="menuitem" type="button" className={`${item} text-danger border-t border-line mt-1`} onClick={() => { authService.logout(); navigate(lp('/login')); }}><LogOut className="w-4 h-4" />{t('cabinet.logout')}</button>
        </div>
      )}
    </div>
  );
};

/** Shared dashboard layout for both cabinets (Part 2, section 2). Also guards the routes. */
export const CabinetShell: React.FC<{ role: CabinetRole; nav: NavItem[] }> = ({ role, nav }) => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  const navigate = useNavigate();
  const toast = useToast();
  const { pathname } = useLocation();
  const user = useCurrentUser();
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('agroinvest_sidebar') === '1'; } catch { return false; } });
  const [become, setBecome] = useState(false);
  useEffect(() => { try { localStorage.setItem('agroinvest_sidebar', collapsed ? '1' : '0'); } catch { /* ignore */ } }, [collapsed]);
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  if (!user) return <Navigate to={lp('/login')} replace />;
  if (user.isAdmin) return <Navigate to={lp('/admin')} replace />;
  if (user.needsOnboarding) return <Navigate to={lp('/signup?step=details')} replace />;

  const other: CabinetRole = role === 'landowner' ? 'investor' : 'landowner';
  const hasOther = user.roles.includes(other);
  const investor = role === 'investor';
  const otherCabinetName = other === 'investor' ? t('cabinet.investorBadge') : t('cabinet.ownerBadge');
  const switchTo = () => {
    authService.rememberCabinet(null);
    navigate(lp(other === 'investor' ? '/investor' : '/owner'));
  };
  const accent = investor ? '#C9A54C' : '#1F4D2E';

  return (
    <div className="min-h-[100svh] bg-cream" style={{ ['--accent' as string]: accent }}>
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-line">
        <div className="flex items-center gap-3 h-16 px-4 lg:px-6">
          <Link to={lp(investor ? '/investor' : '/owner')} aria-label={t(investor ? 'cabinet.investorBadge' : 'cabinet.ownerBadge')} className="flex items-center gap-3 min-w-0">
            <span className="sm:hidden"><Logo compact /></span><span className="hidden sm:inline"><Logo /></span>
          </Link>
          <span className={`hidden md:inline-flex rounded-full px-3 py-1 text-xs font-bold ${investor ? 'bg-[#F4ECD6] text-gold-dark' : 'bg-sage text-brand'}`}>{investor ? t('cabinet.investorBadge') : t('cabinet.ownerBadge')}</span>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">

            <Notifications userId={user.id} />
            <LanguageSwitcher className="hidden sm:inline-flex" />
            <AccountMenu role={role} />
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar (desktop) */}
        <aside className={`hidden lg:flex flex-col sticky top-16 h-[calc(100svh-4rem)] border-r border-line bg-white transition-all ${collapsed ? 'w-[76px]' : 'w-64'}`}>
          <nav aria-label={investor ? t('cabinet.investorBadge') : t('cabinet.ownerBadge')} className="flex-1 p-3 flex flex-col gap-1">
            {nav.map(n => (
              <NavLink key={n.to} to={n.to} end={n.end} title={collapsed ? n.label : undefined}
                className={({ isActive }) => `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? (investor ? 'bg-sage text-brand' : 'bg-brand text-white') : 'text-ink hover:bg-sage'}`}>
                {({ isActive }) => <>
                  <span className="shrink-0" aria-hidden="true">{n.icon}</span>
                  <span className={collapsed ? 'sr-only' : 'truncate'}>{n.label}</span>
                  {isActive && investor && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-gold" aria-hidden="true" />}
                </>}
              </NavLink>
            ))}
          </nav>
          <div className="p-3 border-t border-line">
            <button type="button" onClick={() => setCollapsed(c => !c)} className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-muted hover:bg-sage" aria-label={collapsed ? t('cabinet.expand') : t('cabinet.collapse')}>
              {collapsed ? <ChevronsRight className="w-5 h-5" /> : <><ChevronsLeft className="w-5 h-5" />{t('cabinet.collapse')}</>}
            </button>
          </div>
        </aside>

        <main id="main" className={`flex-1 min-w-0 px-4 sm:px-6 lg:px-10 py-8 ${investor ? 'pb-44 lg:pb-32' : 'pb-28 lg:pb-12'}`}>
          <Suspense fallback={<div className="grid gap-4" aria-busy="true"><div className="skeleton h-10 w-72" /><div className="skeleton h-40" /><div className="skeleton h-40" /></div>}><Outlet /></Suspense>
        </main>
      </div>

      {/* Bottom tab bar (mobile) */}
      <nav aria-label={investor ? t('cabinet.investorBadge') : t('cabinet.ownerBadge')} className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-line grid" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0,1fr))` }}>
        {nav.map(n => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[0.6rem] font-bold leading-tight text-center ${isActive ? (investor ? 'text-gold-dark' : 'text-brand') : 'text-muted'}`}>
            <span aria-hidden="true">{n.icon}</span><span className="line-clamp-2 px-0.5 break-words hyphens-auto">{n.label}</span>
          </NavLink>
        ))}
      </nav>

      {investor && !/\/investor\/(compare|settings)/.test(pathname) && <CompareBar />}


    </div>
  );
};

export const PageTitle: React.FC<{ title: string; subtitle?: string; actions?: React.ReactNode }> = ({ title, subtitle, actions }) => {
  useEffect(() => { document.title = `${title} · AgroMatch`; }, [title]);
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
      <div>
        <h1 className="font-display text-3xl lg:text-4xl text-brand">{title}</h1>
        {subtitle && <p className="text-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
};
