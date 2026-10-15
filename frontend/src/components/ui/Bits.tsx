import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, ImageOff, Info, Sprout } from 'lucide-react';
import type { LandStatus, RequestStatus } from '../../types/agro';
import type { RiskLevel } from '../../services/scoring';
import { scoreColor } from '../../services/scoring';

/* ---------- Scroll reveal ---------- */
export const Reveal: React.FC<{ children: React.ReactNode; className?: string; as?: 'div' | 'section' | 'li'; delay?: number }> = ({ children, className = '', as = 'div', delay = 0 }) => {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const Tag = as as any;
  return <Tag ref={ref} className={`reveal ${seen ? 'is-visible' : ''} ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>{children}</Tag>;
};

/* ---------- Image with neutral placeholder ---------- */
export const Photo: React.FC<{ src: string | null | undefined; alt: string; className?: string; label?: string; eager?: boolean }> = ({ src, alt, className = '', label, eager }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-sage to-sand text-brand/60 ${className}`} role="img" aria-label={alt}>
        <Sprout className="w-10 h-10" aria-hidden="true" />
        {label && <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1"><ImageOff className="w-3.5 h-3.5" aria-hidden="true" />{label}</span>}
      </div>
    );
  }
  return <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
};

/* ---------- Badges ---------- */
const LAND_STATUS: Record<LandStatus, string> = {
  draft: 'bg-sand text-ink', underReview: 'bg-[#FFF1D6] text-[#7A4D00]', active: 'bg-sage text-brand', funded: 'bg-brand text-white',
  closed: 'bg-ink/80 text-white', paused: 'bg-[#ECE7DA] text-muted',
};
export const StatusBadge: React.FC<{ status: LandStatus }> = ({ status }) => {
  const { t } = useTranslation();
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${LAND_STATUS[status]}`}>{t(`status.${status}`)}</span>;
};

const REQ_STATUS: Record<RequestStatus, string> = { pending: 'bg-[#FFF1D6] text-[#7A4D00]', selected: 'bg-brand text-white', notSelected: 'bg-[#F6E1DF] text-[#8E1F17]', rejected: 'bg-[#F6E1DF] text-[#8E1F17]', cancelled: 'bg-[#ECE7DA] text-muted' };
export const RequestBadge: React.FC<{ status: RequestStatus }> = ({ status }) => {
  const { t } = useTranslation();
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${REQ_STATUS[status]}`}>{t(`reqStatus.${status}`)}</span>;
};

const RISK: Record<RiskLevel, string> = { low: 'bg-[#E3F1E1] text-[#1E5E22]', medium: 'bg-[#FFF1D6] text-[#7A4D00]', high: 'bg-[#F6E1DF] text-[#8E1F17]' };
export const RiskBadge: React.FC<{ level: RiskLevel; factors?: string[]; size?: 'sm' | 'lg' }> = ({ level, factors = [], size = 'sm' }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const tip = factors.length ? factors.map(f => t(f)).join(' · ') : t('risk.none');
  return (
    <span className="relative inline-flex">
      <button type="button" className={`inline-flex items-center gap-1 rounded-full font-bold ${RISK[level]} ${size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'}`}
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        aria-label={`${t('land.risk')}: ${t(`risk.${level}`)}. ${t('risk.factors')}: ${tip}`}>
        {t('land.risk')}: {t(`risk.${level}`)} <Info className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
      {open && (
        <span role="tooltip" className="absolute z-30 bottom-full mb-2 left-0 w-60 rounded-xl bg-ink text-white text-xs p-3 shadow-lg">
          <strong className="block mb-1">{t('risk.factors')}</strong>{tip}
        </span>
      )}
    </span>
  );
};

export const VerifiedBadge: React.FC<{ label?: string }> = ({ label }) => {
  const { t } = useTranslation();
  return <span className="inline-flex items-center gap-1 rounded-full bg-[#F4ECD6] text-gold-dark px-2.5 py-1 text-xs font-bold"><BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" />{label ?? t('land.verifiedOwner')}</span>;
};

