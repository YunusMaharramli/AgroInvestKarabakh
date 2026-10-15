import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormat } from '../../app/i18n';
import { errorText, requestService } from '../../services/api';
import type { InvestmentRequest } from '../../types/agro';
export function ApplicationHistory({ application, canSupplement = false }: { application: InvestmentRequest; canSupplement?: boolean }) {
  const { t } = useTranslation(); const f = useFormat();
  const [message, setMessage] = useState(''); const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  return <div className="mt-4 grid gap-3 text-sm">
    <p className="font-bold">{application.referenceNumber}</p>
    {!!application.history?.length && <ol className="grid gap-2 border-l border-line pl-4">{application.history.map(h => <li key={h.id}><strong>{t('competition.status.' + h.newStatus, { defaultValue: h.newStatus })}</strong><span className="text-muted"> · {f.date(h.createdAt)} · {h.changedBy}</span>{h.comment && <p className="whitespace-pre-wrap">{h.comment}</p>}</li>)}</ol>}
    {!!application.documents?.length && <div className="flex flex-wrap gap-3">{application.documents.map(d => <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="font-semibold underline text-brand">{d.fileName}</a>)}</div>}
    {canSupplement && application.status === 'informationRequested' && <form className="grid gap-3" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await requestService.supplement(application.id, message, files); setMessage(''); setFiles([]); } catch(x) { setError(errorText(t,x)); } finally { setBusy(false); } }}>
      <label className="field-label">{t('competition.supplement')}<textarea className="field mt-1" required maxLength={4000} value={message} onChange={e => setMessage(e.target.value)} /></label>
      <label className="field-label">{t('competition.documents')}<input type="file" className="field mt-1" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFiles(Array.from(e.target.files ?? []))} /></label>
      {error && <p role="alert" className="text-danger">{error}</p>}
      <button disabled={busy} className="btn btn-primary justify-self-start">{t('competition.submit')}</button>
    </form>}
  </div>;
}
