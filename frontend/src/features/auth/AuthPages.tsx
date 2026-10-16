import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type ReCAPTCHA from 'react-google-recaptcha';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { AlertCircle, Building2, CheckCircle2, Eye, EyeOff, Globe2, Info, KeyRound, Landmark, Loader2, Mail, ShieldCheck, Smartphone, UserRound } from 'lucide-react';
import { Logo } from '../../components/layout/Logo';
import { LanguageSwitcher } from '../../components/layout/LanguageSwitcher';
import { RecaptchaField } from '../../components/RecaptchaField';
import { useLocalePath } from '../../app/i18n';
import { authService, useCurrentUser, ApiError, errorText } from '../../services/api';
import { MAILPIT_URL, isLocalDev } from '../../services/backend';
import { cabinetHome } from './routing';
import { Field, Segmented } from '../../components/ui/Bits';
import { countryOptions } from '../../data/countries';
import type { ApplicantType } from '../../types/agro';
import { useToast } from '../../components/ui/Overlay';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------- split-screen layout (1.1) ---------- */
export const AuthLayout: React.FC<{ image: string; quote: string; children: React.ReactNode; wide?: boolean }> = ({ image, quote, children, wide }) => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  return (
    <div className="min-h-[100svh] grid lg:grid-cols-2 bg-cream">
      <div className="relative hidden lg:block">
        <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-forest via-forest/45 to-forest/65" aria-hidden="true" />
        <Link to={lp('/')} className="absolute top-8 left-10" aria-label={t('nav.home')}><Logo light /></Link>
        <blockquote className="absolute bottom-12 left-10 right-10 text-cream">
          <span className="gold-rule block mb-5" aria-hidden="true" />
          <p className="font-display text-4xl leading-tight">“{quote}”</p>
        </blockquote>
      </div>
      <div className="flex flex-col min-h-[100svh]">
        <div className="relative h-28 lg:hidden">
          <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-forest/60" />
          <Link to={lp('/')} className="absolute left-5 top-1/2 -translate-y-1/2" aria-label={t('nav.home')}><Logo light /></Link>
        </div>
        <div className="flex items-center justify-end gap-4 px-6 pt-5">
          <Link to={lp('/')} className="text-sm font-semibold text-muted hover:text-brand">{t('auth.back')}</Link>
          <LanguageSwitcher />
        </div>
        <main id="main" className="flex-1 flex items-center justify-center px-5 py-10">
          <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-[440px]'}`}>{children}</div>
        </main>
      </div>
    </div>
  );
};

