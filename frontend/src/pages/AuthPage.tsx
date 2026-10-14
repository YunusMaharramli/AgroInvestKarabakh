import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Eye, EyeOff, LogIn, UserPlus, AlertCircle, Phone } from 'lucide-react';
import { HELP_LINE } from '../components/Header.js';
import { PHOTOS } from '../lib/landImages.js';

interface AuthPageProps {
  initialMode?: 'login' | 'register';
  navigate: (route: string) => void;
}

const fieldClass =
  'w-full min-h-[3.25rem] px-4 rounded-xl border-2 border-[#9AA89E] bg-white text-ink text-lg focus:border-brand-700';

/** Only allow going back to a page on this site after login. */
function readNext(): string | null {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

const Field: React.FC<{
  id: string;
  label: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}> = ({ id, label, hint, optional, children }) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="font-bold text-base">
      {label} {optional && <span className="font-normal text-muted">(istəyə görə)</span>}
    </label>
    {children}
    {hint && <p id={`${id}-hint`} className="text-[0.95rem] text-muted">{hint}</p>}
  </div>
);

const PasswordInput: React.FC<{
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  describedBy?: string;
}> = ({ id, value, onChange, autoComplete, describedBy }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        required
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-describedby={describedBy}
        className={fieldClass}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        aria-pressed={show}
        className="shrink-0 min-h-[3.25rem] px-3 rounded-xl border-2 border-line bg-white text-brand-900 font-bold text-sm flex items-center gap-1.5 hover:border-brand-900"
      >
        {show ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
        {show ? 'Gizlət' : 'Göstər'}
      </button>
    </div>
  );
};

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = 'login', navigate }) => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const next = readNext();

  // The header links switch between /login and /register without remounting this page
  useEffect(() => { setMode(initialMode); setErrorMessage(''); }, [initialMode]);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('+994 ');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regCompanyName, setRegCompanyName] = useState('');
  const [regTaxNumber, setRegTaxNumber] = useState('');

  const switchMode = (m: 'login' | 'register') => {
    setMode(m);
    setErrorMessage('');
    navigate(`/${m}${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  };

  const afterLogin = (role?: string) => {
    if (next) navigate(next);
    else if (role === 'ADMIN') navigate('/admin');
    else navigate('/dashboard');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);
    const res = await login(loginEmail.trim(), loginPassword);
    setLoading(false);
    if (res.success) afterLogin(res.role);
    else setErrorMessage(res.error || 'Daxil olmaq alınmadı. E-poçtu və şifrəni yoxlayın.');
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (regPassword.length < 8) {
      setErrorMessage('Şifrə ən azı 8 simvoldan ibarət olmalıdır.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage('İki şifrə eyni deyil. Zəhmət olmasa yenidən yazın.');
      return;
    }
    setLoading(true);
    const res = await register({
      firstName: regFirstName.trim(),
      lastName: regLastName.trim(),
      email: regEmail.trim(),
      phone: regPhone.trim(),
      password: regPassword,
      confirmPassword: regConfirmPassword,
      companyName: regCompanyName.trim(),
      taxIdentificationNumber: regTaxNumber.trim(),
      businessActivity: '',
    });
    setLoading(false);
    if (res.success) afterLogin(res.role);
    else setErrorMessage(res.error || 'Qeydiyyat alınmadı. Məlumatları yoxlayıb yenidən cəhd edin.');
  };

  const fillDemo = (email: string, password: string) => {
    setMode('login');
    setLoginEmail(email);
    setLoginPassword(password);
    setErrorMessage('');
  };

  return (
    <div className="bg-cream py-8 sm:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1fr_1.1fr] gap-8 items-start">
        {/* Left: reassurance (wide screens only) */}
        <aside className="hidden lg:flex flex-col rounded-3xl overflow-hidden bg-brand-900 text-white sticky top-6">
          <img src={PHOTOS.hero} alt="" className="w-full h-64 object-cover" />
          <div className="p-8 flex flex-col gap-5">
            <h2 className="font-display font-extrabold text-2xl leading-snug">
              {mode === 'login' ? 'Xoş gəlmisiniz!' : 'Qeydiyyat pulsuzdur və bir neçə dəqiqə çəkir'}
            </h2>
            <ul className="flex flex-col gap-3 text-lg text-[#DCE8E0]">
              <li>✓ İnvestisiya elanlarına təklif göndərin</li>
              <li>✓ Öz torpağınız üçün investor tapın</li>
              <li>✓ Bəyəndiyiniz sahələri yadda saxlayın</li>
            </ul>
            <div className="mt-2 p-5 rounded-2xl bg-white/10">
              <p className="text-base text-[#DCE8E0]">Çətinlik çəkirsiniz? Zəng edin:</p>
              <p className="font-display font-extrabold text-2xl text-gold-400 flex items-center gap-2 mt-1">
                <Phone className="w-6 h-6" aria-hidden="true" />
                {HELP_LINE}
              </p>
            </div>
          </div>
        </aside>

        {/* Right: the form */}
        <div>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl leading-tight text-brand-900">
            {mode === 'login' ? 'Kabinetə daxil olun' : 'Qeydiyyatdan keçin'}
          </h1>
          <p className="text-lg text-[#3E4F45] mt-2">
            {next
              ? 'Davam etmək üçün əvvəlcə daxil olun. Sonra sizi qaldığınız yerə qaytaracağıq.'
              : mode === 'login'
                ? 'Təkliflərinizi və torpaqlarınızı görmək üçün daxil olun.'
                : 'Təklif göndərmək və ya torpağınızı yerləşdirmək üçün hesab yaradın.'}
          </p>

          {/* Two big tabs */}
          <div role="tablist" aria-label="Giriş və ya qeydiyyat" className="grid grid-cols-2 gap-2 p-1.5 mt-6 rounded-2xl bg-sand">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`min-h-14 rounded-xl font-display font-bold text-lg flex items-center justify-center gap-2 ${
                  mode === m ? 'bg-white text-brand-900 shadow' : 'text-[#3E4F45] hover:text-brand-900'
                }`}
              >
                {m === 'login' ? <LogIn className="w-5 h-5" aria-hidden="true" /> : <UserPlus className="w-5 h-5" aria-hidden="true" />}
                {m === 'login' ? 'Daxil ol' : 'Qeydiyyat'}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-3xl border border-line p-5 sm:p-8 mt-4">
            {errorMessage && (
              <div role="alert" className="mb-6 p-4 rounded-xl bg-[#FCEBE8] border-2 border-[#C0392B] text-[#7A1F14] text-base flex gap-3">
                <AlertCircle className="w-6 h-6 shrink-0" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}

            {mode === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="flex flex-col gap-5">
                <Field id="l-email" label="E-poçt ünvanı">
                  <input
                    id="l-email"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="məsələn: ad@mail.az"
                    className={fieldClass}
                  />
                </Field>
                <Field id="l-pass" label="Şifrə">
                  <PasswordInput id="l-pass" value={loginPassword} onChange={setLoginPassword} autoComplete="current-password" />
                </Field>
                <button
                  type="submit"
                  disabled={loading}
                  className="min-h-14 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white font-display font-extrabold text-lg flex items-center justify-center gap-2"
                >
                  <LogIn className="w-6 h-6" aria-hidden="true" />
                  {loading ? 'Yoxlanılır…' : 'Daxil ol'}
                </button>
                <p className="text-base text-center">
                  Hesabınız yoxdur?{' '}
                  <button type="button" onClick={() => switchMode('register')} className="font-bold text-brand-900 underline underline-offset-4">
                    Qeydiyyatdan keçin
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-5">
                <fieldset className="flex flex-col gap-5">
                  <legend className="font-display font-extrabold text-xl text-brand-900 mb-1">1. Şəxsi məlumatlar</legend>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <Field id="r-first" label="Adınız">
                      <input id="r-first" type="text" required value={regFirstName} onChange={e => setRegFirstName(e.target.value)} autoComplete="given-name" className={fieldClass} />
                    </Field>
                    <Field id="r-last" label="Soyadınız">
                      <input id="r-last" type="text" required value={regLastName} onChange={e => setRegLastName(e.target.value)} autoComplete="family-name" className={fieldClass} />
                    </Field>
                  </div>
                  <Field id="r-email" label="E-poçt ünvanı">
                    <input id="r-email" type="email" required value={regEmail} onChange={e => setRegEmail(e.target.value)} autoComplete="email" placeholder="məsələn: ad@mail.az" className={fieldClass} />
                  </Field>
                  <Field id="r-phone" label="Telefon nömrəsi" hint="Məsələn: +994 50 123 45 67">
                    <input id="r-phone" type="tel" required value={regPhone} onChange={e => setRegPhone(e.target.value)} autoComplete="tel" aria-describedby="r-phone-hint" className={fieldClass} />
                  </Field>
                </fieldset>

                <fieldset className="flex flex-col gap-5 pt-5 border-t border-line">
                  <legend className="font-display font-extrabold text-xl text-brand-900 mb-1 pt-5">2. Təsərrüfat və ya şirkət</legend>
                  <Field id="r-company" label="Şirkətin və ya təsərrüfatın adı" optional>
                    <input id="r-company" type="text" value={regCompanyName} onChange={e => setRegCompanyName(e.target.value)} autoComplete="organization" className={fieldClass} />
                  </Field>
                  <Field id="r-tax" label="VÖEN" optional hint="Vergi ödəyicisinin eyniləşdirmə nömrəsi. Yoxdursa, boş saxlayın.">
                    <input id="r-tax" type="text" inputMode="numeric" value={regTaxNumber} onChange={e => setRegTaxNumber(e.target.value)} aria-describedby="r-tax-hint" className={fieldClass} />
                  </Field>
                </fieldset>

                <fieldset className="flex flex-col gap-5 pt-5 border-t border-line">
                  <legend className="font-display font-extrabold text-xl text-brand-900 mb-1 pt-5">3. Şifrə</legend>
                  <Field id="r-pass" label="Şifrə" hint="Ən azı 8 simvol. Yadda saxlayın və heç kimə deməyin.">
                    <PasswordInput id="r-pass" value={regPassword} onChange={setRegPassword} autoComplete="new-password" describedBy="r-pass-hint" />
                  </Field>
                  <Field id="r-pass2" label="Şifrəni təkrar yazın">
                    <PasswordInput id="r-pass2" value={regConfirmPassword} onChange={setRegConfirmPassword} autoComplete="new-password" />
                  </Field>
                </fieldset>

                <button
                  type="submit"
                  disabled={loading}
                  className="min-h-14 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white font-display font-extrabold text-lg flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-6 h-6" aria-hidden="true" />
                  {loading ? 'Hesab yaradılır…' : 'Hesab yarat'}
                </button>
                <p className="text-base text-center">
                  Artıq hesabınız var?{' '}
                  <button type="button" onClick={() => switchMode('login')} className="font-bold text-brand-900 underline underline-offset-4">
                    Daxil olun
                  </button>
                </p>
              </form>
            )}
          </div>

          {/* Phone users: help line under the form */}
          <p className="lg:hidden mt-5 text-base text-center">
            Çətinlik çəkirsiniz? Zəng edin: <strong className="text-brand-900">{HELP_LINE}</strong>
          </p>

          {/* Demo accounts for the hackathon jury */}
          <details className="mt-6 bg-white rounded-2xl border border-line p-4">
            <summary className="cursor-pointer font-bold text-brand-900 min-h-8">Sınaq hesabları (təqdimat üçün)</summary>
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <button
                type="button"
                onClick={() => fillDemo('sahibkar@agroinvest.az', 'Sahibkar2026!')}
                className="min-h-14 px-4 rounded-xl border-2 border-line text-left hover:border-brand-900"
              >
                <span className="block font-bold">Sahibkar</span>
                <span className="block text-sm text-muted truncate">sahibkar@agroinvest.az</span>
              </button>
              <button
                type="button"
                onClick={() => fillDemo('admin@agroinvest.gov.az', 'Admin2026!')}
                className="min-h-14 px-4 rounded-xl border-2 border-line text-left hover:border-brand-900"
              >
                <span className="block font-bold">İnzibatçı (admin)</span>
                <span className="block text-sm text-muted truncate">admin@agroinvest.gov.az</span>
              </button>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};
