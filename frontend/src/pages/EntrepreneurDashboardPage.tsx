import React, { useState, useEffect } from 'react';
import { Favorite, MyLand, Notification, Proposal } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { useFavorites } from '../context/FavoritesContext.js';
import {
  FileText, Heart, Bell, User, AlertTriangle, X, ArrowRight, Check, Search, Phone, MapPin, Plus,
  Send, Inbox, Upload, Trophy, Image as ImageIcon,
} from 'lucide-react';
import { landImage, formatManat, formatDateAz } from '../lib/landImages.js';
import { statusInfo, STATUS_STEPS, landStatusInfo, apiError } from '../lib/applicationStatus.js';
import { HELP_LINE } from '../components/Header.js';

interface EntrepreneurDashboardPageProps {
  navigate: (route: string) => void;
}

type Tab = 'lands' | 'sent' | 'received' | 'favorites' | 'notifications' | 'profile';
const TAB_IDS: Tab[] = ['lands', 'sent', 'received', 'favorites', 'notifications', 'profile'];

const fieldClass =
  'w-full min-h-[3.25rem] px-4 rounded-xl border-2 border-[#9AA89E] bg-white text-ink text-lg focus:border-brand-700';
const primaryBtn = 'min-h-14 px-6 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-display font-bold flex items-center justify-center gap-2 disabled:opacity-50';
const outlineBtn = 'min-h-14 px-5 rounded-xl border-2 border-brand-900 text-brand-900 font-display font-bold flex items-center justify-center gap-2 hover:bg-cream disabled:opacity-50';

function initialTab(): Tab {
  const t = new URLSearchParams(window.location.search).get('tab') as Tab | null;
  return t && TAB_IDS.includes(t) ? t : 'lands';
}