const PasswordInput: React.FC<{ id: string; value: string; onChange: (v: string) => void; invalid?: boolean; autoComplete: string; describedBy?: string }> = ({ id, value, onChange, invalid, autoComplete, describedBy }) => {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={show ? 'text' : 'password'} className="field pr-12" value={value} onChange={e => onChange(e.target.value)} aria-invalid={invalid} autoComplete={autoComplete} aria-describedby={describedBy} />
      <button type="button" onClick={() => setShow(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted hover:text-ink" aria-label={show ? t('auth.hide') : t('auth.show')} aria-pressed={show}>
        {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  );
};

type EGovMethod = 'mygov' | 'asan' | 'sima' | 'eqanun' | 'visitor';
const EGOV_ICONS: Record<EGovMethod, React.ReactNode> = {
  mygov: <ShieldCheck className="w-5 h-5" aria-hidden="true" />,
  asan: <KeyRound className="w-5 h-5" aria-hidden="true" />,
  sima: <Smartphone className="w-5 h-5" aria-hidden="true" />,
  eqanun: <Landmark className="w-5 h-5" aria-hidden="true" />,
  visitor: <Globe2 className="w-5 h-5" aria-hidden="true" />,
};

/** State e-service sign-in options (myGov ID, ASAN İmza, SİMA, e-qanun.az). */
const EGovOptions: React.FC<{ methods: EGovMethod[] }> = ({ methods }) => {
  const { t } = useTranslation();
  const toast = useToast();
  return (
    <ul className="grid gap-3" aria-label={t('auth.egov.title')}>
      {methods.map(m => (
        <li key={m} className="relative">
          <button type="button" onClick={() => {
            if (m === 'mygov') {
              window.location.assign('https://mygovid.gov.az/auth');
              return;
            }
            if (m === 'asan') {
              window.location.assign('https://asanimza.az/wp-login.php');
              return;
            }
            toast(t('auth.egov.soon'), 'info');
          }}
            className="w-full flex items-center gap-4 rounded-2xl border border-line bg-white pl-4 pr-14 py-4 text-left transition hover:border-brand hover:shadow-sm focus-visible:border-brand">
            <span className={`shrink-0 rounded-xl grid place-items-center ${m === 'mygov' || m === 'asan' || m === 'sima' ? 'w-12 h-12 bg-white' : 'w-10 h-10 bg-sage text-brand'}`}>
              {m === 'mygov'
                ? <img src="/brand/mygov-id.png" alt="" aria-hidden="true" className="w-full h-full rounded-xl object-contain" />
                : m === 'asan'
                  ? <img src="/brand/asan-imza.png" alt="" aria-hidden="true" className="w-full h-full rounded-xl object-contain" />
                  : m === 'sima'
                    ? <img src="/brand/sima-imza.png" alt="" aria-hidden="true" className="w-full h-full rounded-xl object-contain" />
                    : EGOV_ICONS[m]}
            </span>
            <span className="font-bold text-brand">{t(`auth.egov.${m}`)}</span>
          </button>
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted" title={t(`auth.egov.info.${m}`)}>
            <Info className="w-5 h-5" aria-hidden="true" /><span className="sr-only">{t(`auth.egov.info.${m}`)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
};

const OrDivider: React.FC = () => {
  const { t } = useTranslation();
  return <div className="flex items-center gap-3 my-5 text-xs font-bold uppercase text-muted"><span className="flex-1 h-px bg-line" />{t('auth.or')}<span className="flex-1 h-px bg-line" /></div>;
};

const PENDING_EMAIL_KEY = 'agroinvest_pending_email';
const readPendingEmail = () => { try { return authService.pendingSignup()?.email ?? sessionStorage.getItem(PENDING_EMAIL_KEY) ?? ''; } catch { return ''; } };

const Alert: React.FC<{ tone?: 'error' | 'ok' | 'info'; children: React.ReactNode }> = ({ tone = 'error', children }) => (
  <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl px-4 py-3 text-sm font-semibold ${tone === 'error' ? 'bg-[#F6E1DF] text-[#8E1F17]' : tone === 'ok' ? 'bg-sage text-brand' : 'bg-[#FBF6E8] text-gold-dark'}`}>{children}</p>
);

/** In local development emails do not leave the machine: Mailpit catches them. */
const MailpitHint: React.FC = () => {
  const { t } = useTranslation();
  if (!isLocalDev()) return null;
  return (
    <aside className="mt-6 rounded-2xl border border-dashed border-gold bg-[#FBF6E8] p-4 text-sm text-left">
      <p className="font-bold text-gold-dark">{t('auth.mailpitTitle')}</p>
      <p className="mt-1">{t('auth.mailpitText')} <a href={MAILPIT_URL} target="_blank" rel="noreferrer" className="font-mono font-bold underline text-leaf-dark">{MAILPIT_URL.replace('http://', '')}</a></p>
    </aside>
  );
};

/** "Send the confirmation link again" — the server limits how often and always answers generically. */
const ResendLink: React.FC<{ email: string; askEmail?: boolean }> = ({ email: initial, askEmail }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  useEffect(() => { setEmail(initial); }, [initial]);
  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!EMAIL_RE.test(email.trim())) { setMsg({ tone: 'error', text: t('form.email') }); return; }
    if (!recaptchaToken) { setMsg({ tone: 'error', text: t('auth.errors.recaptcha') }); return; }
    setBusy(true); setMsg(null);
    try { const m = await authService.resendConfirmation(email, recaptchaToken); setMsg({ tone: 'ok', text: m || t('auth.resent') }); }
    catch (x) { setMsg({ tone: 'error', text: errorText(t, x) }); }
    finally { setBusy(false); setRecaptchaToken(null); recaptchaRef.current?.reset(); }
  };
  return (
    <form onSubmit={send} noValidate className="grid gap-3 mt-6 text-left">
      {askEmail && (
        <Field label={t('auth.email')} htmlFor="resend-email"><input id="resend-email" type="email" className="field" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></Field>
      )}
      <RecaptchaField ref={recaptchaRef} onChange={setRecaptchaToken} />
      <button type="submit" className={askEmail ? 'btn btn-primary w-full' : 'text-sm font-bold text-leaf-dark hover:underline justify-self-start'} disabled={busy}>
        {busy && <Loader2 className="w-4 h-4 animate-spin inline mr-1" aria-hidden="true" />}{t('auth.resend')}
      </button>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </form>
  );
};

/* ---------- 1.2 Login ---------- */
export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ id?: string; pw?: string; form?: string }>({});
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  useEffect(() => { document.title = `${t('auth.login')} · AgroMatch`; }, [t]);
  if (user && !busy) return <Navigate to={lp(cabinetHome(user))} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: typeof err = {};
    if (!id.trim()) er.id = t('form.required');
    if (!pw) er.pw = t('form.required');
    if (!recaptchaToken) er.form = t('auth.errors.recaptcha');
    setErr(er);
    if (er.id || er.pw || er.form) return;
    setBusy(true); setUnconfirmed(false);
    try {
      const u = await authService.login(id, pw, remember, recaptchaToken!);
      navigate(lp(cabinetHome(u)), { replace: true });
    } catch (x) {
      setErr({ form: errorText(t, x) });
      setUnconfirmed(x instanceof ApiError && x.status === 403);
      setBusy(false);
      setRecaptchaToken(null);
      recaptchaRef.current?.reset();
    }
  };
  return (
    <AuthLayout image="/images/site/photo-21.jpg" quote={t('auth.quoteLogin')}>
      <h1 className="font-display text-4xl text-brand">{t('auth.loginTitle')}</h1>
      <p className="text-muted mt-2 mb-8">{t('auth.loginSubtitle')}</p>
      {err.form && <div className="mb-5"><Alert>{err.form}</Alert>{unconfirmed && <ResendLink email={id.trim()} />}</div>}
      <form onSubmit={submit} noValidate className="grid gap-5">
        <Field label={t('auth.identifier')} htmlFor="login-id" error={err.id}>
          <input id="login-id" className="field" value={id} onChange={e => setId(e.target.value)} autoComplete="username" aria-invalid={!!err.id} />
        </Field>
        <Field label={t('auth.password')} htmlFor="login-pw" error={err.pw}>
          <PasswordInput id="login-pw" value={pw} onChange={setPw} invalid={!!err.pw} autoComplete="current-password" />
        </Field>
        <RecaptchaField ref={recaptchaRef} onChange={setRecaptchaToken} />
        <div className="flex items-center justify-between gap-3 text-sm">
          <label className="flex items-center gap-2 font-semibold cursor-pointer"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="w-4 h-4 accent-[#1F4D2E]" />{t('auth.remember')}</label>
          <Link to={lp('/forgot-password')} className="font-bold text-leaf-dark hover:underline">{t('auth.forgot')}</Link>
        </div>
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}{t('auth.login')}</button>
      </form>
      <OrDivider />
      <EGovOptions methods={['mygov', 'asan', 'sima']} />
      <p className="text-center text-sm mt-8">{t('auth.noAccount')} <Link to={lp('/signup')} className="font-bold text-leaf-dark hover:underline">{t('auth.signup')}</Link></p>

    </AuthLayout>
  );
};

/* ---------- Forgot password ---------- */
export const ForgotPage: React.FC = () => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  useEffect(() => { document.title = `${t('auth.forgotTitle')} · AgroMatch`; }, [t]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) { setErr(t('form.email')); return; }
    if (!recaptchaToken) { setErr(t('auth.errors.recaptcha')); return; }
    setErr(''); setBusy(true);
    try { await authService.sendResetLink(email, recaptchaToken); setSent(true); }
    catch (x) { setErr(errorText(t, x)); }
    finally { setBusy(false); setRecaptchaToken(null); recaptchaRef.current?.reset(); }
  };
  return (
    <AuthLayout image="/images/site/photo-12.jpg" quote={t('auth.quoteLogin')}>
      {sent ? (
        <div className="text-center" role="status">
          <span className="w-16 h-16 rounded-full bg-sage text-brand grid place-items-center mx-auto mb-5"><Mail className="w-8 h-8" aria-hidden="true" /></span>
          <h1 className="font-display text-4xl text-brand">{t('auth.checkEmail')}</h1>
          <p className="text-muted mt-3">{t('auth.checkEmailText', { email })}</p>
          <MailpitHint />
          <Link to={lp('/login')} className="btn btn-primary mt-8">{t('auth.backLogin')}</Link>
        </div>
      ) : (
        <>
          <h1 className="font-display text-4xl text-brand">{t('auth.forgotTitle')}</h1>
          <p className="text-muted mt-2 mb-8">{t('auth.forgotSubtitle')}</p>
          <form onSubmit={submit} noValidate className="grid gap-5">
            <Field label={t('auth.email')} htmlFor="fp-email" error={err}><input id="fp-email" type="email" className="field" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" aria-invalid={!!err} /></Field>
            <RecaptchaField ref={recaptchaRef} onChange={setRecaptchaToken} />
            <button type="submit" className="btn btn-primary w-full" disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}{t('auth.sendLink')}</button>
          </form>
          <p className="text-center text-sm mt-8"><Link to={lp('/login')} className="font-bold text-leaf-dark hover:underline">{t('auth.backLogin')}</Link></p>
        </>
      )}
    </AuthLayout>
  );
};

/* ---------- 1.4 Sign-up flow: applicant type → account → email confirmation → additional information ---------- */
function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++;
  return pw ? s : 0;
}
const COUNTRY_CODES = [['+994', '🇦🇿 +994'], ['+90', '🇹🇷 +90'], ['+7', '🇷🇺 +7'], ['+995', '🇬🇪 +995'], ['+1', '🇺🇸 +1'], ['+44', '🇬🇧 +44']];

const StepHeader: React.FC<{ n: number }> = ({ n }) => {
  const { t } = useTranslation();
  const steps = t('auth.steps', { returnObjects: true }) as unknown as string[];
  return (
    <div className="mb-8">
      <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">{t('auth.step', { n, total: steps.length })}</p>
      <ol className="flex gap-2" aria-label={t('auth.step', { n, total: steps.length })}>
        {steps.map((s, i) => (
          <li key={s} className="flex-1" aria-current={i + 1 === n ? 'step' : undefined}>
            <span className={`block h-1.5 rounded-full ${i + 1 <= n ? 'bg-brand' : 'bg-line'}`} />
            <span className={`block text-xs mt-1.5 font-semibold ${i + 1 === n ? 'text-ink' : 'text-muted'}`}>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
};

type MainType = 'INDIVIDUAL' | 'LEGAL_ENTITY' | 'FOREIGN';
const isCompany = (type: ApplicantType) => type === 'LEGAL_ENTITY' || type === 'FOREIGN_ENTITY';

/** Applicant type picker shown above the sign-up form. The foreign choice splits into individual / entity. */
const ApplicantTypePicker: React.FC<{ value: ApplicantType; onChange: (v: ApplicantType) => void }> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const main: MainType = value === 'FOREIGN_INDIVIDUAL' || value === 'FOREIGN_ENTITY' ? 'FOREIGN' : value;
  const options: { key: MainType; icon: React.ReactNode }[] = [
    { key: 'INDIVIDUAL', icon: <UserRound className="w-5 h-5" aria-hidden="true" /> },
    { key: 'LEGAL_ENTITY', icon: <Building2 className="w-5 h-5" aria-hidden="true" /> },
    { key: 'FOREIGN', icon: <Globe2 className="w-5 h-5" aria-hidden="true" /> },
  ];
  return (
    <fieldset className="mb-6">
      <legend className="field-label mb-2">{t('auth.applicant.title')}</legend>
      <div role="radiogroup" aria-label={t('auth.applicant.title')} className="grid grid-cols-3 gap-2">
        {options.map(o => {
          const active = o.key === main;
          return (
            <button key={o.key} type="button" role="radio" aria-checked={active}
              onClick={() => onChange(o.key === 'FOREIGN' ? (main === 'FOREIGN' ? value : 'FOREIGN_INDIVIDUAL') : o.key)}
              className={`rounded-2xl border px-2 py-3 text-xs sm:text-sm font-bold flex flex-col items-center gap-1.5 text-center transition ${active ? 'border-brand bg-sage text-brand shadow-sm' : 'border-line bg-white text-muted hover:border-brand hover:text-ink'}`}>
              {o.icon}{t(`auth.applicant.${o.key}`)}
            </button>
          );
        })}
      </div>
      {main === 'FOREIGN' && (
        <div className="mt-3">
          <Segmented label={t('auth.applicant.FOREIGN')} value={value} onChange={onChange}
            options={[{ value: 'FOREIGN_INDIVIDUAL' as ApplicantType, label: t('auth.applicant.FOREIGN_INDIVIDUAL') }, { value: 'FOREIGN_ENTITY' as ApplicantType, label: t('auth.applicant.FOREIGN_ENTITY') }]} />
        </div>
      )}
    </fieldset>
  );
};

/** Waiting for the email confirmation: asks the server every few seconds and when the tab comes back into focus. */
const ConfirmationStatus: React.FC<{ email: string; deliveryFailed: boolean; onContinue: () => void }> = ({ email, deliveryFailed, onContinue }) => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  const [state, setState] = useState<'pending' | 'confirmed' | 'expired'>('pending');
  const [checking, setChecking] = useState(false);
  const check = useCallback(async () => {
    const pending = authService.pendingSignup();
    if (!pending) { setState('expired'); return; }
    setChecking(true);
    try { const s = await authService.signupStatus(pending.token); setState(s.emailConfirmed ? 'confirmed' : 'pending'); }
    catch (x) { if (x instanceof ApiError && x.status === 404) setState('expired'); }
    finally { setChecking(false); }
  }, []);
  useEffect(() => {
    if (state !== 'pending') return;
    void check();
    const timer = window.setInterval(() => { void check(); }, 4000);
    const onFocus = () => { void check(); };
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [state, check]);

  return (
    <div className="text-center">
      <StepHeader n={2} />
      <span className={`w-16 h-16 rounded-full grid place-items-center mx-auto mb-5 ${state === 'confirmed' ? 'bg-sage text-brand' : 'bg-[#FBF6E8] text-gold-dark'}`}>
        {state === 'confirmed' ? <CheckCircle2 className="w-8 h-8" aria-hidden="true" /> : <Mail className="w-8 h-8" aria-hidden="true" />}
      </span>
      <h1 className="font-display text-4xl text-brand">{t('auth.verifyTitle')}</h1>
      <p className="text-muted mt-3">{t('auth.verifyText', { email })}</p>
      <div className="mt-6" aria-live="polite">
        {state === 'confirmed' && <span className="inline-flex items-center gap-2 rounded-full bg-sage text-brand px-4 py-2 font-bold"><CheckCircle2 className="w-5 h-5" aria-hidden="true" />{t('auth.status.confirmed')}</span>}
        {state === 'pending' && <span className="inline-flex items-center gap-2 rounded-full bg-[#FBF6E8] text-gold-dark px-4 py-2 font-bold"><Loader2 className={`w-5 h-5 ${checking ? 'animate-spin' : ''}`} aria-hidden="true" />{t('auth.status.pending')}</span>}
        {state === 'expired' && <div className="text-left"><Alert>{t('auth.status.expired')}</Alert></div>}
      </div>
      {deliveryFailed && state === 'pending' && <div className="mt-5 text-left"><Alert tone="info">{t('auth.deliveryFailed')}</Alert></div>}
      <button type="button" className="btn btn-primary w-full mt-8" disabled={state !== 'confirmed'} onClick={onContinue}>{t('form.continue')}</button>
      {state === 'pending' && (
        <>
          <button type="button" onClick={() => void check()} className="text-sm font-bold text-leaf-dark hover:underline mt-4" disabled={checking}>{t('auth.status.check')}</button>
          <MailpitHint />
          <ResendLink email={email} />
        </>
      )}
      <p className="text-center text-sm mt-8"><Link to={lp('/login')} className="font-bold text-leaf-dark hover:underline">{t('auth.backLogin')}</Link></p>
    </div>
  );
};

const YesNo: React.FC<{ label: string; value: boolean | null; onChange: (v: boolean) => void; error?: string; id: string }> = ({ label, value, onChange, error, id }) => {
  const { t } = useTranslation();
  return (
    <div id={id}>
      <p className="field-label">{label}</p>
      <Segmented label={label} value={value === null ? '' : value ? 'yes' : 'no'} onChange={v => onChange(v === 'yes')}
        options={[{ value: 'yes', label: t('form.yes') }, { value: 'no', label: t('form.no') }]} />
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
};

interface DetailsState {
  incomeStability: string; monthlyNetIncome: string; financialCurrency: string; minimumFunds: string;
  citizenshipCountry: string; residenceCountry: string; residencyStatus: string; address: string;
  country: string; companyName: string; taxIdentificationNumber: string; foreignTaxNumber: string;
  legalForm: string; registrationDate: string; mainActivity: string; representativeRole: string; annualRevenue: string;
}
const EMPTY_DETAILS: DetailsState = {
  incomeStability: '', monthlyNetIncome: '', financialCurrency: 'AZN', minimumFunds: '',
  citizenshipCountry: '', residenceCountry: '', residencyStatus: '', address: '', country: '',
  companyName: '', taxIdentificationNumber: '', foreignTaxNumber: '', legalForm: '', registrationDate: '',
  mainActivity: '', representativeRole: '', annualRevenue: '',
};
const RESIDENCY = ['PERMANENT_RESIDENT', 'TEMPORARY_RESIDENT', 'NON_RESIDENT'];
const INCOME_STABILITY = ['STABLE', 'SEASONAL', 'IRREGULAR', 'OTHER'];
const CURRENCIES = ['AZN', 'USD', 'EUR', 'TRY', 'GBP'];

/** Required core eligibility and investment-capacity step after email confirmation. */
const DetailsStep: React.FC<{ type: ApplicantType }> = ({ type }) => {
  const { t, i18n } = useTranslation();
  const lp = useLocalePath();
  const navigate = useNavigate();
  const toast = useToast();
  const [v, setV] = useState<DetailsState>(EMPTY_DETAILS);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const countries = useMemo(() => countryOptions(i18n.language), [i18n.language]);
  const today = new Date().toISOString().slice(0, 10);
  const set = <K extends keyof DetailsState>(k: K, value: DetailsState[K]) => setV(prev => ({ ...prev, [k]: value }));
  const text = (k: keyof DetailsState) => ({ id: `dt-${k}`, value: v[k] as string, 'aria-invalid': !!err[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(k, e.target.value as never) });
  const money = (k: keyof DetailsState) => ({ ...text(k), type: 'number', min: 0, step: '0.01', inputMode: 'decimal' as const, className: 'field' });
  const num = (s: string) => (s.trim() === '' ? null : Number(s));

  const individual = type === 'INDIVIDUAL';
  const foreignPerson = type === 'FOREIGN_INDIVIDUAL';
  const foreignCompany = type === 'FOREIGN_ENTITY';
  const legal = type === 'LEGAL_ENTITY';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    const need = (k: keyof DetailsState, msg = t('form.required')) => { const x = v[k]; if (x === null || (typeof x === 'string' && !x.trim())) er[k] = msg; };
    const amount = (k: keyof DetailsState, positive = false) => {
      need(k, t('auth.details.errors.amount'));
      const n = num(v[k] as string);
      if (!er[k] && (n === null || Number.isNaN(n) || n < 0 || (positive && n === 0))) er[k] = t('auth.details.errors.amount');
    };
    if (individual || foreignPerson) {
      need('incomeStability', t('auth.details.errors.choose')); amount('monthlyNetIncome'); amount('minimumFunds');
      if (foreignPerson) {
        need('citizenshipCountry', t('auth.details.errors.choose')); need('residenceCountry', t('auth.details.errors.choose'));
        need('residencyStatus', t('auth.details.errors.choose'));
      }
    }
    if (legal || foreignCompany) {
      need('companyName'); need('legalForm'); need('address'); need('mainActivity'); need('representativeRole');
      need('registrationDate'); amount('annualRevenue'); amount('minimumFunds');
      if (legal && !/^\d{10}$/.test(v.taxIdentificationNumber.trim())) er.taxIdentificationNumber = t('auth.errors.voen');
      if (foreignCompany) {
        need('country', t('auth.details.errors.choose'));
        if (v.foreignTaxNumber.trim().length < 3) er.foreignTaxNumber = t('form.required');
      }
      if (!er.registrationDate && v.registrationDate > today) er.registrationDate = t('auth.details.errors.date');
    }
    setErr(er);
    if (Object.keys(er).length) { document.getElementById(`dt-${Object.keys(er)[0]}`)?.focus(); return; }
    setBusy(true);
    try {
      const details = individual || foreignPerson ? {
        incomeStability: v.incomeStability, monthlyNetIncome: num(v.monthlyNetIncome), financialCurrency: v.financialCurrency,
        minimumFunds: num(v.minimumFunds),
        ...(foreignPerson ? { citizenshipCountry: v.citizenshipCountry, residenceCountry: v.residenceCountry, residencyStatus: v.residencyStatus } : {}),
      } : {
        companyName: v.companyName, legalForm: v.legalForm,
        taxIdentificationNumber: legal ? v.taxIdentificationNumber : null,
        foreignTaxNumber: foreignCompany ? v.foreignTaxNumber : null,
        country: foreignCompany ? v.country : null, address: v.address, mainActivity: v.mainActivity,
        representativeRole: v.representativeRole, registrationDate: v.registrationDate,
        annualRevenue: num(v.annualRevenue), minimumFunds: num(v.minimumFunds),
      };
      const user = await authService.completeSignup(details);
      toast(t('auth.details.done'));
      navigate(lp(cabinetHome(user)), { replace: true });
    } catch (x) {
      setErr({ form: errorText(t, x) });
      setBusy(false);
    }
  };

  return (
    <>
      <StepHeader n={3} />
      <h1 className="font-display text-4xl text-brand">{isCompany(type) ? t('auth.details.companyTitle') : t('auth.details.title')}</h1>
      <p className="text-muted mt-2 mb-8">{t('auth.details.subtitle')} <span className="font-semibold text-ink">{t(`auth.applicant.${type}`)}</span></p>
      <p className="text-sm text-muted mb-5">{t('auth.details.coreOnly')}</p>
      {err.form && <div className="mb-5"><Alert>{err.form}</Alert></div>}
      <form onSubmit={submit} noValidate className="grid sm:grid-cols-2 gap-5">
        {(individual || foreignPerson) && <>
          <Field label={t('auth.details.incomeStability')} htmlFor="dt-incomeStability" error={err.incomeStability}>
            <select className="field" {...text('incomeStability')}><option value="">{t('auth.details.choose')}</option>{INCOME_STABILITY.map(option => <option key={option} value={option}>{t(`auth.details.incomeStabilityOptions.${option}`)}</option>)}</select>
          </Field>
          <Field label={t('auth.details.monthlyIncome')} htmlFor="dt-monthlyNetIncome" error={err.monthlyNetIncome}><input {...money('monthlyNetIncome')} /></Field>
          <Field label={t('auth.details.currency')} htmlFor="dt-financialCurrency"><select className="field" {...text('financialCurrency')}>{CURRENCIES.map(currency => <option key={currency}>{currency}</option>)}</select></Field>
          <Field label={t('auth.details.ownContribution')} htmlFor="dt-minimumFunds" error={err.minimumFunds}><input {...money('minimumFunds')} /></Field>
        </>}
        {foreignPerson && <>
          {(['citizenshipCountry','residenceCountry'] as const).map(key => <Field key={key} label={t(`auth.details.${key}`)} htmlFor={`dt-${key}`} error={err[key]}>
            <select className="field" {...text(key)}><option value="">{t('auth.details.chooseCountry')}</option>{countries.filter(c => key !== 'citizenshipCountry' || c.code !== 'AZ').map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select>
          </Field>)}
          <Field label={t('auth.details.residency')} htmlFor="dt-residencyStatus" error={err.residencyStatus} className="sm:col-span-2">
            <select className="field" {...text('residencyStatus')}><option value="">{t('auth.details.choose')}</option>{RESIDENCY.map(r => <option key={r} value={r}>{t(`auth.details.residencyOptions.${r}`)}</option>)}</select>
          </Field>
        </>}
        {(legal || foreignCompany) && <>
          {foreignCompany && <Field label={t('auth.details.country')} htmlFor="dt-country" error={err.country}><select className="field" {...text('country')}><option value="">{t('auth.details.chooseCountry')}</option>{countries.filter(c => c.code !== 'AZ').map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></Field>}
          <Field label={t('auth.details.companyLegalName')} htmlFor="dt-companyName" error={err.companyName} className="sm:col-span-2"><input className="field" autoComplete="organization" {...text('companyName')} /></Field>
          {legal ? <Field label={t('auth.details.taxId')} htmlFor="dt-taxIdentificationNumber" error={err.taxIdentificationNumber}><input className="field" inputMode="numeric" maxLength={10} {...text('taxIdentificationNumber')} /></Field>
            : <Field label={t('auth.details.foreignTaxId')} htmlFor="dt-foreignTaxNumber" error={err.foreignTaxNumber}><input className="field" maxLength={40} {...text('foreignTaxNumber')} /></Field>}
          <Field label={t('auth.details.legalForm')} htmlFor="dt-legalForm" error={err.legalForm}><input className="field" {...text('legalForm')} /></Field>
          <Field label={t('auth.details.registrationDate')} htmlFor="dt-registrationDate" error={err.registrationDate}><input className="field" type="date" max={today} {...text('registrationDate')} /></Field>
          <Field label={t('auth.details.address')} htmlFor="dt-address" error={err.address} className="sm:col-span-2"><input className="field" autoComplete="street-address" {...text('address')} /></Field>
          <Field label={t('auth.details.mainActivity')} htmlFor="dt-mainActivity" error={err.mainActivity} className="sm:col-span-2"><input className="field" {...text('mainActivity')} /></Field>
          <Field label={t('auth.details.representativeRole')} htmlFor="dt-representativeRole" error={err.representativeRole}><input className="field" {...text('representativeRole')} /></Field>
          <Field label={t('auth.details.annualRevenue')} htmlFor="dt-annualRevenue" error={err.annualRevenue}><input {...money('annualRevenue')} /></Field>
          <Field label={t('auth.details.ownContribution')} htmlFor="dt-minimumFunds" error={err.minimumFunds}><input {...money('minimumFunds')} /></Field>
        </>}
        <button type="submit" className="btn btn-primary w-full sm:col-span-2" disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}{t('auth.details.finish')}</button>
      </form>
    </>
  );
};

interface AccountState {
  firstName: string; lastName: string; email: string; code: string; phone: string;
  password: string; confirm: string; terms: boolean;
}

const emptyAccount = (): AccountState => ({
  firstName: '', lastName: '', email: '', code: '+994', phone: '',
  password: '', confirm: '', terms: false,
});

export const SignupPage: React.FC = () => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const user = useCurrentUser();
  const step = params.get('step') ?? 'account';
  const go = (s: string) => setParams({ step: s });

  const [type, setType] = useState<ApplicantType>(() => authService.pendingSignup()?.type ?? 'INDIVIDUAL');
  const [drafts, setDrafts] = useState<Record<ApplicantType, AccountState>>(() => ({
    INDIVIDUAL: emptyAccount(), LEGAL_ENTITY: emptyAccount(),
    FOREIGN_INDIVIDUAL: emptyAccount(), FOREIGN_ENTITY: emptyAccount(),
  }));
  const v = drafts[type];
  const setV = (next: AccountState) => setDrafts(current => ({ ...current, [type]: next }));
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const [deliveryFailed, setDeliveryFailed] = useState(false);
  useEffect(() => { document.title = `${t('auth.signup')} · AgroMatch`; }, [t]);

  const pending = authService.pendingSignup();
  // The last step works with the sign-up token from this browser, or for a signed-in applicant who has not finished.
  const detailsType: ApplicantType | null = user?.needsOnboarding ? user.applicantType ?? null : !user ? pending?.type ?? null : null;
  if (user && !(step === 'details' && user.needsOnboarding)) return <Navigate to={lp(cabinetHome(user))} replace />;
  if (step === 'check-email' && !pending) return <Navigate to={lp('/signup')} replace />;
  if (step === 'details' && !detailsType) return <Navigate to={lp(user ? cabinetHome(user) : '/login')} replace />;
  if (step !== 'account' && step !== 'check-email' && step !== 'details') return <Navigate to={lp('/signup')} replace />;

  const submitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (v.firstName.trim().length < 1) er.firstName = t('form.required');
    if (v.lastName.trim().length < 1) er.lastName = t('form.required');
    if (!EMAIL_RE.test(v.email.trim())) er.email = t('form.email');
    if (v.phone.replace(/\D/g, '').length < 7) er.phone = t('auth.errors.phone');
    if (v.password.length < 8) er.password = t('form.minLength', { n: 8 });
    if (v.confirm !== v.password) er.confirm = t('auth.errors.passwordMatch');
    if (!v.terms) er.terms = t('auth.errors.terms');
    if (!recaptchaToken) er.form = t('auth.errors.recaptcha');
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const r = await authService.signup({
        applicantType: type, email: v.email, password: v.password, confirmPassword: v.confirm, acceptTerms: v.terms, recaptchaToken: recaptchaToken!,
        firstName: v.firstName, lastName: v.lastName, phone: `${v.code} ${v.phone.trim()}`,
      });
      setDeliveryFailed(r.emailDeliveryFailed);
      go('check-email');
    } catch (x) {
      const text = errorText(t, x);
      const detail = x instanceof ApiError ? x.detail : '';
      const field = x instanceof ApiError && x.status === 409 ? 'email'
        : /telefon/i.test(detail) ? 'phone' : /ad/i.test(detail) ? 'firstName' : 'form';
      setErr({ [field]: text });
    }
    finally { setBusy(false); setRecaptchaToken(null); recaptchaRef.current?.reset(); }
  };
  const s = strength(v.password);
  const levels = t('auth.strengthLevels', { returnObjects: true }) as unknown as string[];
  const bind = (k: 'firstName' | 'lastName' | 'email' | 'phone') =>
    ({ id: `su-${k}`, value: v[k], 'aria-invalid': !!err[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value }) });
  const changeType = (next: ApplicantType) => { setType(next); setErr({}); };

  return (
    <AuthLayout image="/images/site/photo-07.jpg" quote={t('auth.quoteSignup')} wide={step === 'details'}>
      {step === 'account' && (
        <>
          <StepHeader n={1} />
          <h1 className="font-display text-4xl text-brand">{t('auth.signupTitle')}</h1>
          <p className="text-muted mt-2 mb-6">{t('auth.signupSubtitle')}</p>
          <ApplicantTypePicker value={type} onChange={changeType} />
          {err.form && <div className="mb-5"><Alert>{err.form}</Alert></div>}
          <form onSubmit={submitAccount} noValidate className="grid gap-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t('auth.firstName')} htmlFor="su-firstName" error={err.firstName}><input className="field" autoComplete="given-name" {...bind('firstName')} /></Field>
              <Field label={t('auth.lastName')} htmlFor="su-lastName" error={err.lastName}><input className="field" autoComplete="family-name" {...bind('lastName')} /></Field>
            </div>
            <Field label={t('auth.email')} htmlFor="su-email" error={err.email}><input className="field" type="email" autoComplete="email" {...bind('email')} /></Field>
            <Field label={t('auth.phone')} htmlFor="su-phone" error={err.phone}>
              <div className="flex gap-2">
                <select aria-label={t('auth.countryCode')} className="field !w-32 shrink-0" value={v.code} onChange={e => setV({ ...v, code: e.target.value })}>
                  {COUNTRY_CODES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
                </select>
                <input className="field" type="tel" autoComplete="tel-national" placeholder="50 123 45 67" {...bind('phone')} />
              </div>
            </Field>
            <Field label={t('auth.password')} htmlFor="su-pw" error={err.password}>
              <PasswordInput id="su-pw" value={v.password} onChange={x => setV({ ...v, password: x })} invalid={!!err.password} autoComplete="new-password" describedBy="pw-strength" />
              <div className="flex gap-1 mt-2" aria-hidden="true">{[0, 1, 2, 3].map(i => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < s ? (s <= 1 ? 'bg-danger' : s === 2 ? 'bg-warn' : 'bg-leaf') : 'bg-line'}`} />)}</div>
              <p id="pw-strength" className="field-hint">{t('auth.strength', { level: levels[s] })}</p>
            </Field>
            <Field label={t('auth.confirm')} htmlFor="su-confirm" error={err.confirm}>
              <PasswordInput id="su-confirm" value={v.confirm} onChange={x => setV({ ...v, confirm: x })} invalid={!!err.confirm} autoComplete="new-password" />
            </Field>
            <div>
              <label className="flex items-start gap-3 text-sm cursor-pointer">
                <input type="checkbox" checked={v.terms} onChange={e => setV({ ...v, terms: e.target.checked })} className="w-4 h-4 mt-0.5 accent-[#1F4D2E]" aria-invalid={!!err.terms} />
                <span><Trans i18nKey="auth.terms" components={{ terms: <a href="#terms" className="font-bold underline text-leaf-dark" />, privacy: <a href="#privacy" className="font-bold underline text-leaf-dark" /> }} /></span>
              </label>
              {err.terms && <p className="field-error" role="alert">{err.terms}</p>}
            </div>
            <RecaptchaField ref={recaptchaRef} onChange={setRecaptchaToken} />
            <button type="submit" className="btn btn-primary w-full" disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}{t('form.continue')}</button>
          </form>
          {type !== 'FOREIGN_ENTITY' && (
            <>
              <OrDivider />
              <EGovOptions methods={type === 'INDIVIDUAL' ? ['mygov', 'asan', 'sima'] : type === 'LEGAL_ENTITY' ? ['eqanun'] : ['visitor']} />
            </>
          )}
          <p className="text-center text-sm mt-8">{t('auth.haveAccount')} <Link to={lp('/login')} className="font-bold text-leaf-dark hover:underline">{t('auth.login')}</Link></p>
        </>
      )}

      {step === 'check-email' && pending && (
        <ConfirmationStatus email={pending.email} deliveryFailed={deliveryFailed} onContinue={() => go('details')} />
      )}

      {step === 'details' && detailsType && <DetailsStep key={detailsType} type={detailsType} />}
    </AuthLayout>
  );
};

