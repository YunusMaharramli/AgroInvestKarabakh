import { useCallback, useEffect, useState } from 'react';
import { PageTitle } from '../cabinet/CabinetShell';
import { backend, backendToken, BackendError } from '../../services/backend';
import { syncMinistryLands } from '../../services/ministryLands';

interface Review {
  land: { id: string; title: string; region: string; areaHectares: number; status: string; description: string };
  owner: { firstName: string; lastName: string; email: string } | null;
  documents: { id: string; fileName: string; url: string }[];
  opportunity: { id: string; status: string } | null;
  ownerPhone: string | null;
  reviewNote: string | null;
}
interface Proposal {
  id: string; referenceNumber: string; status: string; proposedInvestmentAmount: number;
  businessPlanSummary: string; submittedAt: string;
  contactPhone: string;
  user: { firstName: string; lastName: string; email: string } | null;
  opportunity: { id: string; title: string; status: string } | null;
  documents: { id: string; fileName: string; url: string }[];
}

async function openDocument(url: string): Promise<void> {
  const preview = window.open('about:blank', '_blank');
  if (preview) preview.opener = null;
  const token = backendToken();
  try {
    const response = await fetch(url, { credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!response.ok) throw new Error('Sənəd açıla bilmədi.');
    const objectUrl = URL.createObjectURL(await response.blob());
    if (preview) preview.location.replace(objectUrl);
    else { const link = document.createElement('a'); link.href = objectUrl; link.target = '_blank'; link.rel = 'noopener'; link.click(); }
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) { preview?.close(); throw error; }
}

export function AdminWorkflowPage() {
  const [tab, setTab] = useState<'reviews' | 'proposals' | 'republish'>('reviews');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [republish, setRepublish] = useState<Review[]>([]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');

  const reload = useCallback(async () => {
    try {
      const [r, p, q] = await Promise.all([
        backend<Review[]>('GET', '/admin/land-reviews'),
        backend<Proposal[]>('GET', '/admin/proposals'),
        backend<Review[]>('GET', '/admin/republish-reviews'),
      ]);
      setReviews(r); setProposals(p); setRepublish(q); setError('');
    } catch (x) { setError(x instanceof BackendError ? x.message || 'Serverə qoşulmaq mümkün olmadı.' : 'Məlumatlar yüklənmədi.'); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const act = async (path: string, body?: unknown) => {
    setBusy(true); setError('');
    try { await backend('POST', path, body); setReason(''); setSelected(''); await reload(); await syncMinistryLands(); }
    catch (x) { setError(x instanceof BackendError ? x.message || 'Əməliyyat alınmadı.' : 'Əməliyyat alınmadı.'); }
    finally { setBusy(false); }
  };
  const needReason = () => { if (reason.trim()) return true; setError('Səbəbi yazın.'); return false; };
  const docs = (items: { id: string; fileName: string; url: string }[]) =>
    <div className="flex flex-wrap gap-2 mt-3">{items.map(d => <button key={d.id} type="button" className="btn btn-outline btn-sm" onClick={() => void openDocument(d.url).catch(x => setError(String(x)))}>{d.fileName}</button>)}</div>;

  return <>
    <PageTitle title="Müraciətlər və qərarlar" subtitle="Torpaq müraciətlərini yoxlayın, investor təklifləri üzrə qərarı nazirlik versin." />
    <div className="flex flex-wrap gap-2 mb-6">
      {([['reviews', `Torpaq müraciətləri (${reviews.length})`], ['proposals', `Təkliflər (${proposals.length})`], ['republish', `Yenidən dərc (${republish.length})`]] as const).map(([id, label]) =>
        <button key={id} type="button" className={tab === id ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'} onClick={() => { setTab(id); setSelected(''); setError(''); }}>{label}</button>)}
    </div>
    {error && <p role="alert" className="rounded-xl bg-[#F6E3DF] text-danger px-4 py-3 mb-5">{error}</p>}
    {tab === 'reviews' && <div className="grid gap-4">{reviews.length === 0 && <p className="text-muted">Baxılacaq torpaq müraciəti yoxdur.</p>}{reviews.map(r =>
      <section key={r.land.id} className="card p-5">
        <h2 className="font-display text-xl text-brand">{r.land.title}</h2>
        <p className="text-sm text-muted mt-1">{r.owner ? `${r.owner.firstName} ${r.owner.lastName} · ${r.owner.email}` : 'Sahibkar'}{r.ownerPhone ? ` · ${r.ownerPhone}` : ''} · {r.land.region} · {r.land.areaHectares} ha</p>
        <p className="text-sm mt-3 whitespace-pre-wrap">{r.land.description}</p>
        {docs(r.documents)}
        {r.reviewNote && <p className="text-sm mt-3 text-muted">Qeyd: {r.reviewNote}</p>}
        {selected === r.land.id && <textarea className="field mt-4" value={reason} onChange={e => setReason(e.target.value)} placeholder="Əlavə sənəd və ya rədd səbəbini yazın" />}
        <div className="flex flex-wrap gap-2 mt-4">
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void act(`/admin/land-reviews/${r.land.id}/approve`)}>Təsdiq və dərc et</button>
          {selected === r.land.id ? <>
            <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => { if (needReason()) void act(`/admin/land-reviews/${r.land.id}/request-documents`, { message: reason }); }}>Sənəd istə</button>
            <button type="button" className="btn btn-outline btn-sm text-danger" disabled={busy} onClick={() => { if (needReason()) void act(`/admin/land-reviews/${r.land.id}/reject`, { message: reason }); }}>Rədd et</button>
          </> : <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelected(r.land.id)}>Sənəd istə / rədd et</button>}
        </div>
      </section>)}</div>}
    {tab === 'proposals' && <div className="grid gap-4">{proposals.length === 0 && <p className="text-muted">Təklif yoxdur.</p>}{proposals.map(p =>
      <section key={p.id} className="card p-5">
        <div className="flex flex-wrap justify-between gap-2"><h2 className="font-display text-xl text-brand">{p.opportunity?.title ?? p.referenceNumber}</h2><span className="text-sm font-bold">{p.status}</span></div>
        <p className="text-sm text-muted mt-1">{p.referenceNumber} · {p.user ? `${p.user.firstName} ${p.user.lastName} · ${p.user.email}` : 'Investor'} · {p.contactPhone} · {Number(p.proposedInvestmentAmount).toLocaleString('az-AZ')} AZN</p>
        <p className="text-sm mt-3 whitespace-pre-wrap">{p.businessPlanSummary}</p>
        {docs(p.documents)}
        {p.status === 'OPEN' && p.opportunity?.status === 'ACTIVE' && <>
          {selected === p.id && <textarea className="field mt-4" value={reason} onChange={e => setReason(e.target.value)} placeholder="Rədd etmə səbəbini yazın" />}
          <div className="flex flex-wrap gap-2 mt-4">
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void act(`/opportunities/${p.opportunity!.id}/select-winner`, { proposalId: p.id })}>Qalib seç</button>
            {selected === p.id ? <button type="button" className="btn btn-outline btn-sm text-danger" disabled={busy} onClick={() => { if (needReason()) void act(`/admin/proposals/${p.id}/reject`, { reason }); }}>Rədd et</button>
              : <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelected(p.id)}>Rədd et</button>}
          </div>
        </>}
      </section>)}</div>}
    {tab === 'republish' && <div className="grid gap-4">{republish.length === 0 && <p className="text-muted">Yenidən dərc müraciəti yoxdur.</p>}{republish.map(r =>
      <section key={r.land.id} className="card p-5">
        <h2 className="font-display text-xl text-brand">{r.land.title}</h2>
        <p className="text-sm text-muted mt-1">{r.owner ? `${r.owner.firstName} ${r.owner.lastName}` : 'Sahibkar'} · {r.land.region}</p>
        {docs(r.documents)}
        {selected === r.land.id && <textarea className="field mt-4" value={reason} onChange={e => setReason(e.target.value)} placeholder="Rədd etmə səbəbini yazın" />}
        <div className="flex flex-wrap gap-2 mt-4">
          <button type="button" className="btn btn-primary btn-sm" disabled={busy || !r.opportunity} onClick={() => void act(`/admin/republish-reviews/${r.opportunity!.id}/approve`)}>Yenidən dərc et</button>
          {selected === r.land.id ? <button type="button" className="btn btn-outline btn-sm text-danger" disabled={busy || !r.opportunity} onClick={() => { if (needReason()) void act(`/admin/republish-reviews/${r.opportunity!.id}/reject`, { message: reason }); }}>Rədd et</button>
            : <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelected(r.land.id)}>Rədd et</button>}
        </div>
      </section>)}</div>}
  </>;
}
