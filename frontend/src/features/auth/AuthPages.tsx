import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { AlertCircle, Eye, EyeOff, Loader2, Mail, Map as MapIcon, TrendingUp, CheckCircle2, Upload } from 'lucide-react';
import { Logo } from '../../components/layout/Logo';
import { LanguageSwitcher } from '../../components/layout/LanguageSwitcher';
import { useLocalePath } from '../../app/i18n';
import { authService, useCurrentUser, ApiError, errorText } from '../../services/api';
import { MAILPIT_URL, isLocalDev } from '../../services/backend';
import { TEST_PASSWORD } from '../../mocks/seed';
import { cabinetHome } from './routing';
import { Chips, Field } from '../../components/ui/Bits';
import { useToast } from '../../components/ui/Overlay';
import { REGIONS } from '../../data/regions';
import { CATEGORIES } from '../../data/categories';
import type { CabinetRole } from '../../types/agro';

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

const GoogleButton: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast(t('auth.googleSoon'), 'info')} className="btn w-full bg-white border border-line text-ink hover:bg-sand">
      <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.1 14.6 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z" /></svg>
      {t('auth.google')}
    </button>
  );
};

const OrDivider: React.FC = () => {
  const { t } = useTranslation();
  return <div className="flex items-center gap-3 my-5 text-xs font-bold uppercase text-muted"><span className="flex-1 h-px bg-line" />{t('auth.or')}<span className="flex-1 h-px bg-line" /></div>;
};

const PENDING_EMAIL_KEY = 'agroinvest_pending_email';
const readPendingEmail = () => { try { return sessionStorage.getItem(PENDING_EMAIL_KEY) ?? ''; } catch { return ''; } };
const savePendingEmail = (e: string) => { try { sessionStorage.setItem(PENDING_EMAIL_KEY, e); } catch { /* ignore */ } };

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
  useEffect(() => { setEmail(initial); }, [initial]);
  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!EMAIL_RE.test(email.trim())) { setMsg({ tone: 'error', text: t('form.email') }); return; }
    setBusy(true); setMsg(null);
    try { const m = await authService.resendConfirmation(email); setMsg({ tone: 'ok', text: m || t('auth.resent') }); }
    catch (x) { setMsg({ tone: 'error', text: errorText(t, x) }); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={send} noValidate className="grid gap-3 mt-6 text-left">
      {askEmail && (
        <Field label={t('auth.email')} htmlFor="resend-email"><input id="resend-email" type="email" className="field" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></Field>
      )}
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
  useEffect(() => { document.title = `${t('auth.login')} · AGROInvest`; }, [t]);
  if (user && !busy) return <Navigate to={lp(cabinetHome(user))} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: typeof err = {};
    if (!id.trim()) er.id = t('form.required');
    if (!pw) er.pw = t('form.required');
    setErr(er);
    if (er.id || er.pw) return;
    setBusy(true); setUnconfirmed(false);
    try {
      const u = await authService.login(id, pw, remember);
      navigate(lp(cabinetHome(u)), { replace: true });
    } catch (x) {
      setErr({ form: errorText(t, x) });
      setUnconfirmed(x instanceof ApiError && x.status === 403);
      setBusy(false);
    }
  };
  const fill = (email: string) => { setId(email); setPw(TEST_PASSWORD); };
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
        <div className="flex items-center justify-between gap-3 text-sm">
          <label className="flex items-center gap-2 font-semibold cursor-pointer"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="w-4 h-4 accent-[#1F4D2E]" />{t('auth.remember')}</label>
          <Link to={lp('/forgot-password')} className="font-bold text-leaf-dark hover:underline">{t('auth.forgot')}</Link>
        </div>
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}{t('auth.login')}</button>
      </form>
      <OrDivider />
      <GoogleButton />
      <p className="text-center text-sm mt-8">{t('auth.noAccount')} <Link to={lp('/signup')} className="font-bold text-leaf-dark hover:underline">{t('auth.signup')}</Link></p>
      {import.meta.env.VITE_HIDE_TEST_ACCOUNTS !== 'true' ? (
        <aside className="mt-8 rounded-2xl border border-dashed border-gold bg-[#FBF6E8] p-4 text-sm" aria-label={t('auth.devTitle')}>
          <p className="font-bold text-gold-dark">{t('auth.devTitle')}</p>
          <ul className="mt-2 grid gap-1">
            {[['both@agroinvest.az', t('auth.devBoth')], ['owner@agroinvest.az', t('auth.devOwner')], ['investor@agroinvest.az', t('auth.devInvestor')]].map(([e, d]) => (
              <li key={e}><button type="button" onClick={() => fill(e)} className="font-mono text-xs underline hover:text-brand">{e}</button> — {d}</li>
            ))}
          </ul>
          <p className="mt-2 text-muted">{t('auth.devText', { pw: TEST_PASSWORD })}</p>
        </aside>
      ) : null}
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
  useEffect(() => { document.title = `${t('auth.forgotTitle')} · AGROInvest`; }, [t]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) { setErr(t('form.email')); return; }
    setErr(''); setBusy(true);
    try { await authService.sendResetLink(email); setSent(true); }
    catch (x) { setErr(errorText(t, x)); }
    finally { setBusy(false); }
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
            <button type="submit" className="btn btn-primary w-full" disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}{t('auth.sendLink')}</button>
          </form>
          <p className="text-center text-sm mt-8"><Link to={lp('/login')} className="font-bold text-leaf-dark hover:underline">{t('auth.backLogin')}</Link></p>
        </>
      )}
    </AuthLayout>
  );
};

