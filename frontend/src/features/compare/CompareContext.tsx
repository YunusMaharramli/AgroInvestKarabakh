import React, { createContext, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useToast } from '../../components/ui/Overlay';
import { landService } from '../../services/api';
import { useLocalePath } from '../../app/i18n';
import { useLandName } from '../shared/landText';
import { Photo } from '../../components/ui/Bits';

/** Up to two lands selected for AgroComparison (Part 2, section 5). Kept for the browser tab. */
interface CompareCtx { ids: string[]; toggle: (id: string) => void; remove: (id: string) => void; set: (ids: string[]) => void; has: (id: string) => boolean }
const Ctx = createContext<CompareCtx>({ ids: [], toggle: () => {}, remove: () => {}, set: () => {}, has: () => false });
export const useCompare = () => useContext(Ctx);
const KEY = 'agroinvest_compare';

export const CompareProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [ids, setIds] = useState<string[]>(() => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? '[]'); } catch { return []; } });
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* ignore */ } }, [ids]);
  const toggle = (id: string) => {
    if (ids.includes(id)) { setIds(ids.filter(x => x !== id)); return; }
    if (ids.length >= 2) { toast(t('compare.maxTwo'), 'info'); return; }
    setIds([...ids, id]);
  };
  return <Ctx.Provider value={{ ids, toggle, remove: id => setIds(ids.filter(x => x !== id)), set: setIds, has: id => ids.includes(id) }}>{children}</Ctx.Provider>;
};

/** Sticky bar shown at the bottom once one or two lands are selected. */
export const CompareBar: React.FC = () => {
  const { t } = useTranslation();
  const { ids, remove } = useCompare();
  const lp = useLocalePath();
  const name = useLandName();
  if (!ids.length) return null;
  return (
    <div className="fixed bottom-16 lg:bottom-4 inset-x-0 z-40 px-3 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-2xl rounded-2xl bg-forest text-cream shadow-[var(--shadow-lift)] p-3 flex items-center gap-3">
        <div className="flex gap-2">
          {ids.map(id => {
            const l = landService.get(id);
            return (
              <div key={id} className="relative">
                <Photo src={l?.photos[0]} alt={name(l)} className="w-14 h-14 rounded-xl" />
                <button type="button" onClick={() => remove(id)} className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-white text-ink grid place-items-center shadow" aria-label={`${t('compare.remove')}: ${name(l)}`}><X className="w-3.5 h-3.5" /></button>
              </div>
            );
          })}
          {ids.length < 2 && <div className="w-14 h-14 rounded-xl border-2 border-dashed border-cream/40" aria-hidden="true" />}
        </div>
        <p className="text-sm font-semibold flex-1">{t('compare.barSelected', { n: ids.length })}</p>
        <Link to={lp('/investor/compare')} className="btn btn-gold btn-sm">{t('compare.compareNow')}</Link>
      </div>
    </div>
  );
};
