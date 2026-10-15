import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Menu, X, Mail, Phone, MessageCircle, MapPin, Send, HelpCircle, TrendingUp, Sprout, UserCog, Flag, LayoutDashboard } from 'lucide-react';
import { Logo } from './Logo';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useLocalePath } from '../../app/i18n';
import { useDismiss } from '../ui/Overlay';
import { useSiteModals } from './SiteModals';
import { useCurrentUser } from '../../services/api';
import { cabinetHome } from '../../features/auth/routing';

/** Placeholder contact details — replace with the real ones. */
export const CONTACT = {
  email: 'info@agroinvest.az',
  phone: '+994 12 000 00 00',
  phoneHref: 'tel:+994120000000',
  whatsapp: 'https://wa.me/994500000000',
  maps: 'https://maps.google.com/?q=28+May+street+12+Baku',
};

type DropItem = { label: string; icon: React.ReactNode; href?: string; external?: boolean; onClick?: () => void };

const NavDropdown: React.FC<{ label: string; items: DropItem[]; overlay: boolean; id: string }> = ({ label, items, overlay, id }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  useDismiss(open, () => setOpen(false), ref);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    const els = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
  };
  return (
    <div ref={ref} className="relative" onKeyDown={onKeyDown}
      onMouseEnter={() => { window.clearTimeout(timer.current); setOpen(true); }}
      onMouseLeave={() => { timer.current = window.setTimeout(() => setOpen(false), 150); }}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 px-3 py-2 text-[0.92rem] font-semibold rounded-full whitespace-nowrap ${overlay ? 'text-white/90 hover:text-white' : 'text-ink hover:text-brand'}`}>
        {label}<ChevronDown className={`w-4 h-4 transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div id={id} role="menu" className="absolute left-1/2 -translate-x-1/2 top-full pt-2 z-50">
          <div className="w-64 rounded-2xl bg-white border border-line shadow-[var(--shadow-lift)] p-2">
            {items.map(it => {
              const cls = 'flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-ink hover:bg-sage focus:bg-sage';
              const inner = <><span className="text-leaf" aria-hidden="true">{it.icon}</span>{it.label}</>;
              return it.href
                ? <a key={it.label} role="menuitem" href={it.href} target={it.external ? '_blank' : undefined} rel={it.external ? 'noopener noreferrer' : undefined} className={cls} onClick={() => setOpen(false)}>{inner}</a>
                : <button key={it.label} role="menuitem" type="button" className={cls} onClick={() => { setOpen(false); it.onClick?.(); }}>{inner}</button>;
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/** Pages whose first section is a full-bleed photo hero: the header sits on top of it until scrolled. */
const HERO_PAGES = [/^\/(az|en|ru)\/?$/, /^\/(az|en|ru)\/investments\/?$/, /^\/(az|en|ru)\/owners\/?$/];

export const Header: React.FC = () => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  const { pathname } = useLocation();
  const user = useCurrentUser();
  const { openContact, openHelp } = useSiteModals();
  const [scrolled, setScrolled] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const hasHero = HERO_PAGES.some(r => r.test(pathname));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > Math.max(120, window.innerHeight * 0.75 - 140));
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname]);
  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [drawer]);

  const overlay = hasHero && !scrolled;
  const links = [
    { to: lp('/'), label: t('nav.home'), end: true },
    { to: lp('/about'), label: t('nav.about') },
    { to: lp('/investments'), label: t('nav.investments') },
    { to: lp('/guides'), label: t('nav.guides') },
  ];
  const contactItems: DropItem[] = [
    { label: t('contact.email'), icon: <Mail className="w-4 h-4" />, href: `mailto:${CONTACT.email}` },
    { label: t('contact.call'), icon: <Phone className="w-4 h-4" />, href: CONTACT.phoneHref },
    { label: t('contact.whatsapp'), icon: <MessageCircle className="w-4 h-4" />, href: CONTACT.whatsapp, external: true },
    { label: t('contact.office'), icon: <MapPin className="w-4 h-4" />, onClick: () => document.getElementById('footer-address')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) },
    { label: t('contact.message'), icon: <Send className="w-4 h-4" />, onClick: openContact },
  ];
  const helpItems: DropItem[] = [
    { label: t('help.faq'), icon: <HelpCircle className="w-4 h-4" />, onClick: () => openHelp('faq') },
    { label: t('help.howInvest'), icon: <TrendingUp className="w-4 h-4" />, onClick: () => openHelp('invest') },
    { label: t('help.howList'), icon: <Sprout className="w-4 h-4" />, onClick: () => openHelp('list') },
    { label: t('help.account'), icon: <UserCog className="w-4 h-4" />, onClick: () => openHelp('account') },
    { label: t('help.report'), icon: <Flag className="w-4 h-4" />, onClick: () => openHelp('report') },
  ];
  const cabinetLink = user ? lp(cabinetHome(user)) : lp('/login');
  const linkCls = (active: boolean) =>
    `relative px-3 py-2 text-[0.92rem] font-semibold whitespace-nowrap transition ${overlay ? (active ? 'text-white' : 'text-white/85 hover:text-white') : active ? 'text-brand' : 'text-ink hover:text-brand'}`;

  return (
    <header className={`${hasHero ? 'fixed' : 'sticky'} top-0 inset-x-0 z-50 transition-colors duration-300 ${overlay ? 'bg-gradient-to-b from-forest/70 to-transparent' : 'bg-cream/95 backdrop-blur border-b border-line shadow-sm'}`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 btn btn-primary">{t('nav.skip')}</a>
      <div className="container-x">
        {/* Desktop: logo centred above the navigation bar */}
        <div className={`hidden xl:flex flex-col items-center transition-all ${scrolled || !hasHero ? 'pt-2' : 'pt-4'}`}>
          <Link to={lp('/')} aria-label={t('nav.home')} className={`transition-all ${scrolled ? 'scale-90' : ''}`}><Logo light={overlay} /></Link>
          <nav aria-label={t('nav.primary')} className="w-full grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2">
            <div aria-hidden="true" />
            <ul className="flex items-center gap-0.5">
              {links.map(l => (
                <li key={l.to}>
                  <NavLink to={l.to} end={l.end} className={({ isActive }) => linkCls(isActive)}>
                    {({ isActive }) => <>{l.label}{isActive && <span className={`absolute left-3 right-3 -bottom-0.5 h-0.5 rounded-full ${overlay ? 'bg-gold' : 'bg-gold'}`} />}</>}
                  </NavLink>
                </li>
              ))}
              <li><NavDropdown id="menu-contact" label={t('nav.contact')} items={contactItems} overlay={overlay} /></li>
              <li><NavDropdown id="menu-help" label={t('nav.help')} items={helpItems} overlay={overlay} /></li>
            </ul>
            <div className="flex items-center justify-end gap-3">
              <Link to={cabinetLink} className={`btn btn-sm ${overlay ? 'btn-gold' : 'btn-primary'}`}>
                {user ? <><LayoutDashboard className="w-4 h-4" aria-hidden="true" />{t('nav.myCabinet')}</> : t('nav.login')}
              </Link>
              <LanguageSwitcher light={overlay} />
            </div>
          </nav>
        </div>

        {/* Mobile / tablet bar */}
        <div className="xl:hidden flex items-center justify-between h-16">
          <Link to={lp('/')} aria-label={t('nav.home')}><Logo light={overlay} /></Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher light={overlay} className="hidden sm:inline-flex" />
            <button type="button" onClick={() => setDrawer(true)} aria-label={t('nav.menu')} aria-expanded={drawer} aria-controls="mobile-drawer"
              className={`p-2.5 rounded-full ${overlay ? 'text-white hover:bg-white/15' : 'text-ink hover:bg-sand'}`}><Menu className="w-6 h-6" /></button>
          </div>
        </div>
      </div>

      {drawer && (
        <div className="xl:hidden fixed inset-0 z-[70] bg-forest/60" onMouseDown={e => { if (e.target === e.currentTarget) setDrawer(false); }}>
          <div id="mobile-drawer" role="dialog" aria-modal="true" aria-label={t('nav.menu')} className="absolute right-0 top-0 h-full w-full max-w-sm bg-cream flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-5 h-16 border-b border-line">
              <Logo />
              <button type="button" onClick={() => setDrawer(false)} className="p-2.5 rounded-full hover:bg-sand" aria-label={t('nav.close')} autoFocus><X className="w-6 h-6" /></button>
            </div>
            <nav aria-label={t('nav.primary')} className="px-5 py-4 flex flex-col gap-1">
              {links.map(l => (
                <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `px-3 py-3 rounded-xl text-lg font-semibold ${isActive ? 'bg-sage text-brand' : 'text-ink hover:bg-sand'}`}>{l.label}</NavLink>
              ))}
              {[{ label: t('nav.contact'), items: contactItems }, { label: t('nav.help'), items: helpItems }].map(g => (
                <details key={g.label} className="group">
                  <summary className="flex justify-between items-center px-3 py-3 rounded-xl text-lg font-semibold cursor-pointer list-none hover:bg-sand">{g.label}<ChevronDown className="w-5 h-5 transition group-open:rotate-180" /></summary>
                  <div className="pl-3 pb-2 flex flex-col">
                    {g.items.map(it => it.href
                      ? <a key={it.label} href={it.href} target={it.external ? '_blank' : undefined} rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold hover:bg-sage"><span className="text-leaf">{it.icon}</span>{it.label}</a>
                      : <button key={it.label} type="button" onClick={() => { setDrawer(false); it.onClick?.(); }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-left hover:bg-sage"><span className="text-leaf">{it.icon}</span>{it.label}</button>)}
                  </div>
                </details>
              ))}
            </nav>
            <div className="mt-auto px-5 py-5 border-t border-line flex flex-col gap-4">
              <Link to={cabinetLink} className="btn btn-primary w-full">{user ? t('nav.myCabinet') : t('nav.login')}</Link>
              <LanguageSwitcher className="self-center" />
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
