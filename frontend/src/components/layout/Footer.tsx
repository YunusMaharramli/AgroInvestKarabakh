import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { CheckCircle2, MapPin, Mail, Phone } from 'lucide-react';
import { Logo } from './Logo';
import { useLocalePath } from '../../app/i18n';
import { CONTACT } from './Header';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SOCIAL = [
  { name: 'Instagram', href: 'https://instagram.com/', path: 'M12 7a5 5 0 100 10 5 5 0 000-10zm0 8.2a3.2 3.2 0 110-6.4 3.2 3.2 0 010 6.4zM17.3 5.5a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4zM12 3c-2.4 0-2.7 0-3.7.1-3.3.1-4.9 1.7-5.1 5.1C3 9.3 3 9.6 3 12s0 2.7.1 3.7c.2 3.3 1.8 4.9 5.1 5.1 1 .1 1.3.1 3.7.1s2.7 0 3.7-.1c3.3-.2 4.9-1.8 5.1-5.1.1-1 .1-1.3.1-3.7s0-2.7-.1-3.7c-.2-3.3-1.8-4.9-5.1-5.1C14.7 3 14.4 3 12 3z' },
  { name: 'Facebook', href: 'https://facebook.com/', path: 'M14 8.5V6.8c0-.8.2-1.3 1.4-1.3H17V2.6c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2H8.2v3.2h2.6V21H14v-9.3h2.6l.4-3.2H14z' },
  { name: 'LinkedIn', href: 'https://linkedin.com/', path: 'M6.9 21H3.3V9.3h3.6V21zM5.1 7.7a2.1 2.1 0 110-4.2 2.1 2.1 0 010 4.2zM21 21h-3.6v-5.7c0-1.4 0-3.1-1.9-3.1s-2.2 1.5-2.2 3V21H9.7V9.3h3.4v1.6h.1c.5-.9 1.6-1.9 3.4-1.9 3.6 0 4.3 2.4 4.3 5.5V21z' },
  { name: 'YouTube', href: 'https://youtube.com/', path: 'M21.6 7.2a2.5 2.5 0 00-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 002.4 7.2 26 26 0 002 12a26 26 0 00.4 4.8 2.5 2.5 0 001.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.5 2.5 0 001.8-1.8A26 26 0 0022 12a26 26 0 00-.4-4.8zM10 15V9l5.2 3L10 15z' },
];

export const NewsletterForm: React.FC = () => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<{ name?: string; email?: string }>({});
  const [done, setDone] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: typeof err = {};
    if (!name.trim()) er.name = t('form.required');
    if (!EMAIL_RE.test(email)) er.email = t('form.email');
    setErr(er);
    if (!er.name && !er.email) setDone(true);
  };
  if (done) return <p role="status" className="flex items-center gap-2 font-semibold text-gold"><CheckCircle2 className="w-5 h-5" />{t('footer.subscribed')}</p>;
  return (
    <form onSubmit={submit} noValidate className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-start">
      <div>
        <label htmlFor="nl-name" className="block text-sm font-semibold mb-1 text-cream/90">{t('footer.firstName')}*</label>
        <input id="nl-name" value={name} onChange={e => setName(e.target.value)} aria-invalid={!!err.name} autoComplete="given-name"
          className="w-full rounded-full bg-white/10 border border-white/30 px-4 py-2.5 text-cream placeholder:text-cream/50 focus:outline-none focus:border-gold" />
        {err.name && <p className="text-xs mt-1 text-[#FFB4A9]" role="alert">{err.name}</p>}
      </div>
      <div>
        <label htmlFor="nl-email" className="block text-sm font-semibold mb-1 text-cream/90">{t('footer.email')}*</label>
        <input id="nl-email" type="email" value={email} onChange={e => setEmail(e.target.value)} aria-invalid={!!err.email} autoComplete="email"
          className="w-full rounded-full bg-white/10 border border-white/30 px-4 py-2.5 text-cream focus:outline-none focus:border-gold" />
        {err.email && <p className="text-xs mt-1 text-[#FFB4A9]" role="alert">{err.email}</p>}
      </div>
      <button type="submit" className="btn btn-gold sm:mt-6">{t('footer.subscribe')}</button>
    </form>
  );
};

export const Footer: React.FC = () => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  return (
    <footer>
      {/* Part 1: brand band */}
      <section className="bg-forest text-cream py-16 text-center" aria-label={t('brand.name')}>
        <div className="container-x max-w-3xl flex flex-col items-center gap-4">
          <Logo light />
          <p className="eyebrow eyebrow-light">{t('brand.tagline')}</p>
          <p className="text-cream/85 text-lg leading-relaxed">
            <Trans i18nKey="footer.brandText" components={{
              inv: <Link to={lp('/investments')} className="underline decoration-gold underline-offset-4 hover:text-gold" />,
              own: <Link to={lp('/owners')} className="underline decoration-gold underline-offset-4 hover:text-gold" />,
            }} />
          </p>
          <p className="text-sm text-cream/75">{t('footer.member')} <Link to={lp('/login')} className="font-bold text-gold hover:underline">{t('footer.login')}</Link></p>
        </div>
      </section>

      {/* Part 2: two-column main footer */}
      <section className="bg-[#0F2A19] text-cream py-14">
        <div className="container-x grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="font-display text-3xl mb-6">{t('brand.name')}</h2>
            <h3 className="eyebrow eyebrow-light mb-2">{t('footer.visit')}</h3>
            <p id="footer-address" className="flex gap-2 text-cream/85 mb-6 scroll-mt-32">
              <MapPin className="w-5 h-5 text-gold shrink-0" aria-hidden="true" />
              <a href={CONTACT.maps} target="_blank" rel="noopener noreferrer" className="hover:text-gold">{t('footer.address')}</a>
            </p>
            <h3 className="eyebrow eyebrow-light mb-2">{t('footer.contactTitle')}</h3>
            <p className="flex gap-2 text-cream/85"><Mail className="w-5 h-5 text-gold" aria-hidden="true" /><a href={`mailto:${CONTACT.email}`} className="hover:text-gold underline underline-offset-4">{CONTACT.email}</a></p>
            <p className="flex gap-2 text-cream/85 mt-2"><Phone className="w-5 h-5 text-gold" aria-hidden="true" /><a href={CONTACT.phoneHref} className="hover:text-gold">{CONTACT.phone}</a></p>
          </div>
          <div>
            <h2 className="font-display text-3xl mb-6">{t('footer.stay')}</h2>
            <ul className="flex gap-3 mb-8">
              {SOCIAL.map(s => (
                <li key={s.name}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={t('footer.social', { name: s.name })}
                    className="w-11 h-11 rounded-full border border-white/30 grid place-items-center hover:bg-gold hover:text-forest hover:border-gold transition">
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true"><path d={s.path} /></svg>
                  </a>
                </li>
              ))}
            </ul>
            <NewsletterForm />
          </div>
        </div>
      </section>

      {/* Part 3: bottom bar */}
      <div className="bg-sand text-ink py-5 text-center text-sm">
        <p className="font-semibold">{t('footer.rights', { year: new Date().getFullYear() })}</p>
        <p className="text-muted text-xs mt-1">{t('footer.credits')}</p>
      </div>
    </footer>
  );
};
