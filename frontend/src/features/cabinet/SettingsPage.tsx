import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Upload } from 'lucide-react';
import { authService, useCurrentUser, errorText } from '../../services/api';
import { PageTitle, Avatar } from './CabinetShell';
import { Chips, Field, Segmented, Toggle } from '../../components/ui/Bits';
import { useToast } from '../../components/ui/Overlay';
import { applyLang, LANGS, Lang, useLang } from '../../app/i18n';
import { CATEGORIES } from '../../data/categories';
import { REGIONS } from '../../data/regions';
import type { CabinetRole, RiskTolerance } from '../../types/agro';

/** Profile & Settings (3.6 / 4.6), shared by both cabinets. */
export const SettingsPage: React.FC<{ role: CabinetRole }> = ({ role }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const lang = useLang();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const me = useCurrentUser()!;
  const [info, setInfo] = useState({ fullName: me.fullName, email: me.email, phone: me.phone, companyName: me.companyName ?? '' });
  const [notify, setNotify] = useState(me.notify ?? { email: true, sms: false, push: true });
  const [prefs, setPrefs] = useState(me.preferences);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwErr, setPwErr] = useState('');
  const save = async (patch: Parameters<typeof authService.updateProfile>[0]) => { await authService.updateProfile(patch); toast(t('settings.savedToast')); };
  const changeLang = (l: Lang) => { applyLang(l); navigate(pathname.replace(/^\/(az|en|ru)/, `/${l}`), { replace: true }); };

  return (
    <>
      <PageTitle title={t('settings.title')} />
      <div className="grid xl:grid-cols-2 gap-6">
        <section className="card p-6">
          <h2 className="font-display text-2xl text-brand mb-5">{t('settings.personal')}</h2>
          <div className="flex items-center gap-4 mb-6">
            <Avatar name={me.fullName} gold={role === 'investor'} />
            <label className="btn btn-outline btn-sm cursor-pointer"><Upload className="w-4 h-4" />{t('settings.changePhoto')}<input type="file" accept="image/*" className="sr-only" onChange={() => toast(t('settings.savedToast'))} /></label>
          </div>
          <form className="grid gap-4" onSubmit={e => { e.preventDefault(); void save({ fullName: info.fullName, phone: info.phone, companyName: info.companyName || undefined }); }}>
            <Field label={t('auth.fullName')} htmlFor="st-name"><input id="st-name" className="field" value={info.fullName} onChange={e => setInfo({ ...info, fullName: e.target.value })} /></Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t('auth.email')} htmlFor="st-email"><input id="st-email" className="field bg-sand/40" value={info.email} readOnly /></Field>
              <Field label={t('auth.phone')} htmlFor="st-phone"><input id="st-phone" className="field" value={info.phone} onChange={e => setInfo({ ...info, phone: e.target.value })} /></Field>
            </div>
            {role === 'investor' && <Field label={t('settings.company')} htmlFor="st-company" optional><input id="st-company" className="field" value={info.companyName} onChange={e => setInfo({ ...info, companyName: e.target.value })} /></Field>}
            <button type="submit" className="btn btn-primary justify-self-start">{t('form.save')}</button>
          </form>
        </section>

        <div className="grid gap-6 content-start">
          <section className="card p-6">
            <h2 className="font-display text-2xl text-brand mb-4">{t('settings.verification')}</h2>
            {me.verified
              ? <span className="inline-flex items-center gap-2 rounded-full bg-[#F4ECD6] text-gold-dark px-4 py-2 font-bold"><BadgeCheck className="w-5 h-5" />{role === 'landowner' ? t('settings.verifiedOwner') : t('settings.verifiedInvestor')}</span>
              : <div className="flex items-center gap-4"><span className="text-muted">{t('settings.notVerified')}</span><label className="btn btn-outline btn-sm cursor-pointer"><Upload className="w-4 h-4" />{t('settings.verifyCta')}<input type="file" className="sr-only" accept=".jpg,.png,.pdf" /></label></div>}
          </section>
          <section className="card p-6">
            <h2 className="font-display text-2xl text-brand mb-4">{t('settings.language')}</h2>
            <Segmented label={t('settings.language')} value={lang} onChange={changeLang} options={LANGS.map(l => ({ value: l, label: t(`lang.${l}`) }))} />
          </section>
          <section className="card p-6">
            <h2 className="font-display text-2xl text-brand mb-4">{t('settings.notifications')}</h2>
            <div className="grid gap-4">
              {(['email', 'sms', 'push'] as const).map(k => (
                <Toggle key={k} id={`st-n-${k}`} checked={notify[k]} label={t(`settings.n${k === 'email' ? 'Email' : k === 'sms' ? 'Sms' : 'Push'}`)}
                  onChange={v => { const n = { ...notify, [k]: v }; setNotify(n); void save({ notify: n }); }} />
              ))}
            </div>
          </section>
        </div>

        {role === 'investor' && (
          <section id="preferences" className="card p-6 xl:col-span-2 scroll-mt-24">
            <h2 className="font-display text-2xl text-brand">{t('settings.preferences')}</h2>
            <p className="text-muted text-sm mb-5">{t('settings.preferencesText')}</p>
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label={`${t('investor.search.budget')} — ${t('investor.search.min')}`} htmlFor="pr-min"><input id="pr-min" type="number" className="field" value={prefs.budgetMin} onChange={e => setPrefs({ ...prefs, budgetMin: Number(e.target.value) })} /></Field>
                <Field label={`${t('investor.search.budget')} — ${t('investor.search.max')}`} htmlFor="pr-max"><input id="pr-max" type="number" className="field" value={prefs.budgetMax} onChange={e => setPrefs({ ...prefs, budgetMax: Number(e.target.value) })} /></Field>
                <div className="sm:col-span-2"><p className="field-label">{t('investor.search.risk')}</p><Segmented label={t('investor.search.risk')} value={prefs.riskTolerance} onChange={(v: RiskTolerance) => setPrefs({ ...prefs, riskTolerance: v })} options={(['low', 'medium', 'high'] as const).map(r => ({ value: r, label: t(`risk.${r}`) }))} /></div>
              </div>
              <div className="grid gap-4">
                <div><p className="field-label">{t('investor.search.types')}</p><Chips label={t('investor.search.types')} options={CATEGORIES.map(c => ({ value: c.key, label: t(`fieldTypes.${c.key}`) }))} selected={prefs.fieldTypes} onChange={v => setPrefs({ ...prefs, fieldTypes: v })} limit={10} /></div>
                <div><p className="field-label">{t('investor.search.regions')}</p><Chips label={t('investor.search.regions')} options={REGIONS.map(r => ({ value: r.key, label: t(`regions.${r.key}`) }))} selected={prefs.regions} onChange={v => setPrefs({ ...prefs, regions: v })} limit={10} /></div>
              </div>
            </div>
            <button type="button" className="btn btn-primary mt-6" onClick={async () => { await authService.updatePreferences(prefs); toast(t('settings.savedToast')); }}>{t('form.save')}</button>
          </section>
        )}

        <section className="card p-6 xl:col-span-2">
          <h2 className="font-display text-2xl text-brand mb-4">{t('settings.password')}</h2>
          <form className="grid sm:grid-cols-[1fr_1fr_auto] gap-4 items-end" onSubmit={async e => {
            e.preventDefault();
            if (pw.next.length < 8) { setPwErr(t('form.minLength', { n: 8 })); return; }
            try { await authService.changePassword(pw.current, pw.next); setPw({ current: '', next: '' }); setPwErr(''); toast(t('settings.pwChanged')); }
            catch (x) { setPwErr(errorText(t, x)); }
          }}>
            <Field label={t('settings.current')} htmlFor="pw-cur"><input id="pw-cur" type="password" className="field" autoComplete="current-password" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} /></Field>
            <Field label={t('settings.newPw')} htmlFor="pw-new" error={pwErr}><input id="pw-new" type="password" className="field" autoComplete="new-password" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} /></Field>
            <button type="submit" className="btn btn-primary">{t('settings.updatePw')}</button>
          </form>
        </section>
      </div>
    </>
  );
};
