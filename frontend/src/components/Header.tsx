import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useComparison } from '../context/ComparisonContext.js';
import { Bell, User, LogOut, LayoutDashboard, Shield, Layers, Menu, X, Phone } from 'lucide-react';
import { Notification } from '../types/index.js';

interface HeaderProps {
  currentRoute: string;
  navigate: (route: string) => void;
}

/** Help-line number shown across the site. Replace with the real number. */
export const HELP_LINE = '[QAYNAR XƏTT]';

type TextSize = 'normal' | 'large' | 'xlarge';
const TEXT_SIZES: { id: TextSize; label: string; aria: string; css: string; btn: string }[] = [
  { id: 'normal', label: 'A', aria: 'Normal yazı ölçüsü', css: '112.5%', btn: 'text-[15px]' },
  { id: 'large', label: 'A+', aria: 'Böyük yazı ölçüsü', css: '125%', btn: 'text-[18px]' },
  { id: 'xlarge', label: 'A++', aria: 'Ən böyük yazı ölçüsü', css: '140%', btn: 'text-[21px]' },
];

function readTextSize(): TextSize {
  try {
    const s = localStorage.getItem('agro_text_size');
    if (s === 'large' || s === 'xlarge') return s;
  } catch { /* storage blocked: use default */ }
  return 'normal';
}

const NAV_ITEMS: { route: string; label: string; match: (r: string) => boolean }[] = [
  { route: '/', label: 'Ana səhifə', match: r => r === '/' },
  { route: '/opportunities', label: 'Torpaq sahələri', match: r => r.startsWith('/opportunities') },
  { route: '/map', label: 'Xəritə', match: r => r === '/map' },
  { route: '/agromatch', label: 'Mənə uyğun sahə', match: r => r === '/agromatch' },
];

