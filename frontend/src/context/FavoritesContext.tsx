import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Favorite } from '../types/index.js';
import { useAuth } from './AuthContext.js';
import { Heart, X } from 'lucide-react';

interface FavoritesContextType {
  favorites: Favorite[];
  isFavorite: (landId: string) => boolean;
  toggleFavorite: (landId: string) => Promise<void>;
  isLoading: boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

/** A plot the visitor tried to save before logging in; saved automatically after login. */
const PENDING_KEY = 'agro_pending_favorite';

function goTo(route: string) {
  // App listens to popstate, so this switches the page without a full reload.
  window.history.pushState(null, '', route);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0 });
}

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const loginBtnRef = useRef<HTMLButtonElement>(null);

  const authHeaders = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

  const fetchFavorites = async (): Promise<Favorite[]> => {
    if (!user) {
      setFavorites([]);
      return [];
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/favorites', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setFavorites(list);
        return list;
      }
    } catch (err) {
      console.error('Failed to fetch favorites:', err);
    } finally {
      setIsLoading(false);
    }
    return [];
  };

  const addFavorite = async (landId: string): Promise<boolean> => {
    const res = await fetch('/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ landId }),
    });
    if (!res.ok) return false;
    const newFav = await res.json();
    setFavorites(prev => (prev.some(f => f.landId === landId) ? prev : [...prev, newFav]));
    return true;
  };

  // Load favorites on login; then save the plot they tried to save before logging in.
  useEffect(() => {
    (async () => {
      const list = await fetchFavorites();
      if (!user) return;
      let pending: string | null = null;
      try { pending = sessionStorage.getItem(PENDING_KEY); sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
      if (pending && !list.some(f => f.landId === pending)) {
        try {
          if (await addFavorite(pending)) flash('Sahə yadda saxlanıldı. Onu kabinetinizdə "Seçilmişlər" bölməsində tapa bilərsiniz.');
        } catch { /* ignore */ }
      }
    })();
  }, [user]);

  useEffect(() => {
    if (showLoginPrompt) loginBtnRef.current?.focus();
  }, [showLoginPrompt]);

  const flash = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(''), 5000);
  };

  const isFavorite = (landId: string) => favorites.some(f => f.landId === landId);

  const toggleFavorite = async (landId: string) => {
    if (!user) {
      try { sessionStorage.setItem(PENDING_KEY, landId); } catch { /* ignore */ }
      setShowLoginPrompt(true);
      return;
    }
    if (busy.has(landId)) return; // ignore double clicks while saving
    setBusy(prev => new Set(prev).add(landId));
    try {
      if (isFavorite(landId)) {
        setFavorites(prev => prev.filter(f => f.landId !== landId)); // optimistic
        const res = await fetch(`/api/favorites/${landId}`, { method: 'DELETE', headers: authHeaders() });
        if (!res.ok) { await fetchFavorites(); flash('Silmək alınmadı. Bir az sonra yenidən cəhd edin.'); }
        else flash('Sahə seçilmişlərdən silindi.');
      } else {
        const ok = await addFavorite(landId);
        flash(ok ? 'Sahə yadda saxlanıldı.' : 'Yadda saxlamaq alınmadı. Bir az sonra yenidən cəhd edin.');
      }
    } catch (e) {
      console.error('Favorite toggle failed:', e);
      await fetchFavorites();
      flash('İnternet bağlantısında problem var. Yenidən cəhd edin.');
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(landId); return n; });
    }
  };

  const closePrompt = () => {
    setShowLoginPrompt(false);
    try { sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
  };

  return (
    <FavoritesContext.Provider value={{ favorites, isFavorite, toggleFavorite, isLoading }}>
      {children}

      {/* Short confirmation message at the bottom of the screen */}
      <div aria-live="polite" className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md pointer-events-none">
        {notice && (
          <p className="bg-brand-950 text-white text-base font-semibold rounded-2xl px-5 py-4 shadow-xl flex items-center gap-3">
            <Heart className="w-6 h-6 text-gold-400 shrink-0" aria-hidden="true" />
            {notice}
          </p>
        )}
      </div>

      {/* "Please log in" dialog for visitors who are not logged in */}
      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={closePrompt}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="fav-login-title"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Escape') closePrompt(); }}
            className="bg-white rounded-3xl p-7 sm:p-8 max-w-md w-full shadow-2xl relative"
          >
            <button
              type="button"
              onClick={closePrompt}
              aria-label="Bağla"
              className="absolute top-4 right-4 w-11 h-11 rounded-xl flex items-center justify-center text-muted hover:bg-cream"
            >
              <X className="w-6 h-6" aria-hidden="true" />
            </button>
            <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center mb-4">
              <Heart className="w-7 h-7 text-brand-700" aria-hidden="true" />
            </div>
            <h2 id="fav-login-title" className="font-display font-extrabold text-2xl text-brand-900">
              Yadda saxlamaq üçün daxil olun
            </h2>
            <p className="text-lg text-[#3E4F45] mt-2">
              Seçdiyiniz sahələr kabinetinizdə saxlanılır. Daxil olduqdan sonra bu sahə avtomatik yadda saxlanılacaq.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                ref={loginBtnRef}
                type="button"
                onClick={() => { setShowLoginPrompt(false); goTo('/login'); }}
                className="min-h-14 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-display font-extrabold text-lg"
              >
                Kabinetə daxil olun
              </button>
              <button
                type="button"
                onClick={() => { setShowLoginPrompt(false); goTo('/register'); }}
                className="min-h-14 rounded-xl border-2 border-brand-900 text-brand-900 font-display font-bold"
              >
                Qeydiyyatdan keçin
              </button>
              <button type="button" onClick={closePrompt} className="min-h-12 text-muted font-semibold underline underline-offset-4">
                İndi yox
              </button>
            </div>
          </div>
        </div>
      )}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
};
