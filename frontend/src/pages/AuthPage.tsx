import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Lock, Mail, User, Phone, Building, FileCheck, ArrowRight, ShieldCheck } from 'lucide-react';

interface AuthPageProps {
  initialMode?: 'login' | 'register';
  navigate: (route: string) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = 'login', navigate }) => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Registration form state
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('+994 ');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regCompanyName, setRegCompanyName] = useState('');
  const [regTaxNumber, setRegTaxNumber] = useState('');
  const [regActivity, setRegActivity] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    const res = await login(loginEmail, loginPassword);
    setLoading(false);

    if (res.success) {
      if (loginEmail.includes('admin')) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } else {
      setErrorMessage(res.error || 'Daxil olarkən xəta baş verdi.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Şifrələr bir-biri ilə uyğun gəlmir.');
      return;
    }

    setLoading(true);
    const res = await register({
      firstName: regFirstName,
      lastName: regLastName,
      email: regEmail,
      phone: regPhone,
      password: regPassword,
      confirmPassword: regConfirmPassword,
      companyName: regCompanyName,
      taxIdentificationNumber: regTaxNumber,
      businessActivity: regActivity,
    });
    setLoading(false);

    if (res.success) {
      navigate('/dashboard');
    } else {
      setErrorMessage(res.error || 'Qeydiyyat zamanı xəta baş verdi.');
    }
  };

  const fillDemoEntrepreneur = () => {
    setMode('login');
    setLoginEmail('sahibkar@agroinvest.az');
    setLoginPassword('Sahibkar2026!');
    setErrorMessage('');
  };

  const fillDemoAdmin = () => {
    setMode('login');
    setLoginEmail('admin@agroinvest.gov.az');
    setLoginPassword('Admin2026!');
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-800 text-amber-400 font-bold text-lg mb-3 shadow-sm">
          AQ
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          {mode === 'login' ? 'AgroInvest Qarabağ Portalına Giriş' : 'Yeni Sahibkar Qeydiyyatı'}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {mode === 'login'
            ? 'Şəxsi kabinetinizə daxil olaraq müraciətlərinizi idarə edin'
            : 'İnvestisiya müsabiqələrində iştirak etmək üçün elektron profil yaradın'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {/* Quick Demo Access Bar */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 mb-5 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-emerald-900 mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>Hakaton Test Hesabları (1-kliklə doldur):</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={fillDemoEntrepreneur}
              className="py-1.5 px-2.5 bg-white border border-emerald-300 text-emerald-800 rounded-lg font-semibold hover:bg-emerald-100/60 transition-colors text-left"
            >
              <span className="block font-bold">Sahibkar Hesabı</span>
              <span className="text-[10px] text-slate-500 block truncate">sahibkar@agroinvest.az</span>
            </button>
            <button
              type="button"
              onClick={fillDemoAdmin}
              className="py-1.5 px-2.5 bg-white border border-amber-300 text-amber-900 rounded-lg font-semibold hover:bg-amber-100/60 transition-colors text-left"
            >
              <span className="block font-bold">İnzibatçı (Admin)</span>
              <span className="text-[10px] text-slate-500 block truncate">admin@agroinvest.gov.az</span>
            </button>
          </div>
        </div>

        <div className="bg-white py-8 px-4 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          {/* Segmented Mode Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6 text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setMode('login'); setErrorMessage(''); }}
              className={`flex-1 py-2 rounded-lg transition-colors ${mode === 'login' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Daxil ol
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setErrorMessage(''); }}
              className={`flex-1 py-2 rounded-lg transition-colors ${mode === 'register' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Qeydiyyat
            </button>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs leading-relaxed">
              {errorMessage}
            </div>
          )}

          {mode === 'login' ? (
            /* Login Form */
            <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Elektron Poçt</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="adınız@sirket.az"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Şifrə</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <span>Yoxlanılır...</span> : <span>Sistemə Daxil Ol</span>}
              </button>
            </form>
          ) : (
            /* Register Form */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ad</label>
                  <input
                    type="text"
                    required
                    value={regFirstName}
                    onChange={e => setRegFirstName(e.target.value)}
                    placeholder="Məs: Rəşad"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Soyad</label>
                  <input
                    type="text"
                    required
                    value={regLastName}
                    onChange={e => setRegLastName(e.target.value)}
                    placeholder="Məs: Əliyev"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">E-poçt ünvanı</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  placeholder="resad@qarabag-agro.az"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Əlaqə nömrəsi</label>
                <input
                  type="text"
                  required
                  value={regPhone}
                  onChange={e => setRegPhone(e.target.value)}
                  placeholder="+994 50 123 45 67"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Şirkət / Təsərrüfat adı</label>
                  <input
                    type="text"
                    value={regCompanyName}
                    onChange={e => setRegCompanyName(e.target.value)}
                    placeholder="Aqro MMC və ya F/Ş"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">VÖEN (əgər varsa)</label>
                  <input
                    type="text"
                    value={regTaxNumber}
                    onChange={e => setRegTaxNumber(e.target.value)}
                    placeholder="1402398111"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Şifrə</label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Şifrə təkrarı</label>
                  <input
                    type="password"
                    required
                    value={regConfirmPassword}
                    onChange={e => setRegConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <span>Qeydiyyat aparılır...</span> : <span>Qeydiyyatı Tamamla</span>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