export const Header: React.FC<HeaderProps> = ({ currentRoute, navigate }) => {
  const { user, logout, token } = useAuth();
  const { compareLands } = useComparison();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [textSize, setTextSize] = useState<TextSize>(readTextSize);

  useEffect(() => {
    const size = TEXT_SIZES.find(s => s.id === textSize) ?? TEXT_SIZES[0];
    document.documentElement.style.fontSize = size.css;
    try { localStorage.setItem('agro_text_size', textSize); } catch { /* ignore */ }
  }, [textSize]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  // Close the mobile menu whenever the page changes
  useEffect(() => { setMobileMenuOpen(false); }, [currentRoute]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  const go = (route: string) => { navigate(route); setMobileMenuOpen(false); };

  return (
    <>
      {/* Utility bar: help line + text size. Scrolls away; the main header stays. */}
      <div className="bg-brand-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <p className="flex items-center gap-2 text-sm">
            <Phone className="w-5 h-5 text-gold-500 shrink-0" aria-hidden="true" />
            <span>Kömək xətti: <strong className="font-bold">{HELP_LINE}</strong><span className="hidden sm:inline"> · Hər gün 09:00–18:00</span></span>
          </p>
          <div className="flex items-center gap-2 text-sm" role="group" aria-label="Yazı ölçüsü">
            <span className="hidden sm:inline">Yazı ölçüsü:</span>
            {TEXT_SIZES.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setTextSize(s.id)}
                aria-pressed={textSize === s.id}
                aria-label={s.aria}
                className={`min-w-11 min-h-11 px-2 rounded-lg font-display font-extrabold leading-none border-2 transition-colors ${s.btn} ${
                  textSize === s.id
                    ? 'bg-gold-500 border-gold-500 text-ink'
                    : 'bg-transparent border-[#6F9A7E] text-white hover:border-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 bg-white border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3 sm:gap-6">
          <button
            type="button"
            onClick={() => go('/')}
            aria-label="AgroInvest Qarabağ — ana səhifə"
            className="min-w-0 shrink rounded-lg"
          >
            <img src="/brand/logo-horizontal.svg" alt="AgroInvest Qarabağ" className="h-11 sm:h-14 w-auto max-w-full object-contain object-left block" />
          </button>

          <nav aria-label="Əsas menyu" className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map(item => {
              const active = item.match(currentRoute);
              return (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => go(item.route)}
                  aria-current={active ? 'page' : undefined}
                  className={`font-display text-[0.95rem] whitespace-nowrap px-4 py-3 rounded-xl transition-colors ${
                    active ? 'bg-brand-50 text-brand-900 font-bold' : 'text-brand-900 font-semibold hover:bg-brand-50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            {compareLands.length > 0 && (
              <button
                type="button"
                onClick={() => go('/compare')}
                className="flex items-center gap-2 font-display font-semibold text-[0.95rem] text-gold-900 whitespace-nowrap px-4 py-3 rounded-xl hover:bg-gold-100"
              >
                <Layers className="w-5 h-5" aria-hidden="true" />
                <span>Müqayisə ({compareLands.length})</span>
              </button>
            )}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative w-12 h-12 flex items-center justify-center text-brand-900 rounded-xl border-2 border-line hover:bg-brand-50"
                    aria-label={unreadCount > 0 ? `Bildirişlər, ${unreadCount} oxunmamış` : 'Bildirişlər'}
                    aria-expanded={showNotifications}
                  >
                    <Bell className="w-6 h-6" aria-hidden="true" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-6 h-6 px-1 rounded-full bg-gold-500 text-ink text-xs font-bold flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-line py-2 z-50">
                      <div className="px-4 py-3 border-b border-line flex items-center justify-between">
                        <span className="font-display font-bold text-brand-900">Bildirişlər</span>
                        <span className="text-sm text-muted">{notifications.length} ədəd</span>
                      </div>
                      <div className="max-h-96 overflow-y-auto divide-y divide-line">
                        {notifications.length === 0 ? (
                          <p className="p-5 text-center text-muted">Yeni bildiriş yoxdur</p>
                        ) : (
                          notifications.map(n => (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => markRead(n.id)}
                              className={`w-full text-left p-4 transition-colors ${n.isRead ? 'bg-white hover:bg-cream' : 'bg-brand-50 hover:bg-brand-100'}`}
                            >
                              <p className="font-semibold text-ink">{n.title}</p>
                              <p className="text-muted text-sm mt-1">{n.message}</p>
                              <span className="text-xs text-muted mt-1 block">
                                {new Date(n.createdAt).toLocaleDateString('az-AZ')}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {user.role === 'ADMIN' ? (
                  <button
                    type="button"
                    onClick={() => go('/admin')}
                    className="hidden sm:flex items-center gap-2 px-4 h-12 bg-gold-100 border-2 border-gold-500 text-gold-900 rounded-xl font-display font-bold text-sm hover:bg-gold-400/40 whitespace-nowrap"
                  >
                    <Shield className="w-5 h-5" aria-hidden="true" />
                    <span>İnzibatçı paneli</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => go('/dashboard')}
                    className="hidden sm:flex items-center gap-2 px-4 h-12 bg-brand-700 text-white rounded-xl font-display font-bold text-sm hover:bg-brand-800 whitespace-nowrap"
                  >
                    <LayoutDashboard className="w-5 h-5" aria-hidden="true" />
                    <span>Kabinetim</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => { logout(); go('/'); }}
                  className="hidden sm:flex items-center gap-2 px-3 h-12 text-muted rounded-xl border-2 border-line hover:text-[#B42318] hover:border-[#B42318] text-sm font-semibold"
                >
                  <LogOut className="w-5 h-5" aria-hidden="true" />
                  <span>Çıxış</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => go('/login')}
                className="hidden sm:flex items-center gap-2 px-5 h-12 font-display font-bold text-[0.95rem] text-white bg-brand-700 rounded-xl hover:bg-brand-800 whitespace-nowrap"
              >
                <User className="w-5 h-5" aria-hidden="true" />
                <span>Kabinetə daxil ol</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              className="lg:hidden flex items-center gap-2 h-12 px-4 rounded-xl border-2 border-brand-900 text-brand-900 font-display font-extrabold text-sm"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
              <span>{mobileMenuOpen ? 'Bağla' : 'Menyu'}</span>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav id="mobile-menu" aria-label="Menyu" className="lg:hidden border-t border-line bg-white px-4 py-4 flex flex-col gap-2 max-h-[80vh] overflow-y-auto">
            {NAV_ITEMS.map(item => {
              const active = item.match(currentRoute);
              return (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => go(item.route)}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full text-left min-h-14 px-4 rounded-xl font-display font-bold text-lg ${
                    active ? 'bg-brand-700 text-white' : 'bg-cream text-brand-900 border-2 border-line'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            {compareLands.length > 0 && (
              <button
                type="button"
                onClick={() => go('/compare')}
                className="w-full text-left min-h-14 px-4 rounded-xl font-display font-bold text-lg bg-gold-100 text-gold-900"
              >
                Müqayisə ({compareLands.length})
              </button>
            )}
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => go(user.role === 'ADMIN' ? '/admin' : '/dashboard')}
                  className="w-full text-left min-h-14 px-4 rounded-xl font-display font-bold text-lg bg-brand-900 text-white"
                >
                  {user.role === 'ADMIN' ? 'İnzibatçı paneli' : 'Kabinetim'}
                </button>
                <button
                  type="button"
                  onClick={() => { logout(); go('/'); }}
                  className="w-full text-left min-h-14 px-4 rounded-xl font-display font-bold text-lg border-2 border-line text-muted"
                >
                  Çıxış
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => go('/login')}
                className="w-full text-left min-h-14 px-4 rounded-xl font-display font-bold text-lg bg-brand-900 text-white"
              >
                Kabinetə daxil ol
              </button>
            )}
          </nav>
        )}
      </header>
    </>
  );
};
