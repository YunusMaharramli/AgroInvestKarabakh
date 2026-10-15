import React, { createContext, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, CheckCircle2 } from 'lucide-react';
import { Modal } from '../ui/Overlay';
import { Field } from '../ui/Bits';

/** Contact form and Help centre live in modals opened from the header dropdowns (Part 1, 2.2). */
type HelpTopic = 'faq' | 'invest' | 'list' | 'account' | 'report';
interface Ctx { openContact: () => void; openHelp: (topic: HelpTopic) => void }
const SiteModalCtx = createContext<Ctx>({ openContact: () => {}, openHelp: () => {} });
export const useSiteModals = () => useContext(SiteModalCtx);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ContactForm: React.FC<{ subjectDefault?: string; onDone: () => void; sendLabel?: string }> = ({ subjectDefault = '', sendLabel }) => {
  const { t } = useTranslation();
  const [v, setV] = useState({ name: '', email: '', subject: subjectDefault, message: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!v.name.trim()) er.name = t('form.required');
    if (!EMAIL_RE.test(v.email)) er.email = t('form.email');
    if (!v.subject.trim()) er.subject = t('form.required');
    if (v.message.trim().length < 10) er.message = t('form.minLength', { n: 10 });
    setErr(er);
    if (!Object.keys(er).length) setSent(true);
  };
  if (sent) return <p className="flex gap-3 items-start rounded-2xl bg-sage p-4 text-brand font-semibold" role="status"><CheckCircle2 className="w-6 h-6 shrink-0" />{t('contact.sent')}</p>;
  const bind = (k: keyof typeof v) => ({ id: `c-${k}`, value: v[k], 'aria-invalid': !!err[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value }) });
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={t('contact.name')} htmlFor="c-name" error={err.name}><input className="field" autoComplete="name" {...bind('name')} /></Field>
        <Field label={t('contact.emailField')} htmlFor="c-email" error={err.email}><input className="field" type="email" autoComplete="email" {...bind('email')} /></Field>
      </div>
      <Field label={t('contact.subject')} htmlFor="c-subject" error={err.subject}><input className="field" {...bind('subject')} /></Field>
      <Field label={t('contact.body')} htmlFor="c-message" error={err.message}><textarea className="field min-h-32" {...bind('message')} /></Field>
      <button type="submit" className="btn btn-primary justify-self-start">{sendLabel ?? t('contact.send')}</button>
    </form>
  );
};

const Accordion: React.FC<{ items: { q: string; a: string }[] }> = ({ items }) => (
  <div className="divide-y divide-line rounded-2xl border border-line bg-white">
    {items.map(it => (
      <details key={it.q} className="group p-4">
        <summary className="flex justify-between items-center gap-3 cursor-pointer font-semibold list-none">
          {it.q}<ChevronDown className="w-4 h-4 shrink-0 transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <p className="text-muted mt-2">{it.a}</p>
      </details>
    ))}
  </div>
);

const Steps: React.FC<{ items: string[] }> = ({ items }) => (
  <ol className="grid gap-3">
    {items.map((s, i) => (
      <li key={s} className="flex gap-3 items-start"><span className="w-7 h-7 rounded-full bg-brand text-white text-sm font-bold grid place-items-center shrink-0">{i + 1}</span><span className="pt-0.5">{s}</span></li>
    ))}
  </ol>
);

export const SiteModalsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const [contact, setContact] = useState(false);
  const [help, setHelp] = useState<HelpTopic | null>(null);
  const list = (k: string) => t(k, { returnObjects: true }) as unknown as string[];
  const topics: { id: HelpTopic; label: string }[] = [
    { id: 'faq', label: t('help.faq') }, { id: 'invest', label: t('help.howInvest') }, { id: 'list', label: t('help.howList') },
    { id: 'account', label: t('help.account') }, { id: 'report', label: t('help.report') },
  ];
  return (
    <SiteModalCtx.Provider value={{ openContact: () => setContact(true), openHelp: setHelp }}>
      {children}
      <Modal open={contact} onClose={() => setContact(false)} title={t('contact.modalTitle')} description={t('contact.modalText')}>
        <ContactForm onDone={() => setContact(false)} />
      </Modal>
      <Modal open={!!help} onClose={() => setHelp(null)} title={t('help.title')} size="lg">
        <div className="flex flex-wrap gap-2 mb-5" role="tablist" aria-label={t('help.title')}>
          {topics.map(tp => (
            <button key={tp.id} type="button" role="tab" aria-selected={help === tp.id} onClick={() => setHelp(tp.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-bold border ${help === tp.id ? 'bg-brand text-white border-brand' : 'bg-white border-line hover:border-leaf'}`}>{tp.label}</button>
          ))}
        </div>
        {help === 'faq' && <Accordion items={t('help.faqItems', { returnObjects: true }) as unknown as { q: string; a: string }[]} />}
        {help === 'invest' && <Steps items={list('help.investSteps')} />}
        {help === 'list' && <Steps items={list('help.listSteps')} />}
        {help === 'account' && <Steps items={list('help.accountSteps')} />}
        {help === 'report' && <><p className="text-muted mb-4">{t('help.reportText')}</p><ContactForm key="report" subjectDefault={t('help.report')} onDone={() => setHelp(null)} sendLabel={t('help.reportSend')} /></>}
      </Modal>
    </SiteModalCtx.Provider>
  );
};
