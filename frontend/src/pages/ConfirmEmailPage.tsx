import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, MailCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface ConfirmEmailPageProps {
  navigate: (route: string) => void;
}

export const ConfirmEmailPage: React.FC<ConfirmEmailPageProps> = ({ navigate }) => {
  const { resendConfirmation } = useAuth();
  const token = new URLSearchParams(window.location.search).get('token');
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [email, setEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const requestNewLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (resendLoading) return;

    setResendLoading(true);
    setResendMessage('');
    const result = await resendConfirmation(email.trim());
    setResendLoading(false);
    setResendMessage(result.success
      ? result.message || 'Sorğunuz qəbul edildi. E-poçtunuzu yoxlayın.'
      : result.error || 'Sorğu göndərilə bilmədi.');
  };

  const confirmEmail = async () => {
    if (!token || loading) return;

    setLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/confirm-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || 'Təsdiq linki etibarsızdır və ya vaxtı bitib.');
        return;
      }

      setConfirmed(true);
    } catch {
      setErrorMessage('Şəbəkə xətası baş verdi. Yenidən cəhd edin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-cream py-8 sm:py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-line p-5 sm:p-8 text-center">
          {confirmed ? (
            <CheckCircle2 className="w-14 h-14 mx-auto text-brand-700" aria-hidden="true" />
          ) : (
            <MailCheck className="w-14 h-14 mx-auto text-brand-700" aria-hidden="true" />
          )}
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-brand-900 mt-5">
            E-poçt təsdiqi
          </h1>
          <p className="text-lg text-[#3E4F45] mt-3">
            {confirmed
              ? 'E-poçt ünvanınız təsdiqləndi. İndi hesabınıza daxil ola bilərsiniz.'
              : 'Hesabınızı aktivləşdirmək üçün e-poçt ünvanınızı təsdiqləyin.'}
          </p>

          {!token && !confirmed && (
            <div role="alert" className="mt-6 p-4 rounded-xl bg-[#FCEBE8] border-2 border-[#C0392B] text-[#7A1F14] text-base flex gap-3 text-left">
              <AlertCircle className="w-6 h-6 shrink-0" aria-hidden="true" />
              <span>Linkdə təsdiq kodu yoxdur.</span>
            </div>
          )}
          {errorMessage && (
            <div role="alert" className="mt-6 p-4 rounded-xl bg-[#FCEBE8] border-2 border-[#C0392B] text-[#7A1F14] text-base flex gap-3 text-left">
              <AlertCircle className="w-6 h-6 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          {confirmed ? (
            <button type="button" onClick={() => navigate('/login')} className="mt-8 min-h-14 px-8 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-display font-extrabold text-lg">
              Girişə keç
            </button>
          ) : token ? (
            <button type="button" onClick={confirmEmail} disabled={loading} className="mt-8 min-h-14 px-8 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white font-display font-extrabold text-lg">
              {loading ? 'Təsdiqlənir…' : 'E-poçtu təsdiqlə'}
            </button>
          ) : null}

          {!confirmed && (
            <form onSubmit={requestNewLink} className="mt-8 pt-6 border-t border-line text-left">
              <label htmlFor="confirmation-email" className="block font-bold text-brand-900 mb-2">
                Yeni təsdiq linki lazımdır?
              </label>
              <p className="text-base text-[#3E4F45] mb-4">
                E-poçt ünvanınızı daxil edin. Yenidən göndərişlər arasında 5 dəqiqə gözləmə var.
              </p>
              <input
                id="confirmation-email"
                type="email"
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
                autoComplete="email"
                className="w-full min-h-[3.25rem] px-4 rounded-xl border-2 border-[#9AA89E] bg-white text-ink text-lg focus:border-brand-700"
              />
              <button type="submit" disabled={resendLoading} className="mt-4 min-h-14 px-8 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white font-display font-extrabold text-lg">
                {resendLoading ? 'Göndərilir…' : 'Yeni link istə'}
              </button>
              {resendMessage && <p role="status" className="text-base text-[#3E4F45] mt-4">{resendMessage}</p>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