/** Three-step progress: Göndərildi → Qərar gözlənilir → Qərar verildi */
const StatusSteps: React.FC<{ proposal: Proposal }> = ({ proposal }) => {
  const info = statusInfo(proposal);
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Təklifin mərhələləri">
      {STATUS_STEPS.map((s, i) => {
        const current = i === info.step;
        return (
          <li key={s} className="flex flex-col gap-1.5" aria-current={current ? 'step' : undefined}>
            <span className={`h-2.5 rounded-full ${i <= info.step ? 'bg-brand-700' : 'bg-sand'}`} />
            <span className={`text-sm leading-tight ${current ? 'font-extrabold text-ink' : 'text-muted'}`}>
              {i < info.step ? '✓ ' : ''}{s}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

const Empty: React.FC<{ title: string; text: string; action?: React.ReactNode }> = ({ title, text, action }) => (
  <div className="text-center py-14 px-6 bg-white rounded-3xl border border-line">
    <p className="font-display font-extrabold text-2xl text-brand-900">{title}</p>
    <p className="text-lg text-muted mt-2">{text}</p>
    {action && <div className="mt-6 flex justify-center">{action}</div>}
  </div>
);

/** List of private document links (opened with the session cookie). */
const DocumentLinks: React.FC<{ docs: { id: string; fileName: string; url: string }[]; title: string }> = ({ docs, title }) =>
  docs.length === 0 ? null : (
    <section className="mt-4">
      <h4 className="font-bold text-base mb-2">{title}</h4>
      <ul className="flex flex-col gap-2">
        {docs.map(d => (
          <li key={d.id}>
            <a href={d.url} target="_blank" rel="noopener" className="flex items-center gap-3 p-3 rounded-xl border border-line text-base hover:border-brand-700">
              <FileText className="w-5 h-5 text-brand-700 shrink-0" aria-hidden="true" />
              <span className="font-bold break-all underline underline-offset-4">{d.fileName}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );

export const EntrepreneurDashboardPage: React.FC<EntrepreneurDashboardPageProps> = ({ navigate }) => {
  const { user, profile, token, isLoading: authLoading, updateProfile } = useAuth();
  const { toggleFavorite } = useFavorites();
  const [activeTab, setActiveTabState] = useState<Tab>(initialTab);
  const [lands, setLands] = useState<MyLand[]>([]);
  const [sent, setSent] = useState<Proposal[]>([]);
  const [received, setReceived] = useState<Proposal[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Land actions
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadNote, setUploadNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Winner selection: ask once more before the final step
  const [confirmWinner, setConfirmWinner] = useState<Proposal | null>(null);

  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editTin, setEditTin] = useState('');
  const [editActivity, setEditActivity] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const setActiveTab = (t: Tab) => {
    setActiveTabState(t);
    setActionMsg(null);
    window.history.replaceState(null, '', `/dashboard?tab=${t}`);
  };

  // Fill the profile form once the user has loaded (it is empty on a page reload otherwise)
  useEffect(() => {
    setEditFirstName(user?.firstName || '');
    setEditLastName(user?.lastName || '');
    setEditPhone(user?.phone || '');
    setEditCompanyName(profile?.companyName || '');
    setEditTin(profile?.taxIdentificationNumber || '');
    setEditActivity(profile?.businessActivity || '');
  }, [user, profile]);

  const loadData = async () => {
    setLoading(true);
    try {
      const get = (url: string) => fetch(url, { headers: authHeaders });
      const [landsRes, sentRes, recRes, favsRes, notifsRes] = await Promise.all([
        get('/api/my/lands'),
        get('/api/proposals/sent'),
        get('/api/proposals/received'),
        get('/api/favorites'),
        get('/api/notifications'),
      ]);
      if (landsRes.ok) setLands(await landsRes.json());
      if (sentRes.ok) setSent(await sentRes.json());
      if (recRes.ok) setReceived(await recRes.json());
      if (favsRes.ok) setFavorites(await favsRes.json());
      if (notifsRes.ok) setNotifications(await notifsRes.json());
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login?next=%2Fdashboard'); return; }
    if (user.role === 'ADMIN') { navigate('/admin'); return; }
    loadData();
  }, [user, authLoading]);

  // Winner dialog: close with Escape
  useEffect(() => {
    if (!confirmWinner) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirmWinner(null); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [confirmWinner?.id]);

  const run = async (key: string, req: () => Promise<Response>, okText: string, failText: string) => {
    setBusy(key);
    setActionMsg(null);
    try {
      const res = await req();
      if (!res.ok) { setActionMsg({ ok: false, text: await apiError(res, failText) }); return false; }
      setActionMsg({ ok: true, text: okText });
      await loadData();
      return true;
    } catch {
      setActionMsg({ ok: false, text: 'İnternet bağlantısında problem yarandı. Yenidən cəhd edin.' });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const sendMoreDocuments = async (landId: string) => {
    if (uploadFiles.length === 0) { setActionMsg({ ok: false, text: 'Ən azı bir sənəd şəkli (JPG və ya PNG) seçin.' }); return; }
    const form = new FormData();
    uploadFiles.forEach(f => form.append('documents', f, f.name));
    if (uploadNote.trim()) form.append('message', uploadNote.trim());
    const ok = await run(
      `docs-${landId}`,
      () => fetch(`/api/my/lands/${landId}/documents`, { method: 'POST', headers: authHeaders, body: form }),
      'Sənədlər göndərildi. Sahəniz yenidən yoxlanılacaq.',
      'Sənədləri göndərmək alınmadı.',
    );
    if (ok) { setUploadFor(null); setUploadFiles([]); setUploadNote(''); }
  };

  const closeListing = (oppId: string) =>
    run(`close-${oppId}`, () => fetch(`/api/opportunities/${oppId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ status: 'CLOSED' }),
    }), 'Elan bağlandı. Yeni təklif qəbul edilmir.', 'Elanı bağlamaq alınmadı.');

  const reopenListing = (landId: string) =>
    run(`reopen-${landId}`, () => fetch(`/api/my/lands/${landId}/reopen`, { method: 'POST', headers: authHeaders }),
      'Yeni elan dərc olundu. İnvestorlar yenidən təklif göndərə bilər.', 'Elanı dərc etmək alınmadı.');

  const selectWinner = async (p: Proposal) => {
    const ok = await run(`win-${p.id}`, () => fetch(`/api/opportunities/${p.opportunityId}/select-winner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ proposalId: p.id }),
    }), 'Qalib seçildi. Elan bağlandı, digər investorlara bildiriş göndərildi.', 'Qalibi seçmək alınmadı.');
    if (ok) setConfirmWinner(null);
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    const res = await updateProfile({
      firstName: editFirstName,
      lastName: editLastName,
      phone: editPhone,
      companyName: editCompanyName,
      taxIdentificationNumber: editTin,
      businessActivity: editActivity,
    });
    setProfileMsg(res.success ? { ok: true, text: 'Məlumatlarınız yadda saxlanıldı.' } : { ok: false, text: res.error || 'Yadda saxlamaq alınmadı.' });
  };

  const removeFavorite = async (landId: string) => {
    await toggleFavorite(landId);
    setFavorites(prev => prev.filter(f => f.landId !== landId));
  };

  const docsRequested = lands.filter(l => l.land.status === 'DOCUMENTS_REQUESTED');
  const openReceived = received.filter(p => p.status === 'OPEN').length;
  const unread = notifications.filter(n => !n.isRead).length;

  const TABS: { id: Tab; label: string; Icon: React.FC<any>; count?: number; dot?: boolean }[] = [
    { id: 'lands', label: 'Torpaqlarım', Icon: MapPin, count: lands.length, dot: docsRequested.length > 0 },
    { id: 'sent', label: 'Göndərdiyim təkliflər', Icon: Send, count: sent.length },
    { id: 'received', label: 'Aldığım təkliflər', Icon: Inbox, count: received.length, dot: openReceived > 0 },
    { id: 'favorites', label: 'Yadda saxladıqlarım', Icon: Heart, count: favorites.length },
    { id: 'notifications', label: 'Bildirişlər', Icon: Bell, count: unread || undefined, dot: unread > 0 },
    { id: 'profile', label: 'Məlumatlarım', Icon: User },
  ];

  // Received proposals grouped by listing, so the owner compares investors side by side
  const receivedGroups = received.reduce<{ key: string; title: string; items: Proposal[] }[]>((acc, p) => {
    const g = acc.find(x => x.key === p.opportunityId);
    if (g) g.items.push(p);
    else acc.push({ key: p.opportunityId, title: p.land?.title || p.opportunity?.title || 'Elan', items: [p] });
    return acc;
  }, []);

  if (authLoading || !user) {
    return <div className="max-w-7xl mx-auto px-4 py-16 text-lg" role="status">Yüklənir…</div>;
  }

  return (
    <div className="bg-cream py-8 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-base font-bold text-brand-700">Şəxsi kabinet</p>
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl leading-tight text-brand-900">
              Xoş gördük, {user.firstName}!
            </h1>
            {profile?.companyName && <p className="text-lg text-[#3E4F45] mt-1">{profile.companyName}</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => navigate('/lands/new')} className={outlineBtn}>
              <Plus className="w-5 h-5" aria-hidden="true" />
              Torpaq əlavə et
            </button>
            <button type="button" onClick={() => navigate('/opportunities')} className={primaryBtn}>
              <Search className="w-5 h-5" aria-hidden="true" />
              İnvestisiya imkanları
            </button>
          </div>
        </div>

        {/* What needs doing: shown first, in red */}
        {docsRequested.length > 0 && (
          <div role="alert" className="mb-6 p-5 rounded-2xl bg-[#FCEBE8] border-2 border-[#C0392B] flex flex-col sm:flex-row sm:items-center gap-4">
            <AlertTriangle className="w-8 h-8 text-[#C0392B] shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-display font-extrabold text-xl text-[#7A1F14]">Əlavə sənəd lazımdır</p>
              <p className="text-base text-[#7A1F14]">
                İnzibatçı {docsRequested.length === 1 ? 'bir sahəniz' : `${docsRequested.length} sahəniz`} üçün əlavə sənəd istəyir.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setActiveTab('lands'); setUploadFor(docsRequested[0].land.id); }}
              className="min-h-14 px-6 rounded-xl bg-[#C0392B] hover:bg-[#A93226] text-white font-display font-bold flex items-center justify-center gap-2"
            >
              Sənəd yükləyin
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Big tabs */}
        <div role="tablist" aria-label="Kabinet bölmələri" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-6">
          {TABS.map(t => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={active}
                aria-controls={`panel-${t.id}`}
                onClick={() => setActiveTab(t.id)}
                className={`min-h-16 px-4 rounded-2xl border-2 font-display font-bold text-base flex items-center justify-center gap-2 text-center ${
                  active ? 'bg-brand-900 border-brand-900 text-white' : 'bg-white border-line text-brand-900 hover:border-brand-900'
                }`}
              >
                <t.Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>{t.label}</span>
                {t.count !== undefined && (
                  <span className={`min-w-7 h-7 px-2 rounded-full text-sm flex items-center justify-center ${t.dot ? 'bg-[#C0392B] text-white' : active ? 'bg-white/20' : 'bg-sand'}`}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {actionMsg && (
          <div role="status" className={`mb-5 p-4 rounded-xl border-2 text-lg flex gap-2 ${actionMsg.ok ? 'bg-brand-50 border-brand-700 text-brand-900' : 'bg-[#FCEBE8] border-[#C0392B] text-[#7A1F14]'}`}>
            {actionMsg.ok ? <Check className="w-6 h-6 shrink-0" aria-hidden="true" /> : <AlertTriangle className="w-6 h-6 shrink-0" aria-hidden="true" />}
            {actionMsg.text}
          </div>
        )}

        <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
          {loading && <p className="text-lg" role="status">Yüklənir…</p>}

          {/* MY LANDS */}
          {!loading && activeTab === 'lands' && (
            lands.length === 0 ? (
              <Empty
                title="Hələ torpaq əlavə etməmisiniz"
                text="Torpağınız varsa, onu yerləşdirin — inzibatçı sənədi yoxlayandan sonra investorlar sizə təklif göndərə biləcək."
                action={<button type="button" onClick={() => navigate('/lands/new')} className={primaryBtn}><Plus className="w-5 h-5" aria-hidden="true" />Torpaq əlavə et</button>}
              />
            ) : (
              <ul className="flex flex-col gap-5">
                {lands.map(item => {
                  const { land, opportunity } = item;
                  const info = landStatusInfo(land.status);
                  const needsDocs = land.status === 'DOCUMENTS_REQUESTED';
                  const oppOpen = opportunity?.status === 'ACTIVE';
                  return (
                    <li key={land.id} className={`bg-white rounded-3xl border-2 p-5 sm:p-6 ${needsDocs ? 'border-[#C0392B]' : 'border-line'}`}>
                      <div className="flex flex-col sm:flex-row gap-5">
                        <img src={landImage(land)} alt="" className="w-full sm:w-40 h-32 object-cover rounded-2xl" />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-base text-muted">{land.region} · {land.agricultureType} · {land.areaHectares} ha</p>
                              <h2 className="font-display font-extrabold text-xl leading-snug text-brand-900 mt-1">{land.title}</h2>
                              {item.submittedAt && <p className="text-base text-muted">Göndərilib: {formatDateAz(item.submittedAt)}</p>}
                            </div>
                            <span className={`font-display font-extrabold text-base px-4 py-2 rounded-full ${info.badge}`}>{info.label}</span>
                          </div>
                          <p className="mt-3 text-lg">{info.explain}</p>
                          {item.reviewNote && (land.status !== 'APPROVED') && (
                            <p className="mt-3 text-lg bg-cream p-4 rounded-xl border border-line">
                              <strong>İnzibatçının qeydi:</strong> {item.reviewNote}
                            </p>
                          )}
                          {land.status === 'APPROVED' && opportunity && (
                            <p className="mt-3 text-lg">
                              Elan: <strong>{oppOpen ? 'təklif qəbul edilir' : opportunity.winnerProposalId ? 'qalib seçilib, bağlıdır' : 'bağlıdır'}</strong>
                              {' · '}Təkliflər: <strong>{opportunity.proposalCount}</strong>
                            </p>
                          )}
                          <p className="mt-2 text-base text-muted flex items-center gap-1.5">
                            <ImageIcon className="w-4 h-4" aria-hidden="true" />
                            Yüklənmiş sənəd: {item.documents.length}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-3">
                            {land.status === 'APPROVED' && (
                              <button type="button" onClick={() => navigate(`/opportunities/${land.id}`)} className={primaryBtn}>
                                Elana baxın
                                <ArrowRight className="w-5 h-5" aria-hidden="true" />
                              </button>
                            )}
                            {land.status === 'APPROVED' && opportunity && opportunity.proposalCount > 0 && (
                              <button type="button" onClick={() => setActiveTab('received')} className={outlineBtn}>
                                <Inbox className="w-5 h-5" aria-hidden="true" />
                                Təkliflərə baxın
                              </button>
                            )}
                            {oppOpen && opportunity && (
                              <button type="button" disabled={busy !== null} onClick={() => closeListing(opportunity.id)} className={outlineBtn}>
                                <X className="w-5 h-5" aria-hidden="true" />
                                {busy === `close-${opportunity.id}` ? 'Bağlanır…' : 'Elanı bağla'}
                              </button>
                            )}
                            {land.status === 'APPROVED' && !oppOpen && (
                              <button type="button" disabled={busy !== null} onClick={() => reopenListing(land.id)} className={outlineBtn}>
                                <Plus className="w-5 h-5" aria-hidden="true" />
                                {busy === `reopen-${land.id}` ? 'Dərc olunur…' : 'Yeni elan dərc et'}
                              </button>
                            )}
                            {(needsDocs || land.status === 'PENDING_REVIEW') && uploadFor !== land.id && (
                              <button
                                type="button"
                                onClick={() => { setUploadFor(land.id); setUploadFiles([]); setUploadNote(''); }}
                                className={needsDocs ? 'min-h-14 px-6 rounded-xl bg-[#C0392B] hover:bg-[#A93226] text-white font-display font-bold flex items-center gap-2' : outlineBtn}
                              >
                                <Upload className="w-5 h-5" aria-hidden="true" />
                                Sənəd əlavə et
                              </button>
                            )}
                          </div>

                          {uploadFor === land.id && (
                            <div className="mt-5 p-5 rounded-2xl border-2 border-brand-700 bg-cream flex flex-col gap-4">
                              <p className="font-display font-extrabold text-lg text-brand-900">Əlavə sənəd göndərin</p>
                              <div>
                                <label htmlFor={`docs-${land.id}`} className="block font-bold mb-1.5">Sənəd şəkilləri (JPG və ya PNG, hər biri ən çox 10 MB)</label>
                                <input
                                  id={`docs-${land.id}`}
                                  type="file"
                                  multiple
                                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                                  onChange={e => setUploadFiles(Array.from(e.target.files ?? []))}
                                  className="block w-full text-lg file:mr-4 file:min-h-12 file:px-5 file:rounded-xl file:border-0 file:bg-brand-700 file:text-white file:font-bold"
                                />
                                {uploadFiles.length > 0 && <p className="text-base text-muted mt-1">Seçildi: {uploadFiles.map(f => f.name).join(', ')}</p>}
                              </div>
                              <div>
                                <label htmlFor={`note-${land.id}`} className="block font-bold mb-1.5">İnzibatçıya qeyd <span className="font-normal text-muted">(istəyə görə)</span></label>
                                <textarea id={`note-${land.id}`} rows={3} value={uploadNote} onChange={e => setUploadNote(e.target.value)} className={`${fieldClass} py-3`} />
                              </div>
                              <div className="flex flex-wrap gap-3">
                                <button type="button" disabled={busy !== null} onClick={() => sendMoreDocuments(land.id)} className={primaryBtn}>
                                  <Send className="w-5 h-5" aria-hidden="true" />
                                  {busy === `docs-${land.id}` ? 'Göndərilir…' : 'Göndər'}
                                </button>
                                <button type="button" onClick={() => setUploadFor(null)} className={outlineBtn}>Ləğv et</button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          )}

          {/* SENT PROPOSALS (as an investor) */}
          {!loading && activeTab === 'sent' && (
            sent.length === 0 ? (
              <Empty
                title="Hələ təklif göndərməmisiniz"
                text="Bəyəndiyiniz sahəni seçin və “Təklif göndərin” düyməsini basın."
                action={<button type="button" onClick={() => navigate('/opportunities')} className={primaryBtn}>İnvestisiya imkanlarına baxın</button>}
              />
            ) : (
              <ul className="flex flex-col gap-5">
                {sent.map(p => {
                  const info = statusInfo(p);
                  return (
                    <li key={p.id} className={`bg-white rounded-3xl border-2 p-5 sm:p-6 ${p.status === 'SELECTED' ? 'border-brand-700' : 'border-line'}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base text-muted">
                            № <span className="font-bold text-ink">{p.referenceNumber}</span> · {formatDateAz(p.submittedAt)}
                          </p>
                          <h2 className="font-display font-extrabold text-xl leading-snug text-brand-900 mt-1">{p.land?.title || p.opportunity?.title}</h2>
                          {p.land?.region && <p className="text-base text-[#3E4F45]">{p.land.region}</p>}
                        </div>
                        <span className={`font-display font-extrabold text-base px-4 py-2 rounded-full ${info.badge}`}>{info.label}</span>
                      </div>
                      <div className="mt-5"><StatusSteps proposal={p} /></div>
                      <p className="mt-4 text-lg">{info.explain}</p>
                      <dl className="mt-4 grid sm:grid-cols-3 gap-3">
                        <div className="p-4 rounded-xl border border-line">
                          <dt className="text-base text-muted">Təklif etdiyiniz məbləğ</dt>
                          <dd className="font-extrabold text-xl">{formatManat(p.proposedInvestmentAmount)}</dd>
                        </div>
                        <div className="p-4 rounded-xl border border-line">
                          <dt className="text-base text-muted">İcra müddəti</dt>
                          <dd className="font-extrabold text-xl">{p.estimatedImplementationPeriod || '—'}</dd>
                        </div>
                        <div className="p-4 rounded-xl border border-line">
                          <dt className="text-base text-muted">Elan sahibinin telefonu</dt>
                          <dd className="font-extrabold text-xl whitespace-nowrap">{p.opportunity?.contactPhone || '—'}</dd>
                        </div>
                      </dl>
                      <DocumentLinks docs={p.documents} title="Göndərdiyiniz sənədlər" />
                      <div className="mt-5">
                        <button type="button" onClick={() => navigate(`/opportunities/${p.land?.id ?? ''}`)} className={outlineBtn}>
                          Elana baxın
                          <ArrowRight className="w-5 h-5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          )}

          {/* RECEIVED PROPOSALS (as a land owner) */}
          {!loading && activeTab === 'received' && (
            received.length === 0 ? (
              <Empty
                title="Hələ təklif gəlməyib"
                text="Sahəniz dərc olunandan sonra investorların təklifləri burada görünəcək."
              />
            ) : (
              <div className="flex flex-col gap-8">
                {receivedGroups.map(group => {
                  const opp = group.items[0].opportunity;
                  const winner = group.items.find(p => p.status === 'SELECTED');
                  return (
                    <section key={group.key} aria-labelledby={`grp-${group.key}`}>
                      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
                        <div>
                          <h2 id={`grp-${group.key}`} className="font-display font-extrabold text-2xl text-brand-900">{group.title}</h2>
                          <p className="text-lg text-[#3E4F45]">
                            {group.items.length} təklif ·{' '}
                            {winner ? 'qalib seçilib' : opp?.status === 'ACTIVE' ? 'elan açıqdır' : 'elan bağlıdır'}
                          </p>
                        </div>
                      </div>
                      <ul className="flex flex-col gap-4">
                        {group.items.map(p => {
                          const info = statusInfo(p);
                          return (
                            <li key={p.id} className={`bg-white rounded-3xl border-2 p-5 sm:p-6 ${p.status === 'SELECTED' ? 'border-brand-700' : 'border-line'}`}>
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-base text-muted">№ <span className="font-bold text-ink">{p.referenceNumber}</span> · {formatDateAz(p.submittedAt)}</p>
                                  <h3 className="font-display font-extrabold text-xl text-brand-900 mt-1">
                                    {p.user ? `${p.user.firstName} ${p.user.lastName}` : 'İnvestor'}
                                  </h3>
                                  {p.user?.email && <p className="text-base text-[#3E4F45] break-all">{p.user.email}</p>}
                                </div>
                                <span className={`font-display font-extrabold text-base px-4 py-2 rounded-full ${p.status === 'OPEN' ? 'bg-gold-100 text-gold-900' : info.badge}`}>
                                  {p.status === 'OPEN' ? 'Qərar gözləyir' : info.label}
                                </span>
                              </div>
                              <dl className="mt-4 grid sm:grid-cols-3 gap-3">
                                <div className="p-4 rounded-xl border border-line">
                                  <dt className="text-base text-muted">Təklif olunan məbləğ</dt>
                                  <dd className="font-extrabold text-xl">{formatManat(p.proposedInvestmentAmount)}</dd>
                                </div>
                                <div className="p-4 rounded-xl border border-line">
                                  <dt className="text-base text-muted">İcra müddəti</dt>
                                  <dd className="font-extrabold text-xl">{p.estimatedImplementationPeriod || '—'}</dd>
                                </div>
                                <div className="p-4 rounded-xl border border-line">
                                  <dt className="text-base text-muted">İnvestorun telefonu</dt>
                                  <dd className="font-extrabold text-xl whitespace-nowrap">{p.contactPhone || '—'}</dd>
                                </div>
                              </dl>
                              {p.businessPlanSummary && (
                                <div className="mt-4">
                                  <h4 className="font-bold text-base mb-1">Biznes planın qısa təsviri</h4>
                                  <p className="text-lg whitespace-pre-line">{p.businessPlanSummary}</p>
                                </div>
                              )}
                              <DocumentLinks docs={p.documents} title="İnvestorun sənədləri" />
                              {p.canSelectWinner && (
                                <div className="mt-5">
                                  <button type="button" disabled={busy !== null} onClick={() => setConfirmWinner(p)} className={primaryBtn}>
                                    <Trophy className="w-5 h-5" aria-hidden="true" />
                                    Bu investoru qalib seç
                                  </button>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>
            )
          )}

          {/* FAVORITES */}
          {!loading && activeTab === 'favorites' && (
            favorites.length === 0 ? (
              <Empty title="Yadda saxlanmış sahə yoxdur" text="Sahələrin üzərindəki “Yadda saxla” düyməsini basın — burada görünəcək." />
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {favorites.map(fav => fav.land && (
                  <li key={fav.id} className="bg-white rounded-3xl overflow-hidden border border-line flex flex-col">
                    <img src={landImage(fav.land)} alt="" className="w-full h-44 object-cover" />
                    <div className="p-5 flex flex-col gap-3 flex-1">
                      <p className="text-base text-[#3E4F45]">{fav.land.region} · {fav.land.agricultureType}</p>
                      <h2 className="font-display font-extrabold text-xl leading-snug text-brand-900">{fav.land.title}</h2>
                      <p className="text-lg"><strong>{fav.land.areaHectares} ha</strong> · {formatManat(fav.land.estimatedInvestmentRequirement)}</p>
                      <div className="mt-auto flex flex-col sm:flex-row gap-2.5 pt-2">
                        <button type="button" onClick={() => navigate(`/opportunities/${fav.landId}`)} className={`flex-1 ${primaryBtn}`}>
                          Ətraflı baxın
                          <ArrowRight className="w-5 h-5" aria-hidden="true" />
                        </button>
                        <button type="button" onClick={() => removeFavorite(fav.landId)} className="min-h-14 px-4 rounded-xl border-2 border-line font-display font-bold text-ink hover:border-[#8E2A1F] hover:text-[#8E2A1F] flex items-center justify-center gap-2">
                          <X className="w-5 h-5" aria-hidden="true" />
                          Siyahıdan çıxar
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )
          )}

          {/* NOTIFICATIONS */}
          {!loading && activeTab === 'notifications' && (
            <div className="bg-white rounded-3xl border border-line overflow-hidden">
              {notifications.length === 0 ? (
                <p className="p-10 text-center text-lg text-muted">Bildiriş yoxdur.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {notifications.map(n => (
                    <li key={n.id} className={`p-5 sm:px-6 ${n.isRead ? '' : 'bg-gold-100/50'}`}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-bold text-lg">
                          {!n.isRead && <span className="inline-block w-3 h-3 rounded-full bg-[#C0392B] mr-2" aria-label="Yeni" />}
                          {n.title}
                        </p>
                        <span className="text-base text-muted">{formatDateAz(n.createdAt)}</span>
                      </div>
                      <p className="text-lg text-[#3E4F45] mt-1">{n.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* PROFILE */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-3xl border border-line p-5 sm:p-8 max-w-3xl">
              <h2 className="font-display font-extrabold text-2xl text-brand-900">Məlumatlarım</h2>
              <p className="text-lg text-muted mt-1 mb-6">Bu məlumatlar formalara avtomatik yazılır.</p>
              {profileMsg && (
                <div role="status" className={`mb-6 p-4 rounded-xl border-2 text-base flex gap-2 ${profileMsg.ok ? 'bg-brand-50 border-brand-700 text-brand-900' : 'bg-[#FCEBE8] border-[#C0392B] text-[#7A1F14]'}`}>
                  {profileMsg.ok && <Check className="w-6 h-6 shrink-0" aria-hidden="true" />}
                  {profileMsg.text}
                </div>
              )}
              <form onSubmit={handleProfileSave} className="flex flex-col gap-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="p-first" className="font-bold">Ad</label>
                    <input id="p-first" type="text" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} className={fieldClass} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="p-last" className="font-bold">Soyad</label>
                    <input id="p-last" type="text" value={editLastName} onChange={e => setEditLastName(e.target.value)} className={fieldClass} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="p-phone" className="font-bold">Telefon</label>
                  <input id="p-phone" type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+994 50 123 45 67" className={fieldClass} />
                </div>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="p-company" className="font-bold">Şirkət və ya təsərrüfat <span className="font-normal text-muted">(istəyə görə)</span></label>
                    <input id="p-company" type="text" value={editCompanyName} onChange={e => setEditCompanyName(e.target.value)} className={fieldClass} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="p-tin" className="font-bold">VÖEN <span className="font-normal text-muted">(istəyə görə)</span></label>
                    <input id="p-tin" type="text" inputMode="numeric" value={editTin} onChange={e => setEditTin(e.target.value)} className={fieldClass} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="p-activity" className="font-bold">Nə ilə məşğulsunuz? <span className="font-normal text-muted">(istəyə görə)</span></label>
                  <textarea id="p-activity" rows={3} value={editActivity} onChange={e => setEditActivity(e.target.value)} className={`${fieldClass} py-3`} />
                </div>
                <button type="submit" className="min-h-14 px-8 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-display font-extrabold text-lg sm:self-start">
                  Yadda saxla
                </button>
              </form>
            </div>
          )}
        </div>

        <p className="mt-10 text-lg text-center">
          Sualınız var? Zəng edin: <strong className="text-brand-900 whitespace-nowrap"><Phone className="inline w-5 h-5" aria-hidden="true" /> {HELP_LINE}</strong>
        </p>

        {/* WINNER CONFIRMATION */}
        {confirmWinner && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setConfirmWinner(null)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="win-title"
              className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <Trophy className="w-12 h-12 text-gold-900" aria-hidden="true" />
              <h2 id="win-title" className="font-display font-extrabold text-2xl text-brand-900 mt-3">Qalibi təsdiq edin</h2>
              <p className="text-lg mt-3">
                <strong>{confirmWinner.user ? `${confirmWinner.user.firstName} ${confirmWinner.user.lastName}` : 'Bu investor'}</strong>{' '}
                ({formatManat(confirmWinner.proposedInvestmentAmount)}) qalib seçiləcək.
              </p>
              <p className="text-lg mt-2 text-[#3E4F45]">
                Elan bağlanacaq, yeni təklif qəbul edilməyəcək və digər investorlara “Seçilmədi” bildirişi göndəriləcək. Bunu geri qaytarmaq olmaz.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button type="button" autoFocus disabled={busy !== null} onClick={() => selectWinner(confirmWinner)} className={`flex-1 ${primaryBtn}`}>
                  <Check className="w-5 h-5" aria-hidden="true" />
                  {busy === `win-${confirmWinner.id}` ? 'Seçilir…' : 'Bəli, qalib seç'}
                </button>
                <button type="button" onClick={() => setConfirmWinner(null)} className={`flex-1 ${outlineBtn}`}>Ləğv et</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
