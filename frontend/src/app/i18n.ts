import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import az from '../locales/az.json';
import en from '../locales/en.json';
import ru from '../locales/ru.json';

export const LANGS = ['az', 'en', 'ru'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'az';
const LANG_KEY = 'agroinvest_lang';

export const isLang = (x: string | undefined): x is Lang => !!x && (LANGS as readonly string[]).includes(x);

export function savedLang(): Lang {
  try {
    const s = localStorage.getItem(LANG_KEY) ?? '';
    if (isLang(s)) return s;
  } catch { /* ignore */ }
  return DEFAULT_LANG;
}

export function applyLang(lang: Lang) {
  if (i18n.language !== lang) void i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
}

void i18n.use(initReactI18next).init({
  resources: { az: { translation: az }, en: { translation: en }, ru: { translation: ru } },
  lng: savedLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnObjects: false,
});

/** Current language from the URL (/:lang/...). */
export function useLang(): Lang {
  const { lang } = useParams();
  return isLang(lang) ? lang : DEFAULT_LANG;
}

/** Builds a language-prefixed path: lp('/about') -> '/en/about'. */
export function useLocalePath() {
  const lang = useLang();
  return (path: string) => `/${lang}${path === '/' ? '' : path}`;
}

/** Number / money formatting that follows the UI language. */
export function useFormat() {
  const { t, i18n: inst } = useTranslation();
  const locale = inst.language === 'az' ? 'az-Latn-AZ' : inst.language === 'ru' ? 'ru-RU' : 'en-GB';
  const num = (n: number, digits = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n);
  return {
    locale,
    num,
    azn: (n: number) => t('common.azn', { value: num(n) }),
    compactAzn: (n: number) => t('common.azn', { value: new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n) }),
    // Azerbaijani short month names are poorly supported by browsers ("M10"), so AZ uses 15.10.2026
    date: (iso: string) => new Intl.DateTimeFormat(inst.language === 'az' ? 'ru-RU' : locale, inst.language === 'az' ? { day: '2-digit', month: '2-digit', year: 'numeric' } : { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)),
  };
}

export default i18n;