/* ---------- Email confirmation link: /confirm-email?token=... ---------- */
export const ConfirmEmailPage: React.FC = () => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(token ? 'loading' : 'error');
  const [msg, setMsg] = useState(token ? '' : t('auth.errors.noToken'));
  const started = useRef('');
  useEffect(() => { document.title = `${t('auth.confirmTitle')} · AgroMatch`; }, [t]);
  useEffect(() => {
    if (!token || started.current === token) return; // the token works once; avoid a second call in StrictMode
    started.current = token;
    authService.confirmEmail(token)
      .then(m => { setMsg(m); setState('ok'); try { sessionStorage.removeItem(PENDING_EMAIL_KEY); } catch { /* ignore */ } })
      .catch(x => { setMsg(errorText(t, x)); setState('error'); });
  }, [token, t]);
  return (
    <AuthLayout image="/images/site/photo-07.jpg" quote={t('auth.quoteSignup')}>
      <div className="text-center">
        <span className={`w-16 h-16 rounded-full grid place-items-center mx-auto mb-5 ${state === 'error' ? 'bg-[#F6E1DF] text-[#8E1F17]' : 'bg-sage text-brand'}`}>
          {state === 'loading' ? <Loader2 className="w-8 h-8 animate-spin" aria-hidden="true" /> : state === 'ok' ? <CheckCircle2 className="w-8 h-8" aria-hidden="true" /> : <AlertCircle className="w-8 h-8" aria-hidden="true" />}
        </span>
        <h1 className="font-display text-4xl text-brand">{t('auth.confirmTitle')}</h1>
        <div className="mt-4" aria-live="polite">
          {state === 'loading' && <p className="text-muted">{t('auth.confirming')}</p>}
          {state === 'ok' && <p className="text-muted">{t('auth.confirmed')}</p>}
          {state === 'error' && <Alert>{msg}</Alert>}
        </div>
        {state === 'ok' && (authService.pendingSignup()
          ? <Link to={lp('/signup?step=details')} className="btn btn-primary mt-8">{t('auth.continueSignup')}</Link>
          : <Link to={lp('/login')} className="btn btn-primary mt-8">{t('auth.login')}</Link>)}
        {state === 'error' && (
          <>
            <p className="text-sm text-muted mt-6">{t('auth.newLinkText')}</p>
            <ResendLink email={readPendingEmail()} askEmail />
            <p className="text-center text-sm mt-8"><Link to={lp('/login')} className="font-bold text-leaf-dark hover:underline">{t('auth.backLogin')}</Link></p>
          </>
        )}
      </div>
    </AuthLayout>
  );
};

