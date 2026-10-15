import React from 'react';
import ReCAPTCHA from 'react-google-recaptcha';

interface RecaptchaFieldProps {
  onChange: (token: string | null) => void;
}

export const RecaptchaField = React.forwardRef<ReCAPTCHA, RecaptchaFieldProps>(
  function RecaptchaField({ onChange }, ref) {
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

    if (!siteKey) {
      return <p role="alert" className="text-[#7A1F14]">reCAPTCHA açarı konfiqurasiya edilməyib.</p>;
    }

    return (
      <div className="flex justify-start">
        <ReCAPTCHA
          ref={ref}
          sitekey={siteKey}
          onChange={onChange}
          onExpired={() => onChange(null)}
          onErrored={() => onChange(null)}
        />
      </div>
    );
  }
);
