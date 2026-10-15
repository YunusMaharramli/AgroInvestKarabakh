import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heart, MapPin, Star } from 'lucide-react';
import type { Land } from '../../types/agro';
import { Photo } from '../../components/ui/Bits';
import { useFormat } from '../../app/i18n';
import { useLandName } from './landText';
import { groupColor } from '../../data/categories';
import { useCompare } from '../compare/CompareContext';
import { landService, useCurrentUser, useDbValue } from '../../services/api';

export const TypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 border border-line px-2.5 py-1 text-xs font-bold text-ink max-w-full">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: groupColor(type) }} aria-hidden="true" /><span className="truncate">{t(`fieldTypes.${type}`, { defaultValue: type })}</span>
    </span>
  );
};

/** Investor search result card: show listing facts while keeping analysis for the detail flow. */
export const LandResultCard: React.FC<{ land: Land; href: string }> = ({ land, href }) => {
  const { t } = useTranslation();
  const f = useFormat();
  const name = useLandName();
  const me = useCurrentUser();
  const { has, toggle } = useCompare();
  const saved = useDbValue(() => (me ? landService.savedIds(me.id).includes(land.id) : false));
  const title = name(land);
  return (
    <article className="card overflow-hidden flex flex-col">
      <div className="relative">
        <Link to={href} tabIndex={-1} aria-hidden="true"><Photo src={land.photos[0]} alt="" className="w-full aspect-[16/10]" /></Link>
        <div className="absolute top-3 left-3 right-14 flex flex-wrap gap-2">
          <TypeBadge type={land.fieldType} />
          {land.isSpecial && <span className="inline-flex items-center gap-1 rounded-full bg-gold text-forest px-2.5 py-1 text-xs font-bold"><Star className="w-3 h-3" aria-hidden="true" />{t('land.special')}</span>}
        </div>
        {me && (
          <button type="button" onClick={() => landService.toggleSaved(me.id, land.id)} aria-pressed={saved} aria-label={`${saved ? t('land.saved') : t('land.save')}: ${title}`}
            className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/95 grid place-items-center shadow hover:scale-105 transition">
            <Heart className={`w-5 h-5 ${saved ? 'fill-danger text-danger' : 'text-ink'}`} />
          </button>
        )}
      </div>
      <div className="p-5 flex flex-col gap-4 flex-1">
        <div>
          <div className="min-w-0">
            <h3 className="font-display text-xl text-brand leading-snug"><Link to={href} className="hover:underline">{title}</Link></h3>
            <p className="text-sm text-muted flex items-center gap-1 mt-1"><MapPin className="w-4 h-4" aria-hidden="true" />{t(`regions.${land.region}`)} · {t('land.ha', { n: land.areaHa })}</p>
          </div>
        </div>
        <dl className="grid gap-3 text-sm">
          <div><dt className="text-muted text-xs font-semibold">{t('land.required')}</dt><dd className="font-bold">{land.source ? f.compactAzn(land.investmentMin) : `${f.compactAzn(land.investmentMin)} – ${f.compactAzn(land.investmentMax)}`}</dd></div>
        </dl>
        <div className="mt-auto pt-2 flex items-center justify-between gap-3 border-t border-line">
          <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer pt-3">
            <input type="checkbox" checked={has(land.id)} onChange={() => toggle(land.id)} className="w-4 h-4 accent-[#1F4D2E]" />{t('land.addCompare')}
          </label>
          <Link to={href} className="btn btn-outline btn-sm mt-3">{t('land.viewDetails')}</Link>
        </div>
      </div>
    </article>
  );
};
