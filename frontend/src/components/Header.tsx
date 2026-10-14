import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useComparison } from '../context/ComparisonContext.js';
import { Bell, User, LogOut, LayoutDashboard, Shield, Layers, Menu, X } from 'lucide-react';
import { Notification } from '../types/index.js';

interface HeaderProps {
  currentRoute: string;
  navigate: (route: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentRoute, navigate }) => {
  const { user, logout, token } = useAuth();
  const { compareLands } = useComparison();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

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

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark (Single Text Element) */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 text-left text-lg font-bold tracking-tight text-emerald-950 whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity"
        >
          <span className="w-8 h-8 rounded-lg bg-emerald-800 text-amber-400 flex items-center justify-center font-bold text-sm shadow-xs">
            AQ
          </span>
          <span>AgroInvest Qarabağ</span>
        </button>

        {/* Zone 2: Single-line Navigation Links (4-5 items) */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <button
            onClick={() => navigate('/')}
            className={`whitespace-nowrap shrink-0 transition-colors ${currentRoute === '/' ? 'text-emerald-800 font-semibold border-b-2 border-emerald-800 pb-0.5' : 'hover:text-emerald-900'}`}
          >
            Ana səhifə
          </button>
          <button
            onClick={() => navigate('/opportunities')}
            className={`whitespace-nowrap shrink-0 transition-colors ${currentRoute.startsWith('/opportunities') ? 'text-emerald-800 font-semibold border-b-2 border-emerald-800 pb-0.5' : 'hover:text-emerald-900'}`}
          >
            İnvestisiya imkanları
          </button>
          <button
            onClick={() => navigate('/map')}
            className={`whitespace-nowrap shrink-0 transition-colors ${currentRoute === '/map' ? 'text-emerald-800 font-semibold border-b-2 border-emerald-800 pb-0.5' : 'hover:text-emerald-900'}`}
          >
            İnteraktiv xəritə
          </button>
          <button
            onClick={() => navigate('/agromatch')}
            className={`whitespace-nowrap shrink-0 transition-colors ${currentRoute === '/agromatch' ? 'text-emerald-800 font-semibold border-b-2 border-emerald-800 pb-0.5' : 'hover:text-emerald-900'}`}
          >
            AgroMatch
          </button>
          {compareLands.length > 0 && (
            <button
              onClick={() => navigate('/compare')}
              className="flex items-center gap-1.5 text-amber-700 font-medium whitespace-nowrap shrink-0 hover:text-amber-800"
            >
              <Layers className="w-4 h-4" />
              <span>Müqayisə ({compareLands.length})</span>
            </button>
          )}
        </nav>

        {/* Zone 3: Primary Action / User Profile */}
        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <div className="flex items-center gap-2">
              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors relative"
                  title="Bildirişlər"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                    <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">Bildirişlər</span>
                      <span className="text-xs text-slate-400 font-mono-numbers">{notifications.length} ədəd</span>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-xs text-center text-slate-400">Yeni bildiriş yoxdur</div>
                      ) : (
                        notifications.map(n => (
                          <div
                            key={n.id}
                            onClick={() => markRead(n.id)}
                            className={`p-3 text-xs cursor-pointer transition-colors ${n.isRead ? 'bg-white hover:bg-slate-50' : 'bg-emerald-50/50 hover:bg-emerald-50'}`}
                          >
                            <p className="font-semibold text-slate-900">{n.title}</p>
                            <p className="text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              {new Date(n.createdAt).toLocaleDateString('az-AZ')}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Role Dashboard Link */}
              {user.role === 'ADMIN' ? (
                <button
                  onClick={() => navigate('/admin')}
                  className="flex items-center gap-2 px-3.5 py-1.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold hover:bg-amber-100 transition-colors whitespace-nowrap shrink-0"
                >
                  <Shield className="w-3.5 h-3.5 text-amber-700" />
                  <span>İnzibatçı Paneli</span>
                </button>
              ) : (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Kabinet</span>
                </button>
              )}

              {/* Logout Button */}
              <button
                onClick={() => { logout(); navigate('/'); }}
                className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                title="Çıxış"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-colors whitespace-nowrap shrink-0 shadow-xs"
            >
              Daxil ol / Qeydiyyat
            </button>
          )}

          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation drop-down */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2">
          <button
            onClick={() => { navigate('/'); setMobileMenuOpen(false); }}
            className="block w-full text-left py-2 text-sm text-slate-700 font-medium"
          >
            Ana səhifə
          </button>
          <button
            onClick={() => { navigate('/opportunities'); setMobileMenuOpen(false); }}
            className="block w-full text-left py-2 text-sm text-slate-700 font-medium"
          >
            İnvestisiya imkanları
          </button>
          <button
            onClick={() => { navigate('/map'); setMobileMenuOpen(false); }}
            className="block w-full text-left py-2 text-sm text-slate-700 font-medium"
          >
            İnteraktiv xəritə
          </button>
          <button
            onClick={() => { navigate('/agromatch'); setMobileMenuOpen(false); }}
            className="block w-full text-left py-2 text-sm text-slate-700 font-medium"
          >
            AgroMatch
          </button>
          {compareLands.length > 0 && (
            <button
              onClick={() => { navigate('/compare'); setMobileMenuOpen(false); }}
              className="block w-full text-left py-2 text-sm text-amber-700 font-medium"
            >
              Müqayisə ({compareLands.length})
            </button>
          )}
        </div>
      )}
    </header>
  );
};
