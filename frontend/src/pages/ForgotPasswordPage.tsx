import React, { useRef, useState } from 'react';
import type ReCAPTCHA from 'react-google-recaptcha';
import { AlertCircle, Mail } from 'lucide-react';
import { RecaptchaField } from '../components/RecaptchaField.js';

interface ForgotPasswordPageProps {
  navigate: (route: string) => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ navigate }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const requestReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    if (!recaptchaToken) {
      setErrorMessage('Robot yoxlamasını tamamlayın.');
      return;
    }

    setLoading(true);
    setMessage('');
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), recaptchaToken }),
      });
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || 'Sorğu göndərilə bilmədi.');
        return;
      }

      setMessage(data.message || 'Hesab varsa, şifrə sıfırlama linki göndəriləcək.');
    } catch {
      setErrorMessage('Şəbəkə xətası baş verdi. Yenidən cəhd edin.');
    } finally {
      setLoading(false);
      setRecaptchaToken(null);
      recaptchaRef.current?.reset();
    }
  };

  return (
    <div className="bg-cream py-8 sm:py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-line p-5 sm:p-8">
          <Mail className="w-14 h-14 text-brand-700" aria-hidden="true" />
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-brand-900 mt-5">
            Şifrəni unutmusunuz?
          </h1>
          <p className="text-lg text-[#3E4F45] mt-3">
            E-poçt ünvanınızı yazın. Hesabınız varsa, şifrəni yeniləmək üçün link göndərəcəyik.
          </p>

          {errorMessage && (
            <div role="alert" className="mt-6 p-4 rounded-xl bg-[#FCEBE8] border-2 border-[#C0392B] text-[#7A1F14] text-base flex gap-3">
              <AlertCircle className="w-6 h-6 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}
          {message && (
            <p role="status" className="mt-6 p-4 rounded-xl border border-brand-700 bg-cream text-brand-900 text-base">
              {message}
            </p>
          )}

          <form onSubmit={requestReset} className="mt-8 flex flex-col gap-5">
            <div>
              <label htmlFor="forgot-email" className="block font-bold text-brand-900 mb-2">E-poçt ünvanı</label>
              <input
                id="forgot-email"
                type="email"
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="məsələn: ad@mail.az"
                className="w-full min-h-[3.25rem] px-4 rounded-xl border-2 border-[#9AA89E] bg-white text-ink text-lg focus:border-brand-700"
              />
            </div>
            <RecaptchaField ref={recaptchaRef} onChange={setRecaptchaToken} />
            <button type="submit" disabled={loading} className="min-h-14 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white font-display font-extrabold text-lg">
              {loading ? 'Göndərilir…' : 'Sıfırlama linki göndər'}
            </button>
          </form>

          <button type="button" onClick={() => navigate('/login')} className="mt-6 font-bold text-brand-900 underline underline-offset-4">
            Girişə qayıt
          </button>
        </div>
      </div>
    </div>
  );
};
