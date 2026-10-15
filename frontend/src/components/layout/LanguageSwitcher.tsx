import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LANGS, Lang, useLang, applyLang } from '../../app/i18n';

/** AZ / EN / RU toggle. Keeps the current page and swaps only the language prefix. */
export const LanguageSwitcher: React.FC<{ light?: boolean; className?: string }> = ({ light, className = '' }) => {
  const lang = useLang();
  const { t } = useTranslation();
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const go = (l: Lang) => {
    applyLang(l);
    const rest = pathname.replace(/^\/(az|en|ru)(?=\/|$)/, '');
    navigate(`/${l}${rest}${search}${hash}`, { replace: true });
  };
  return (
    <div role="group" aria-label={t('lang.label')} className={`inline-flex rounded-full p-0.5 ${light ? 'bg-white/15' : 'bg-sand'} ${className}`}>
      {LANGS.map(l => (
        <button key={l} type="button" lang={l} aria-pressed={l === lang} title={t(`lang.${l}`)} onClick={() => go(l)}
          className={`min-w-9 px-2 py-1 rounded-full text-xs font-extrabold uppercase transition ${l === lang ? (light ? 'bg-white text-forest' : 'bg-brand text-white') : light ? 'text-white/85 hover:text-white' : 'text-muted hover:text-ink'}`}>
          {l}
        </button>
      ))}
    </div>
  );
};