/* ---------- 1.4 Sign-up flow ---------- */
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
      <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">{t('auth.step', { n, total: 3 })}</p>
      <ol className="flex gap-2" aria-label={t('auth.step', { n, total: 3 })}>
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

export const SignupPage: React.FC = () => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const user = useCurrentUser();
  const step = params.get('step') ?? 'account';
  const go = (s: string) => setParams({ step: s });

  // Step 1
  const [v, setV] = useState({ fullName: '', email: '', code: '+994', phone: '', password: '', confirm: '', terms: false });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  // Check-email step
  const [sentTo, setSentTo] = useState(readPendingEmail);
  const [deliveryFailed, setDeliveryFailed] = useState(false);
  // Step 2 / 3
  const [role, setRole] = useState<CabinetRole | null>(null);
  const [profile, setProfile] = useState({ region: '', plots: '', investorType: 'individual' as 'individual' | 'company', budget: 1, types: [] as string[] });

  useEffect(() => { document.title = `${t('auth.signup')} · AGROInvest`; }, [t]);
  if (step === 'account' && user && user.roles.length) return <Navigate to={lp(cabinetHome(user))} replace />;
  if (step === 'check-email' && !sentTo) return <Navigate to={lp('/signup')} replace />;
  if (step !== 'account' && step !== 'check-email' && !user) return <Navigate to={lp('/signup')} replace />;

  const submitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (v.fullName.trim().length < 3) er.fullName = t('form.minLength', { n: 3 });
    else if (v.fullName.trim().split(/\s+/).length < 2) er.fullName = t('auth.errors.fullName');
    if (!EMAIL_RE.test(v.email)) er.email = t('form.email');
    if (v.phone.replace(/\D/g, '').length < 7) er.phone = t('auth.errors.phone');
    if (v.password.length < 8) er.password = t('form.minLength', { n: 8 });
    if (v.confirm !== v.password) er.confirm = t('auth.errors.passwordMatch');
    if (!v.terms) er.terms = t('auth.errors.terms');
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const r = await authService.signup({ fullName: v.fullName, email: v.email, phone: `${v.code} ${v.phone.trim()}`, password: v.password });
      const email = v.email.trim().toLowerCase();
      savePendingEmail(email); setSentTo(email); setDeliveryFailed(r.emailDeliveryFailed);
      go('check-email');
    } catch (x) {
      const text = errorText(t, x);
      const field = x instanceof ApiError && x.status === 409 ? 'email' : x instanceof ApiError && /telefon/i.test(x.detail) ? 'phone' : 'form';
      setErr({ [field]: text });
    }
    finally { setBusy(false); }
  };
  const submitRole = async () => {
    if (!role) { setErr({ role: t('auth.errors.role') }); return; }
    setBusy(true);
    await authService.addRole(role);
    setBusy(false);
    go(`profile-${role}`);
  };
  const ranges: [number, number][] = [[0, 50000], [50000, 200000], [200000, 500000], [500000, 2000000]];
  const finish = async (skip: boolean) => {
    const r: CabinetRole = step === 'profile-investor' ? 'investor' : 'landowner';
    if (!skip) {
      setBusy(true);
      if (r === 'investor') {
        await authService.updateProfile({ investorType: profile.investorType });
        await authService.updatePreferences({ budgetMin: ranges[profile.budget][0], budgetMax: ranges[profile.budget][1], fieldTypes: profile.types });
      } else {
        await authService.updateProfile({ region: profile.region || undefined, plotsCount: profile.plots ? Number(profile.plots) : undefined });
      }
      setBusy(false);
    }
    navigate(lp(r === 'investor' ? '/investor' : '/owner'), { replace: true });
  };

  const s = strength(v.password);
  const levels = t('auth.strengthLevels', { returnObjects: true }) as unknown as string[];
  const bind = (k: 'fullName' | 'email' | 'phone') => ({ id: `su-${k}`, value: v[k], 'aria-invalid': !!err[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value }) });

  return (
    <AuthLayout image="/images/site/photo-07.jpg" quote={t('auth.quoteSignup')} wide={step === 'role' || step.startsWith('profile')}>
      {step === 'account' && (
        <>
          <StepHeader n={1} />
          <h1 className="font-display text-4xl text-brand">{t('auth.signupTitle')}</h1>
          <p className="text-muted mt-2 mb-8">{t('auth.signupSubtitle')}</p>
          {err.form && <div className="mb-5"><Alert>{err.form}</Alert></div>}
          <form onSubmit={submitAccount} noValidate className="grid gap-5">
            <Field label={t('auth.fullName')} htmlFor="su-fullName" error={err.fullName}><input className="field" autoComplete="name" {...bind('fullName')} /></Field>
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
            <button type="submit" className="btn btn-primary w-full" disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}{t('auth.create')}</button>
          </form>
          <OrDivider />
          <GoogleButton />
          <p className="text-center text-sm mt-8">{t('auth.haveAccount')} <Link to={lp('/login')} className="font-bold text-leaf-dark hover:underline">{t('auth.login')}</Link></p>
        </>
      )}

      {step === 'check-email' && (
        <div className="text-center" role="status">
          <span className="w-16 h-16 rounded-full bg-sage text-brand grid place-items-center mx-auto mb-5"><Mail className="w-8 h-8" aria-hidden="true" /></span>
          <h1 className="font-display text-4xl text-brand">{t('auth.verifyTitle')}</h1>
          <p className="text-muted mt-3">{t('auth.verifyText', { email: sentTo })}</p>
          <p className="text-sm text-muted mt-2">{t('auth.verifyNext')}</p>
          {deliveryFailed && <div className="mt-5 text-left"><Alert tone="info">{t('auth.deliveryFailed')}</Alert></div>}
          <MailpitHint />
          <ResendLink email={sentTo} />
          <Link to={lp('/login')} className="btn btn-primary mt-8">{t('auth.backLogin')}</Link>
        </div>
      )}

      {step === 'role' && (
        <>
          <StepHeader n={2} />
          <h1 className="font-display text-4xl text-brand">{t('auth.roleTitle')}</h1>
          <div role="radiogroup" aria-label={t('auth.roleTitle')} className="grid sm:grid-cols-2 gap-4 mt-8">
            {([['landowner', MapIcon, t('auth.ownerCard'), t('auth.ownerCardText')], ['investor', TrendingUp, t('auth.investorCard'), t('auth.investorCardText')]] as const).map(([r, Icon, title, text]) => (
              <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => { setRole(r); setErr({}); }}
                className={`text-left rounded-[1.25rem] border-2 p-6 transition ${role === r ? 'border-brand bg-sage shadow-[var(--shadow-soft)]' : 'border-line bg-white hover:border-leaf'}`}>
                <span className={`w-12 h-12 rounded-2xl grid place-items-center ${r === 'investor' ? 'bg-[#F4ECD6] text-gold-dark' : 'bg-sage text-brand'}`}><Icon className="w-6 h-6" aria-hidden="true" /></span>
                <span className="block font-display text-2xl text-brand mt-4">{title}</span>
                <span className="block text-muted mt-1">{text}</span>
                {role === r && <CheckCircle2 className="w-6 h-6 text-brand mt-3" aria-hidden="true" />}
              </button>
            ))}
          </div>
          {err.role && <p className="field-error mt-3" role="alert">{err.role}</p>}
          <p className="text-sm text-muted mt-5">{t('auth.roleNote')}</p>
          <button type="button" className="btn btn-primary mt-8 px-10" onClick={submitRole} disabled={busy}>{t('form.continue')}</button>
        </>
      )}

      {step.startsWith('profile') && (
        <>
          <StepHeader n={3} />
          <h1 className="font-display text-4xl text-brand">{t('auth.profileTitle')}</h1>
          <p className="text-muted mt-2 mb-8">{t('auth.profileSubtitle')}</p>
          {step === 'profile-landowner' ? (
            <div className="grid gap-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <Field label={t('owner.add.region')} htmlFor="pf-region">
                  <select id="pf-region" className="field" value={profile.region} onChange={e => setProfile({ ...profile, region: e.target.value })}>
                    <option value="">{t('owner.add.choose')}</option>
                    {REGIONS.map(r => <option key={r.key} value={r.key}>{t(`regions.${r.key}`)}</option>)}
                  </select>
                </Field>
                <Field label={t('auth.plots')} htmlFor="pf-plots"><input id="pf-plots" className="field" type="number" min={0} value={profile.plots} onChange={e => setProfile({ ...profile, plots: e.target.value })} /></Field>
              </div>
              <Field label={t('auth.idUpload')} htmlFor="pf-id" hint={t('auth.idHint')}>
                <label className="flex items-center gap-3 rounded-xl border border-dashed border-[#CFC8B6] bg-white p-4 cursor-pointer hover:border-leaf">
                  <Upload className="w-5 h-5 text-leaf" aria-hidden="true" /><span className="text-sm font-semibold">{t('owner.add.dropOrClick')}</span>
                  <input id="pf-id" type="file" accept=".jpg,.jpeg,.png,.pdf" className="sr-only" />
                </label>
              </Field>
            </div>
          ) : (
            <div className="grid gap-6">
              <fieldset>
                <legend className="field-label">{t('auth.investorType')}</legend>
                <div className="flex gap-3">
                  {(['individual', 'company'] as const).map(x => (
                    <label key={x} className={`flex-1 rounded-xl border-2 px-4 py-3 cursor-pointer font-semibold ${profile.investorType === x ? 'border-brand bg-sage' : 'border-line bg-white'}`}>
                      <input type="radio" name="inv-type" className="sr-only" checked={profile.investorType === x} onChange={() => setProfile({ ...profile, investorType: x })} />{t(`auth.${x}`)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field label={t('auth.budget')} htmlFor="pf-budget">
                <select id="pf-budget" className="field" value={profile.budget} onChange={e => setProfile({ ...profile, budget: Number(e.target.value) })}>
                  {(t('auth.budgetRanges', { returnObjects: true }) as unknown as string[]).map((r, i) => <option key={r} value={i}>{r}</option>)}
                </select>
              </Field>
              <div>
                <p className="field-label">{t('auth.preferredTypes')}</p>
                <Chips label={t('auth.preferredTypes')} options={CATEGORIES.map(c => ({ value: c.key, label: t(`fieldTypes.${c.key}`) }))} selected={profile.types} onChange={types => setProfile({ ...profile, types })} limit={10} />
              </div>
            </div>
          )}
          <div className="flex items-center gap-5 mt-10">
            <button type="button" className="btn btn-primary px-10" onClick={() => finish(false)} disabled={busy}>{t('auth.finish')}</button>
            <button type="button" className="text-sm font-bold text-muted hover:text-ink underline" onClick={() => finish(true)}>{t('auth.skip')}</button>
          </div>
        </>
      )}
    </AuthLayout>
  );
};

/* ---------- 1.3 Cabinet chooser ---------- */
export const ChooseCabinetPage: React.FC = () => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [remember, setRemember] = useState(false);
  if (!user) return <Navigate to={lp('/login')} replace />;
  if (user.roles.length < 2) return <Navigate to={lp(cabinetHome(user))} replace />;
  const open = (r: CabinetRole) => {
    authService.rememberCabinet(remember ? r : null);
    navigate(lp(r === 'landowner' ? '/owner' : '/investor'));
  };
  return (
    <AuthLayout image="/images/site/photo-16.jpg" quote={t('auth.quoteLogin')} wide>
      <h1 className="font-display text-4xl text-brand">{t('auth.chooserTitle')}</h1>
      <p className="text-muted mt-2 mb-8">{t('auth.chooserSubtitle')}</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <button type="button" onClick={() => open('landowner')} className="text-left rounded-[1.25rem] border-2 border-line bg-white p-6 hover:border-brand hover:shadow-[var(--shadow-lift)] transition">
          <span className="w-12 h-12 rounded-2xl grid place-items-center bg-sage text-brand"><MapIcon className="w-6 h-6" aria-hidden="true" /></span>
          <span className="block font-display text-2xl text-brand mt-4">{t('auth.ownerCabinet')}</span>
          <span className="block text-muted mt-1">{t('auth.ownerCabinetText')}</span>
        </button>
        <button type="button" onClick={() => open('investor')} className="text-left rounded-[1.25rem] border-2 border-line bg-white p-6 hover:border-gold hover:shadow-[var(--shadow-lift)] transition">
          <span className="w-12 h-12 rounded-2xl grid place-items-center bg-[#F4ECD6] text-gold-dark"><TrendingUp className="w-6 h-6" aria-hidden="true" /></span>
          <span className="block font-display text-2xl text-brand mt-4">{t('auth.investorCabinet')}</span>
          <span className="block text-muted mt-1">{t('auth.investorCabinetText')}</span>
        </button>
      </div>
      <label className="flex items-center gap-2 mt-6 font-semibold text-sm cursor-pointer"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="w-4 h-4 accent-[#1F4D2E]" />{t('auth.rememberChoice')}</label>
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
  useEffect(() => { document.title = `${t('auth.confirmTitle')} · AGROInvest`; }, [t]);
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
        {state === 'ok' && <Link to={lp('/login')} className="btn btn-primary mt-8">{t('auth.login')}</Link>}
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
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [pw, setPw] = useState({ next: '', confirm: '' });
  const [err, setErr] = useState<{ next?: string; confirm?: string; form?: string }>({});
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { document.title = `${t('auth.resetTitle')} · AGROInvest`; }, [t]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: typeof err = {};
    if (pw.next.length < 8) er.next = t('form.minLength', { n: 8 });
    if (pw.confirm !== pw.next) er.confirm = t('auth.errors.passwordMatch');
    setErr(er);
    if (er.next || er.confirm) return;
    setBusy(true);
    try { setDone(await authService.resetPassword(token, pw.next) || t('auth.resetDone')); }
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
