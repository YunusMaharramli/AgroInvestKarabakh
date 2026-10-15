import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { Search, X } from 'lucide-react';
import { CATEGORIES } from '../../data/categories';
import type { Land } from '../../types/agro';

const LANGS = ['az', 'en', 'ru'] as const;
const norm = (s: string) => s.toLocaleLowerCase('az').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/ə/g, 'e');

/** Every name a land can be found by: title, address / village, region and field type in all three languages. */
function searchText(land: Land): string {
  const parts: string[] = [land.title ?? '', land.address ?? '', land.region, land.fieldType];
  for (const lng of LANGS) {
    const t = i18n.getFixedT(lng);
    parts.push(t(`regions.${land.region}`, { defaultValue: land.region }), t(`fieldTypes.${land.fieldType}`, { defaultValue: land.fieldType }));
  }
  return norm(parts.join(' '));
}

/** Text query matches region / city / village names and field types; `type` limits to one field type. */
export function matchesLandSearch(land: Land, query: string, type = ''): boolean {
  if (type && land.fieldType !== type) return false;
  const words = norm(query.trim()).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = searchText(land);
  return words.every(w => text.includes(w));
}

/** Search box for land lists: city / region / village name or field type, plus an optional field type select. */
export const LandSearchBar: React.FC<{
  value: string;
  onChange: (v: string) => void;
  type?: string;
  onTypeChange?: (v: string) => void;
  className?: string;
  tone?: 'light' | 'card';
}> = ({ value, onChange, type, onTypeChange, className = '', tone = 'light' }) => {
  const { t } = useTranslation();
  return (
    <div role="search" className={`flex flex-col sm:flex-row gap-2 ${className}`}>
      <label className="relative flex-1">
        <span className="sr-only">{t('search.label')}</span>
        <Search className="w-5 h-5 text-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
        <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={t('search.placeholder')}
          className={`field !pl-12 ${value ? '!pr-11' : ''} ${tone === 'card' ? '' : 'bg-white'}`} autoComplete="off" />
        {value && (
          <button type="button" onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-sand text-muted" aria-label={t('search.clear')}>
            <X className="w-4 h-4" />
          </button>
        )}
      </label>
      {onTypeChange && (
        <label className="sm:w-64">
          <span className="sr-only">{t('search.type')}</span>
          <select className="field" value={type ?? ''} onChange={e => onTypeChange(e.target.value)}>
            <option value="">{t('search.allTypes')}</option>
            {CATEGORIES.map(c => <option key={c.key} value={c.key}>{t(`fieldTypes.${c.key}`)}</option>)}
          </select>
        </label>
      )}
    </div>
  );
};