/* ---------- Score gauge & progress ---------- */
export const ScoreGauge: React.FC<{ value: number; size?: number; label?: string }> = ({ value, size = 64, label }) => {
  const { t } = useTranslation();
  const r = (size - 8) / 2, c = 2 * Math.PI * r;
  const color = scoreColor(value);
  return (
    <div className="inline-flex flex-col items-center" role="img" aria-label={`${label ?? t('land.suitability')}: ${value} / 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#ECE7DA" strokeWidth="6" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="6" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontWeight="800" fontSize={size * 0.3} fill={color}>{value}</text>
      </svg>
      {label !== '' && <span className="text-[0.7rem] font-semibold text-muted mt-0.5">{label ?? t('land.suitability')}</span>}
    </div>
  );
};

export const ProgressBar: React.FC<{ value: number; label: string; showValue?: string; tone?: 'brand' | 'gold' | 'leaf' }> = ({ value, label, showValue, tone = 'leaf' }) => {
  const v = Math.max(0, Math.min(100, value));
  const bg = tone === 'gold' ? 'bg-gold' : tone === 'brand' ? 'bg-brand' : 'bg-leaf';
  return (
    <div>
      <div className="flex justify-between text-xs font-semibold text-muted mb-1"><span>{label}</span><span className="text-ink">{showValue ?? `${Math.round(v)}%`}</span></div>
      <div className="h-2 rounded-full bg-[#ECE7DA] overflow-hidden" role="progressbar" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${bg}`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
};

/* ---------- Tabs with counters ---------- */
export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto no-scrollbar border-b border-line">
      {tabs.map(tab => {
        const active = tab.id === value;
        return (
          <button key={tab.id} type="button" role="tab" aria-selected={active} onClick={() => onChange(tab.id)}
            className={`relative px-4 py-3 text-sm font-bold whitespace-nowrap ${active ? 'text-brand' : 'text-muted hover:text-ink'}`}>
            {tab.label}
            {tab.count !== undefined && <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${active ? 'bg-brand text-white' : 'bg-sand text-ink'}`}>{tab.count}</span>}
            {active && <span className="absolute left-2 right-2 -bottom-px h-[3px] rounded-full bg-[var(--accent,var(--color-brand))]" />}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Stepper ---------- */
export const Stepper: React.FC<{ steps: string[]; current: number; onStep?: (i: number) => void }> = ({ steps, current, onStep }) => (
  <ol className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1" aria-label="Progress">
    {steps.map((s, i) => {
      const done = i < current, active = i === current;
      return (
        <li key={s} className="flex items-center gap-2 shrink-0">
          <button type="button" disabled={!onStep || i > current} onClick={() => onStep?.(i)} aria-current={active ? 'step' : undefined}
            className="flex items-center gap-2 disabled:cursor-default">
            <span className={`w-8 h-8 rounded-full grid place-items-center text-sm font-bold ${active ? 'bg-brand text-white' : done ? 'bg-leaf text-white' : 'bg-sand text-muted'}`}>{done ? '✓' : i + 1}</span>
            <span className={`text-sm font-semibold ${active ? 'text-ink' : 'text-muted'} hidden md:inline`}>{s}</span>
          </button>
          {i < steps.length - 1 && <span className={`w-6 md:w-10 h-0.5 ${done ? 'bg-leaf' : 'bg-line'}`} aria-hidden="true" />}
        </li>
      );
    })}
  </ol>
);

/* ---------- Dual range slider ---------- */
export const RangeSlider: React.FC<{ min: number; max: number; step: number; value: [number, number]; onChange: (v: [number, number]) => void; label: string; format?: (n: number) => string }> = ({ min, max, step, value, onChange, label, format = String }) => {
  const [a, b] = value;
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <div>
      <div className="relative h-6">
        <div className="absolute top-1/2 -translate-y-1/2 h-1.5 w-full rounded-full bg-[#E2DCCB]" />
        <div className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-brand" style={{ left: `${pct(a)}%`, right: `${100 - pct(b)}%` }} />
        <input type="range" className="range-thumb absolute w-full top-0 h-6" min={min} max={max} step={step} value={a} aria-label={`${label} — min`} aria-valuetext={format(a)}
          onChange={e => onChange([Math.min(+e.target.value, b), b])} />
        <input type="range" className="range-thumb absolute w-full top-0 h-6" min={min} max={max} step={step} value={b} aria-label={`${label} — max`} aria-valuetext={format(b)}
          onChange={e => onChange([a, Math.max(+e.target.value, a)])} />
      </div>
      <div className="flex justify-between text-xs text-muted font-semibold mt-1"><span>{format(a)}</span><span>{format(b)}</span></div>
    </div>
  );
};

/* ---------- Chips & segmented control ---------- */
export const Chips: React.FC<{ options: { value: string; label: string }[]; selected: string[]; onChange: (v: string[]) => void; label: string; limit?: number }> = ({ options, selected, onChange, label, limit }) => {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const shown = limit && !all ? options.slice(0, limit) : options;
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {shown.map(o => {
        const on = selected.includes(o.value);
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(on ? selected.filter(x => x !== o.value) : [...selected, o.value])}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${on ? 'bg-brand border-brand text-white' : 'bg-white border-line text-ink hover:border-leaf'}`}>
            {o.label}
          </button>
        );
      })}
      {limit && options.length > limit && !all && (
        <button type="button" onClick={() => setAll(true)} className="rounded-full px-3 py-1.5 text-xs font-bold text-leaf-dark underline">{t('investor.search.more', { n: options.length - limit })}</button>
      )}
    </div>
  );
};

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-sand p-1 w-full">
      {options.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={`flex-1 rounded-full px-3 py-1.5 text-sm font-bold transition ${o.value === value ? 'bg-white text-brand shadow' : 'text-muted hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Toggle ---------- */
export const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }> = ({ checked, onChange, label, id }) => (
  <label className="inline-flex items-center gap-3 cursor-pointer select-none" htmlFor={id}>
    <span className="relative">
      <input id={id} type="checkbox" role="switch" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="block w-11 h-6 rounded-full bg-[#CFC8B6] peer-checked:bg-brand transition peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-gold" />
      <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
    </span>
    <span className="text-sm font-semibold">{label}</span>
  </label>
);

/* ---------- Stat card, empty state, skeleton ---------- */
export const StatCard: React.FC<{ label: string; value: string; icon: React.ReactNode; accent?: boolean }> = ({ label, value, icon, accent }) => (
  <div className="card p-5 flex items-start gap-4">
    <span className={`w-11 h-11 rounded-2xl grid place-items-center shrink-0 ${accent ? 'bg-[#F4ECD6] text-gold-dark' : 'bg-sage text-brand'}`} aria-hidden="true">{icon}</span>
    <div className="min-w-0">
      <p className="text-sm text-muted font-semibold leading-snug">{label}</p>
      <p className="text-2xl font-extrabold text-ink mt-1 truncate tabular-nums">{value}</p>
    </div>
  </div>
);

export const EmptyState: React.FC<{ title: string; icon?: React.ReactNode; action?: React.ReactNode; text?: string }> = ({ title, icon, action, text }) => (
  <div className="card p-10 text-center flex flex-col items-center gap-3">
    <span className="w-14 h-14 rounded-full bg-sage text-brand grid place-items-center" aria-hidden="true">{icon ?? <Sprout className="w-7 h-7" />}</span>
    <p className="font-display text-xl text-brand">{title}</p>
    {text && <p className="text-muted max-w-md">{text}</p>}
    {action}
  </div>
);

export const SkeletonCard: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="card overflow-hidden" aria-hidden="true">
    <div className="skeleton h-40 rounded-none" />
    <div className="p-5 flex flex-col gap-3">{Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton h-4" style={{ width: `${90 - i * 18}%` }} />)}</div>
  </div>
);

export const ErrorState: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => {
  const { t } = useTranslation();
  return (
    <div className="card p-8 text-center" role="alert">
      <p className="font-semibold text-danger">{t('form.error')}</p>
      {onRetry && <button type="button" className="btn btn-outline btn-sm mt-4" onClick={onRetry}>{t('form.retry')}</button>}
    </div>
  );
};

export const Field: React.FC<{ label: string; htmlFor: string; error?: string; hint?: string; optional?: boolean; children: React.ReactNode; className?: string }> = ({ label, htmlFor, error, hint, optional, children, className = '' }) => {
  const { t } = useTranslation();
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="field-label">{label}{optional && <span className="font-normal text-muted"> ({t('form.optional')})</span>}</label>
      {children}
      {error ? <p className="field-error" id={`${htmlFor}-error`} role="alert">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
};