/* ---------- Password reset link: /reset-password?token=... ---------- */
export const ResetPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [pw, setPw] = useState({ next: '', confirm: '' });
  const [err, setErr] = useState<{ next?: string; confirm?: string; form?: string }>({});
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { document.title = `${t('auth.resetTitle')} · AgroMatch`; }, [t]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: typeof err = {};
    if (pw.next.length < 8) er.next = t('form.minLength', { n: 8 });
    if (pw.confirm !== pw.next) er.confirm = t('auth.errors.passwordMatch');
    setErr(er);
    if (er.next || er.confirm) return;
    setBusy(true);
    try {
      const message = await authService.resetPassword(token, pw.next) || t('auth.resetDone');
      setDone(message);
      toast(message);
      navigate(lp('/login'), { replace: true });
    }
    catch (x) { setErr({ form: errorText(t, x) }); }
    finally { setBusy(false); }
  };

  return (
    <AuthLayout image="/images/site/photo-12.jpg" quote={t('auth.quoteLogin')}>
      {done ? (
        <div className="text-center" role="status">
          <span className="w-16 h-16 rounded-full bg-sage text-brand grid place-items-center mx-auto mb-5"><CheckCircle2 className="w-8 h-8" aria-hidden="true" /></span>
          <h1 className="font-display text-4xl text-brand">{t('auth.resetTitle')}</h1>
          <p className="text-muted mt-3">{done}</p>
          <Link to={lp('/login')} className="btn btn-primary mt-8">{t('auth.login')}</Link>
        </div>
      ) : (
        <>
          <h1 className="font-display text-4xl text-brand">{t('auth.resetTitle')}</h1>
          <p className="text-muted mt-2 mb-8">{t('auth.resetSubtitle')}</p>
          {!token ? (
            <>
              <Alert>{t('auth.errors.noToken')}</Alert>
              <Link to={lp('/forgot-password')} className="btn btn-primary w-full mt-6">{t('auth.sendLink')}</Link>
            </>
          ) : (
            <form onSubmit={submit} noValidate className="grid gap-5">
              {err.form && <Alert>{err.form}</Alert>}
              <Field label={t('auth.newPassword')} htmlFor="rp-new" error={err.next}>
                <PasswordInput id="rp-new" value={pw.next} onChange={x => setPw({ ...pw, next: x })} invalid={!!err.next} autoComplete="new-password" />
              </Field>
              <Field label={t('auth.confirm')} htmlFor="rp-confirm" error={err.confirm}>
                <PasswordInput id="rp-confirm" value={pw.confirm} onChange={x => setPw({ ...pw, confirm: x })} invalid={!!err.confirm} autoComplete="new-password" />
              </Field>
              <button type="submit" className="btn btn-primary w-full" disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}{t('auth.resetSave')}</button>
              {err.form && <Link to={lp('/forgot-password')} className="text-sm font-bold text-leaf-dark hover:underline text-center">{t('auth.sendLink')}</Link>}
            </form>
          )}
          <p className="text-center text-sm mt-8"><Link to={lp('/login')} className="font-bold text-leaf-dark hover:underline">{t('auth.backLogin')}</Link></p>
        </>
      )}
    </AuthLayout>
  );
};
