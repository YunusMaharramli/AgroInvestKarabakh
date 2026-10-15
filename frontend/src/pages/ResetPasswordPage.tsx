import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react';

interface ResetPasswordPageProps {
  navigate: (route: string) => void;
}

const fieldClass =
  'w-full min-h-[3.25rem] px-4 rounded-xl border-2 border-[#9AA89E] bg-white text-ink text-lg focus:border-brand-700';

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ navigate }) => {
  const token = new URLSearchParams(window.location.search).get('token');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || loading) return;

    setErrorMessage('');
    if (newPassword.length < 8) {
      setErrorMessage('Şifrə ən azı 8 simvoldan ibarət olmalıdır.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage('Yeni şifrələr bir-biri ilə uyğun gəlmir.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, confirmNewPassword }),
      });
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || 'Şifrə yenilənə bilmədi. Linki yoxlayın.');
        return;
      }

      setNewPassword('');
      setConfirmNewPassword('');
      setSuccess(true);
      window.history.replaceState(null, '', '/reset-password');
    } catch {
      setErrorMessage('Şəbəkə xətası baş verdi. Yenidən cəhd edin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-cream py-8 sm:py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-line p-5 sm:p-8">
          {success
            ? <CheckCircle2 className="w-14 h-14 text-brand-700" aria-hidden="true" />
            : <KeyRound className="w-14 h-14 text-brand-700" aria-hidden="true" />}
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-brand-900 mt-5">
            {success ? 'Şifrə yeniləndi' : 'Yeni şifrə yaradın'}
          </h1>
          <p className="text-lg text-[#3E4F45] mt-3">
            {success
              ? 'Yeni şifrənizlə hesabınıza daxil ola bilərsiniz.'
              : 'Yeni şifrənizi daxil edin. Bu link 30 dəqiqə etibarlıdır və yalnız bir dəfə işləyir.'}
          </p>

          {!token && !success && (
            <div role="alert" className="mt-6 p-4 rounded-xl bg-[#FCEBE8] border-2 border-[#C0392B] text-[#7A1F14] text-base flex gap-3">
              <AlertCircle className="w-6 h-6 shrink-0" aria-hidden="true" />
              <span>Linkdə şifrə sıfırlama kodu yoxdur.</span>
            </div>
          )}
          {errorMessage && (
            <div role="alert" className="mt-6 p-4 rounded-xl bg-[#FCEBE8] border-2 border-[#C0392B] text-[#7A1F14] text-base flex gap-3">
              <AlertCircle className="w-6 h-6 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          {success ? (
            <button type="button" onClick={() => navigate('/login')} className="mt-8 min-h-14 px-8 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-display font-extrabold text-lg">
              Girişə keç
            </button>
          ) : token ? (
            <form onSubmit={resetPassword} className="mt-8 flex flex-col gap-5">
              <div>
                <label htmlFor="new-password" className="block font-bold text-brand-900 mb-2">Yeni şifrə</label>
                <div className="flex gap-2">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={event => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    className={fieldClass}
                  />
                  <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Şifrəni gizlət' : 'Şifrəni göstər'} aria-pressed={showPassword} className="shrink-0 min-h-[3.25rem] px-3 rounded-xl border-2 border-line bg-white text-brand-900">
                    {showPassword ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="confirm-new-password" className="block font-bold text-brand-900 mb-2">Yeni şifrəni təkrar yazın</label>
                <input
                  id="confirm-new-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirmNewPassword}
                  onChange={event => setConfirmNewPassword(event.target.value)}
                  autoComplete="new-password"
                  className={fieldClass}
                />
              </div>
              <button type="submit" disabled={loading} className="min-h-14 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white font-display font-extrabold text-lg">
                {loading ? 'Yenilənir…' : 'Şifrəni yenilə'}
              </button>
            </form>
          ) : null}

          {!success && (
            <button type="button" onClick={() => navigate('/forgot-password')} className="mt-6 font-bold text-brand-900 underline underline-offset-4">
              Yeni sıfırlama linki istə
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
