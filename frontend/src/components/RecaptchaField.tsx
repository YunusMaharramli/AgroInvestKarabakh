import React from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';

/**
 * Google's public reCAPTCHA v2 test key: always passes and shows "for testing purposes only".
 * Used automatically on localhost when VITE_RECAPTCHA_SITE_KEY is not set
 * (the backend uses the matching test secret in appsettings.Development.json).
 * With a real site key the red test notice disappears.
 */
const GOOGLE_TEST_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
const isLocalhost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);

/** Google's widget is a fixed 304 × 78 px iframe; below this width it is scaled down instead of overflowing. */
const WIDGET_WIDTH = 304;

interface RecaptchaFieldProps {
  onChange: (token: string | null) => void;
}

export const RecaptchaField = React.forwardRef<ReCAPTCHA, RecaptchaFieldProps>(
  function RecaptchaField({ onChange }, ref) {
    const { t, i18n } = useTranslation();
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || (isLocalhost ? GOOGLE_TEST_SITE_KEY : '');
    // Show the widget in the site's language (az / en / ru), not the browser's.
    const hl = (i18n.resolvedLanguage ?? i18n.language ?? 'az').slice(0, 2);
    const boxRef = React.useRef<HTMLDivElement>(null);
    const [scale, setScale] = React.useState(1);

    React.useEffect(() => {
      const el = boxRef.current;
      if (!el || typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / WIDGET_WIDTH)));
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    if (!siteKey) {
      return <p role="alert" className="text-[#7A1F14]">reCAPTCHA açarı konfiqurasiya edilməyib.</p>;
    }

    return (
      <fieldset className="rounded-2xl border border-line bg-[#F7F5EF] px-4 py-4 sm:px-5">
        <legend className="sr-only">{t('auth.captchaTitle')}</legend>
        <div className="flex items-start gap-3 mb-3">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand" aria-hidden="true">
            <ShieldCheck className="h-4.5 w-4.5" />
          </span>
          <div>
            <p className="text-sm font-bold text-ink">{t('auth.captchaTitle')}</p>
            <p className="text-xs text-muted mt-0.5">{t('auth.captchaHint')}</p>
          </div>
        </div>
        <div ref={boxRef} className="flex justify-center overflow-hidden" style={{ height: 78 * scale }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
            <ReCAPTCHA
              key={hl}
              ref={ref}
              sitekey={siteKey}
              hl={hl}
              onChange={onChange}
              onExpired={() => onChange(null)}
              onErrored={() => onChange(null)}
            />
          </div>
        </div>
      </fieldset>
    );
  }
);
