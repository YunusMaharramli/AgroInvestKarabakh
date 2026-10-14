import React, { useState, useEffect } from 'react';
import { AgriculturalLand, AnalyticsSummary, IntegrationLog, InvestmentOpportunity, LandReview, Proposal } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { statusInfo, landStatusInfo, apiError } from '../lib/applicationStatus.js';
import { formatManat, formatDateAz } from '../lib/landImages.js';
import {
  Shield,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Database,
  ArrowRight,
  Trophy,
  Check,
  MapPin,
  Phone,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

interface AdminDashboardPageProps {
  navigate: (route: string) => void;
}

type AdminTab = 'reviews' | 'proposals' | 'opportunities' | 'lands' | 'analytics' | 'ektis';
const ADMIN_TABS: AdminTab[] = ['reviews', 'proposals', 'opportunities', 'lands', 'analytics', 'ektis'];

function initialAdminTab(): AdminTab {
  const t = new URLSearchParams(window.location.search).get('tab') as AdminTab | null;
  return t && ADMIN_TABS.includes(t) ? t : 'reviews';
}

const primaryBtn = 'min-h-12 px-5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-display font-bold flex items-center justify-center gap-2 disabled:opacity-50';
const outlineBtn = 'min-h-12 px-4 rounded-xl border-2 border-brand-900 text-brand-900 font-display font-bold flex items-center justify-center gap-2 hover:bg-cream disabled:opacity-50';
const dangerBtn = 'min-h-12 px-5 rounded-xl bg-[#8E2A1F] hover:bg-[#7A1F14] text-white font-display font-bold flex items-center justify-center gap-2 disabled:opacity-50';

function opportunityLabel(o: InvestmentOpportunity): { text: string; cls: string } {
  if (o.status === 'ACTIVE') return { text: 'Təklif qəbul edilir', cls: 'bg-brand-100 text-brand-700' };
  if (o.status === 'DRAFT') return { text: 'Yoxlamadadır', cls: 'bg-gold-100 text-gold-900' };
  return { text: o.winnerProposalId ? 'Qalib seçilib' : 'Bağlanıb', cls: 'bg-sand text-[#3E4F45]' };
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ navigate }) => {
  const { user, token, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTabState] = useState<AdminTab>(initialAdminTab);

  const [reviews, setReviews] = useState<LandReview[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [opportunities, setOpportunities] = useState<InvestmentOpportunity[]>([]);
  const [lands, setLands] = useState<AgriculturalLand[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [ektisLogs, setEktisLogs] = useState<IntegrationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Land review dialog
  const [reviewLand, setReviewLand] = useState<LandReview | null>(null);
  const [reviewMode, setReviewMode] = useState<'none' | 'request' | 'reject'>('none');
  const [reviewText, setReviewText] = useState('');
  const [reviewError, setReviewError] = useState('');

  // Proposal dialog
  const [viewProposal, setViewProposal] = useState<Proposal | null>(null);
  const [confirmWinner, setConfirmWinner] = useState(false);

  // EKTIS sync state
  const [syncingEktis, setSyncingEktis] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const jsonHeaders = { 'Content-Type': 'application/json', ...authHeaders };

  const setActiveTab = (t: AdminTab) => {
    setActiveTabState(t);
    setMessage(null);
    window.history.replaceState(null, '', `/admin?tab=${t}`);
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const get = (url: string) => fetch(url, { headers: authHeaders });
      const [revRes, propRes, oppRes, landsRes, analRes, ektisRes] = await Promise.all([
        get('/api/admin/land-reviews'),
        get('/api/admin/proposals'),
        get('/api/opportunities?status=all'),
        get('/api/lands'),
        get('/api/admin/analytics'),
        get('/api/admin/integrations/ektis/logs'),
      ]);
      if (revRes.ok) setReviews(await revRes.json());
      if (propRes.ok) setProposals(await propRes.json());
      if (oppRes.ok) setOpportunities(await oppRes.json());
      if (landsRes.ok) setLands(await landsRes.json());
      if (analRes.ok) setAnalytics(await analRes.json());
      if (ektisRes.ok) setEktisLogs(await ektisRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Wait for the saved login to be checked, otherwise a reload sends the admin to the login page
    if (authLoading) return;
    if (!user) { navigate('/login?next=%2Fadmin'); return; }
    if (user.role !== 'ADMIN') { navigate('/dashboard'); return; }
    fetchAdminData();
  }, [user, authLoading]);

  // Close dialogs with Escape
  useEffect(() => {
    if (!reviewLand && !viewProposal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setReviewLand(null);
      setViewProposal(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [reviewLand?.land.id, viewProposal?.id]);

  const openReview = (r: LandReview) => {
    setReviewLand(r);
    setReviewMode('none');
    setReviewText('');
    setReviewError('');
  };

  const submitReview = async (action: 'approve' | 'request-documents' | 'reject') => {
    if (!reviewLand) return;
    if (action !== 'approve' && !reviewText.trim()) {
      setReviewError(action === 'reject' ? 'Rədd etmə səbəbini yazın.' : 'Hansı sənədin lazım olduğunu yazın.');
      return;
    }
    setBusy(action);
    setReviewError('');
    try {
      const res = await fetch(`/api/admin/land-reviews/${reviewLand.land.id}/${action}`, {
        method: 'POST',
        headers: jsonHeaders,
        body: action === 'approve' ? undefined : JSON.stringify({ message: reviewText.trim() }),
      });
      if (!res.ok) { setReviewError(await apiError(res, 'Əməliyyat alınmadı.')); return; }
      const texts = {
        approve: 'Torpaq təsdiq edildi və “İnvestisiya imkanları” siyahısında dərc olundu.',
        'request-documents': 'Sahibə əlavə sənəd tələbi göndərildi.',
        reject: 'Müraciət rədd edildi, sahibə bildiriş göndərildi.',
      } as const;
      setMessage({ ok: true, text: texts[action] });
      setReviewLand(null);
      fetchAdminData();
    } catch {
      setReviewError('Şəbəkə xətası.');
    } finally {
      setBusy(null);
    }
  };

  const setOpportunityStatus = async (o: InvestmentOpportunity, status: 'ACTIVE' | 'CLOSED') => {
    setBusy(`opp-${o.id}`);
    setMessage(null);
    try {
      const res = await fetch(`/api/opportunities/${o.id}/status`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ status }) });
      setMessage(res.ok
        ? { ok: true, text: status === 'CLOSED' ? 'Elan bağlandı.' : 'Elan yenidən açıldı.' }
        : { ok: false, text: await apiError(res, 'Statusu dəyişmək alınmadı.') });
      if (res.ok) fetchAdminData();
    } finally {
      setBusy(null);
    }
  };

  const selectWinner = async (p: Proposal) => {
    setBusy(`win-${p.id}`);
    try {
      const res = await fetch(`/api/opportunities/${p.opportunityId}/select-winner`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ proposalId: p.id }),
      });
      if (!res.ok) {
        setMessage({ ok: false, text: await apiError(res, 'Qalibi seçmək alınmadı.') });
      } else {
        setMessage({ ok: true, text: 'Qalib seçildi. Elan bağlandı, digər investorlara bildiriş göndərildi.' });
        fetchAdminData();
      }
      setViewProposal(null);
      setConfirmWinner(false);
    } finally {
      setBusy(null);
    }
  };

  const handleTriggerEktisSync = async () => {
    setSyncingEktis(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/admin/integrations/ektis/sync', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          syncType: 'CADASTRAL_DATA_SYNC',
          targetRegions: ['Ağdam', 'Füzuli', 'Zəngilan', 'Cəbrayıl'],
        }),
      });
      setSyncResult(await res.json());
      fetchAdminData();
    } catch (e) {
      console.error(e);
    } finally {
      setSyncingEktis(false);
    }
  };

  const COLORS = ['#1F6B3C', '#B7791F', '#2B6CB0', '#8E2A1F', '#6B46C1', '#46564C'];
  const pendingCount = reviews.filter(r => r.land.status === 'PENDING_REVIEW').length;

  return (
    <div className="min-h-screen bg-cream py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-base font-bold text-gold-900 flex items-center gap-2">
              <Shield className="w-5 h-5" aria-hidden="true" />
              İnzibatçı paneli
            </p>
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl leading-tight text-brand-900 mt-1">
              Torpaqlar və investisiya təklifləri
            </h1>
            <p className="text-lg text-[#3E4F45] mt-1">
              Torpaq sahiblərinin müraciətlərini yoxlayın, elanları və investor təkliflərini izləyin.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchAdminData}
            className="min-h-14 px-5 rounded-xl border-2 border-brand-900 text-brand-900 font-display font-bold flex items-center gap-2 hover:bg-white"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Yenilə
          </button>
        </div>

        {/* Summary: what needs attention */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Yoxlama gözləyən torpaq', value: pendingCount, cls: 'text-[#A93226]' },
            { label: 'Sahibdən sənəd gözlənilir', value: reviews.filter(r => r.land.status === 'DOCUMENTS_REQUESTED').length, cls: 'text-gold-900' },
            { label: 'Təklif qəbul edən elan', value: opportunities.filter(o => o.status === 'ACTIVE').length, cls: 'text-brand-900' },
            { label: 'Qərar gözləyən təklif', value: proposals.filter(p => p.status === 'OPEN').length, cls: 'text-ink' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl border border-line p-4">
              <p className="text-base text-muted leading-snug">{c.label}</p>
              <p className={`font-display font-extrabold text-3xl mt-1 ${c.cls}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Navigation Tabs */}
        <div role="tablist" aria-label="Panel bölmələri" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
          {([
            ['reviews', `Yoxlama növbəsi (${reviews.length})`],
            ['proposals', `Təkliflər (${proposals.length})`],
            ['opportunities', `Elanlar (${opportunities.length})`],
            ['lands', `Torpaq sahələri (${lands.length})`],
            ['analytics', 'Statistika'],
            ['ektis', 'EKTİS (sınaq)'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={`min-h-14 px-4 rounded-2xl border-2 font-display font-bold text-base ${
                activeTab === id ? 'bg-brand-900 border-brand-900 text-white' : 'bg-white border-line text-brand-900 hover:border-brand-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {message && (
          <div role="status" className={`mb-5 p-4 rounded-xl border-2 text-lg flex gap-2 ${message.ok ? 'bg-brand-50 border-brand-700 text-brand-900' : 'bg-[#FCEBE8] border-[#C0392B] text-[#7A1F14]'}`}>
            {message.ok ? <Check className="w-6 h-6 shrink-0" aria-hidden="true" /> : <AlertTriangle className="w-6 h-6 shrink-0" aria-hidden="true" />}
            {message.text}
          </div>
        )}

        {/* TAB: LAND REVIEW QUEUE */}
        {activeTab === 'reviews' && (
          reviews.length === 0 ? (
            <div className="bg-white rounded-2xl border border-line p-10 text-center">
              <CheckCircle className="w-12 h-12 text-brand-700 mx-auto" aria-hidden="true" />
              <p className="font-display font-extrabold text-2xl text-brand-900 mt-3">Yoxlanacaq müraciət yoxdur</p>
              <p className="text-lg text-muted mt-1">Torpaq sahibləri yeni sahə göndərəndə burada görünəcək.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {reviews.map(r => {
                const info = landStatusInfo(r.land.status);
                return (
                  <li key={r.land.id} className="bg-white rounded-2xl border border-line p-5 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`font-bold text-sm px-3 py-1 rounded-full ${info.badge}`}>{info.label}</span>
                        {r.submittedAt && <span className="text-muted">Göndərilib: {formatDateAz(r.submittedAt)}</span>}
                      </div>
                      <h3 className="font-display font-extrabold text-xl text-brand-900 mt-2">{r.land.title}</h3>
                      <p className="text-base text-[#3E4F45]">
                        {r.land.region} · {r.land.agricultureType} · {r.land.areaHectares} ha · {formatManat(r.land.estimatedInvestmentRequirement)}
                      </p>
                      <p className="text-base text-muted">
                        Sahibi: <strong className="text-ink">{r.owner ? `${r.owner.firstName} ${r.owner.lastName}` : '—'}</strong>
                        {' · '}Sənəd: {r.documents.length}
                      </p>
                    </div>
                    <button type="button" onClick={() => openReview(r)} className={primaryBtn}>
                      Yoxla
                      <ArrowRight className="w-5 h-5" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        )}

        {/* TAB: ALL PROPOSALS */}
        {activeTab === 'proposals' && (
          <div className="bg-white rounded-2xl border border-line overflow-hidden">
            <div className="px-6 py-4 border-b border-line">
              <h3 className="text-lg font-bold text-ink">İnvestor təklifləri</h3>
              <p className="text-base text-muted">
                Bütün təkliflərə baxa bilərsiniz. Torpaq sahibinin elanlarında qalibi sahib seçir; köhnə inzibati elanlarda qalibi siz seçirsiniz.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-base border-collapse">
                <thead>
                  <tr className="bg-cream border-b border-line text-muted text-sm">
                    <th className="p-4 whitespace-nowrap">Nömrə</th>
                    <th className="p-4">İnvestor</th>
                    <th className="p-4">Sahə</th>
                    <th className="p-4">Məbləğ</th>
                    <th className="p-4">Tarix</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {proposals.map(p => (
                    <tr key={p.id} className="hover:bg-cream transition-colors">
                      <td className="p-4 font-bold text-brand-900 whitespace-nowrap">{p.referenceNumber}</td>
                      <td className="p-4">
                        <strong className="text-ink block">{p.user?.firstName} {p.user?.lastName}</strong>
                        <span className="text-muted text-sm block">{p.user?.email}</span>
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-ink block line-clamp-1">{p.land?.title || p.opportunity?.title}</span>
                        <span className="text-muted text-sm">
                          {p.land?.region} · {p.opportunity?.source === 'ADMIN' ? 'inzibati elan' : 'sahibin elanı'}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-ink whitespace-nowrap">{formatManat(p.proposedInvestmentAmount)}</td>
                      <td className="p-4 text-muted text-sm whitespace-nowrap">{formatDateAz(p.submittedAt)}</td>
                      <td className="p-4">
                        <span className={`inline-block font-bold text-sm px-3 py-1 rounded-full whitespace-nowrap ${statusInfo(p).badge}`}>{statusInfo(p).label}</span>
                      </td>
                      <td className="p-4 text-right">
                        <button type="button" onClick={() => { setViewProposal(p); setConfirmWinner(false); }} className="min-h-12 px-4 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-base font-bold">
                          Bax
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {proposals.length === 0 && <p className="p-8 text-center text-lg text-muted">Hələ təklif yoxdur.</p>}
            </div>
          </div>
        )}

        {/* TAB: OPPORTUNITIES */}
        {activeTab === 'opportunities' && (
          <div className="bg-white rounded-2xl border border-line p-6">
            <h3 className="text-lg font-bold text-ink">İnvestisiya elanları</h3>
            <p className="text-base text-muted mb-5">Hər torpaq üçün eyni anda yalnız bir açıq elan ola bilər.</p>
            <div className="space-y-4">
              {opportunities.map(o => {
                const lbl = opportunityLabel(o);
                return (
                  <div key={o.id} className="p-4 rounded-xl border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-base">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`px-2.5 py-0.5 rounded text-sm font-bold ${lbl.cls}`}>{lbl.text}</span>
                        <span className="text-muted">{o.source === 'ADMIN' ? 'İnzibati elan' : 'Sahibin elanı'}</span>
                        {o.applicationDeadline && <span className="text-muted">· Son tarix: {formatDateAz(o.applicationDeadline)}</span>}
                      </div>
                      <h4 className="text-lg font-bold text-ink">{o.title}</h4>
                      <p className="text-[#3E4F45]">
                        {o.land?.region} · Təkliflər: <strong>{o.proposalCount}</strong>
                        {o.contactPhone && <> · <Phone className="inline w-4 h-4" aria-hidden="true" /> {o.contactPhone}</>}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {o.land && (
                        <button type="button" onClick={() => navigate(`/opportunities/${o.landId}`)} className={outlineBtn}>Bax</button>
                      )}
                      {o.isResponsibleParty && o.status === 'ACTIVE' && (
                        <button type="button" disabled={busy !== null} onClick={() => setOpportunityStatus(o, 'CLOSED')} className={outlineBtn}>
                          Elanı bağla
                        </button>
                      )}
                      {o.isResponsibleParty && o.status === 'CLOSED' && !o.winnerProposalId && (
                        <button type="button" disabled={busy !== null} onClick={() => setOpportunityStatus(o, 'ACTIVE')} className={outlineBtn}>
                          Yenidən aç
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {opportunities.length === 0 && <p className="text-lg text-muted">Elan yoxdur.</p>}
            </div>
          </div>
        )}

        {/* TAB: PUBLISHED LANDS */}
        {activeTab === 'lands' && (
          <div className="bg-white rounded-2xl border border-line p-6">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-ink">Dərc olunmuş torpaq sahələri</h3>
              <p className="text-base text-muted">Yeni torpağı yalnız sahibi əlavə edir; siz onu “Yoxlama növbəsi” bölməsində təsdiq edirsiniz.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {lands.map(land => (
                <div key={land.id} className="p-4 rounded-xl border border-line hover:border-brand-600 transition-colors flex flex-col justify-between text-base">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-bold text-brand-700">{land.region}</span>
                      <span className="text-muted">{land.areaHectares} ha</span>
                    </div>
                    <h4 className="font-bold text-ink text-lg line-clamp-1">{land.title}</h4>
                    <p className="text-[#3E4F45] mt-1 line-clamp-2">{land.description}</p>
                    <div className="mt-3 text-sm text-muted">
                      <span>{land.isOwnerListing ? 'Sahibin torpağı' : 'Demo torpaq'} · {land.hasActiveOpportunity ? 'açıq elan var' : 'açıq elan yoxdur'}</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
                    <span className="font-bold text-ink">{formatManat(land.estimatedInvestmentRequirement)}</span>
                    <button onClick={() => navigate(`/opportunities/${land.id}`)} className="min-h-10 px-3 bg-sand hover:bg-line text-ink rounded-lg font-bold text-sm">
                      Bax
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: ANALYTICS */}
        {activeTab === 'analytics' && analytics && (
          <div className="space-y-6">
            {/* Top metrics summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Cəmi təklif', value: String(analytics.totalApplications), cls: 'text-ink' },
                { label: 'Təklif olunan ümumi sərmayə', value: `${(analytics.totalProposedInvestment / 1000000).toFixed(2)}M AZN`, cls: 'text-brand-700' },
                { label: 'Dərc olunmuş torpaq', value: String(analytics.publishedLands), cls: 'text-ink' },
                { label: 'Qalib / Seçilməyən', value: `${analytics.selectedProposals} / ${analytics.notSelectedProposals}`, cls: 'text-ink' },
              ].map(c => (
                <div key={c.label} className="bg-white p-5 rounded-2xl border border-line">
                  <span className="text-base text-muted font-medium block">{c.label}</span>
                  <span className={`text-2xl font-black mt-1 block ${c.cls}`}>{c.value}</span>
                </div>
              ))}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Region Chart */}
              <div className="bg-white p-6 rounded-2xl border border-line ">
                <h3 className="text-base font-bold text-ink mb-4">
                  Rayonlar üzrə təkliflərin sayı
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.applicationsByRegion}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4DCC6" />
                      <XAxis dataKey="region" stroke="#46564C" fontSize={14} />
                      <YAxis stroke="#46564C" fontSize={14} />
                      <Tooltip />
                      <Bar dataKey="count" name="Təklif sayı" fill="#1F6B3C" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Sector Chart */}
              <div className="bg-white p-6 rounded-2xl border border-line ">
                <h3 className="text-base font-bold text-ink mb-4">
                  Fəaliyyət növləri üzrə maraq
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.applicationsBySector}
                        dataKey="count"
                        nameKey="sector"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {analytics.applicationsBySector.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Timeline Trend */}
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-line ">
                <h3 className="text-base font-bold text-ink mb-4">
                  Aylar üzrə təklif olunan sərmayə
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.timeline}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4DCC6" />
                      <XAxis dataKey="month" stroke="#46564C" fontSize={14} />
                      <YAxis stroke="#46564C" fontSize={14} />
                      <Tooltip />
                      <Line type="monotone" dataKey="investment" name="Sərmayə həcmi (AZN)" stroke="#1F6B3C" strokeWidth={2.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: MOCK EKTİS INTEGRATION */}
        {activeTab === 'ektis' && (
          <div className="space-y-6 text-base">
            {/* Disclaimer card */}
            <div className="p-4 bg-gold-100 border border-gold-400 rounded-xl text-gold-900 leading-relaxed">
              <strong>Simulyasiya Qeydi:</strong> Bu bölmə EKTİS (Elektron Kənd Təsərrüfatı İnformasiya Sistemi) ilə gələcək inteqrasiya imkanlarının nümayişi üçün hazırlanmışdır. Real dövlət informasiya sistemi ilə əlaqə mövcud deyil, məlumat mübadiləsi simulyativ adapter vasitəsilə həyata keçirilir.
            </div>

            {/* Action Card */}
            <div className="bg-white rounded-2xl border border-line p-6 ">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-ink">EKTİS Kadastr və Subsidiya Sinxronizasiyası</h3>
                  <p className="text-muted mt-0.5">Torpaq parseli sərhədlərini və sahibkar reyestrini EKTİS adapteri ilə test edin</p>
                </div>
                <button
                  onClick={handleTriggerEktisSync}
                  disabled={syncingEktis}
                  className="min-h-12 px-5 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-xl font-bold transition-colors flex items-center gap-2 self-start sm:self-auto disabled:opacity-50"
                >
                  <Database className="w-4 h-4" />
                  <span>{syncingEktis ? 'Sinxronizasiya gedir...' : 'Sinxronizasiyanı Başlat'}</span>
                </button>
              </div>

              {/* Sync Live Result Inspector */}
              {syncResult && (
                <div className="mt-6 p-4 bg-ink rounded-xl text-line font-mono text-sm overflow-x-auto space-y-3">
                  <div className="flex items-center justify-between text-gold-400 font-bold border-b border-ink pb-2">
                    <span>EKTIS_RESPONSE: 200 OK (TOKEN: {syncResult.response?.syncToken})</span>
                    <span>{new Date().toISOString()}</span>
                  </div>
                  <div>
                    <span className="text-gold-400">// Cavab Xülasəsi:</span>
                    <pre className="text-line mt-1">{JSON.stringify(syncResult.response, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>

            {/* Audit Logs Table */}
            <div className="bg-white rounded-2xl border border-line overflow-hidden">
              <div className="px-6 py-4 border-b border-line">
                <h3 className="text-lg font-bold text-ink">İnteqrasiya Audit Loqları</h3>
              </div>
              <div className="divide-y divide-line">
                {ektisLogs.map(log => (
                  <div key={log.id} className="p-4 sm:px-6 hover:bg-cream">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-bold text-brand-700">{log.integrationType}</span>
                      <span className="text-muted">{new Date(log.createdAt).toLocaleString('az-AZ')}</span>
                    </div>
                    <p className="text-[#3E4F45] font-medium">Status: {log.status}</p>
                    <div className="mt-2 text-sm text-muted font-mono bg-cream p-2 rounded border border-line truncate">
                      {JSON.stringify(log.responsePayload)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LAND REVIEW DIALOG */}
        {reviewLand && (() => {
          const r = reviewLand;
          const info = landStatusInfo(r.land.status);
          return (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setReviewLand(null)}>
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="review-title"
                className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl border border-line text-base"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-line">
                  <div className="min-w-0">
                    <span className={`inline-block font-bold text-sm px-3 py-1 rounded-full ${info.badge}`}>{info.label}</span>
                    <h3 id="review-title" className="font-display font-extrabold text-2xl text-brand-900 mt-2">{r.land.title}</h3>
                    <p className="text-[#3E4F45]">{r.land.region} · {r.land.agricultureType} · {r.land.areaHectares} ha</p>
                  </div>
                  <button type="button" onClick={() => setReviewLand(null)} className="shrink-0 min-h-12 px-3 rounded-xl border-2 border-line font-bold flex items-center gap-1.5 hover:border-brand-900">
                    <XCircle className="w-5 h-5" aria-hidden="true" />
                    Bağla
                  </button>
                </div>

                <dl className="mt-4 grid sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-cream border border-line">
                    <dt className="text-sm text-muted">Sahibi</dt>
                    <dd className="font-bold">{r.owner ? `${r.owner.firstName} ${r.owner.lastName}` : '—'}</dd>
                    {r.owner?.email && <dd className="text-sm break-all">{r.owner.email}</dd>}
                    {r.ownerPhone && <dd className="text-sm">{r.ownerPhone}</dd>}
                  </div>
                  <div className="p-3 rounded-xl bg-cream border border-line">
                    <dt className="text-sm text-muted">Lazım olan sərmayə</dt>
                    <dd className="font-bold text-lg">{formatManat(r.land.estimatedInvestmentRequirement)}</dd>
                  </div>
                  <div className="p-3 rounded-xl bg-cream border border-line">
                    <dt className="text-sm text-muted">Yeri</dt>
                    <dd className="font-bold flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[#C0392B]" aria-hidden="true" />
                      <a href={`https://www.openstreetmap.org/?mlat=${r.land.latitude}&mlon=${r.land.longitude}#map=14/${r.land.latitude}/${r.land.longitude}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                        {r.land.latitude}, {r.land.longitude}
                      </a>
                    </dd>
                  </div>
                  <div className="p-3 rounded-xl bg-cream border border-line">
                    <dt className="text-sm text-muted">Təyinat</dt>
                    <dd className="font-bold">{r.land.intendedUse || '—'}</dd>
                  </div>
                </dl>
                {r.land.description && <p className="mt-3 text-[#3E4F45] whitespace-pre-line">{r.land.description}</p>}
                {r.ownerNote && (
                  <p className="mt-3 p-3 rounded-xl border border-line"><strong>Sahibin qeydi:</strong> {r.ownerNote}</p>
                )}
                {r.reviewNote && (
                  <p className="mt-3 p-3 rounded-xl border border-line"><strong>Əvvəlki qeydiniz:</strong> {r.reviewNote}</p>
                )}
                {r.opportunity && (r.opportunity.requiredDocuments.length > 0 || r.opportunity.eligibilityConditions.length > 0) && (
                  <div className="mt-3 p-3 rounded-xl border border-line">
                    {r.opportunity.requiredDocuments.length > 0 && <p><strong>İnvestordan istənən sənədlər:</strong> {r.opportunity.requiredDocuments.join(', ')}</p>}
                    {r.opportunity.eligibilityConditions.length > 0 && <p><strong>İnvestora tələblər:</strong> {r.opportunity.eligibilityConditions.join(', ')}</p>}
                  </div>
                )}

                <h4 className="font-display font-extrabold text-lg text-brand-900 mt-5 mb-2">Mülkiyyət sənədləri ({r.documents.length})</h4>
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {r.documents.map(d => (
                    <li key={d.id} className="rounded-xl border border-line overflow-hidden bg-cream">
                      <a href={d.url} target="_blank" rel="noopener" title="Böyük ölçüdə açın">
                        <img src={d.url} alt={d.fileName} className="w-full h-36 object-cover bg-white" />
                        <span className="block p-2 text-sm truncate underline underline-offset-2">{d.fileName}</span>
                      </a>
                    </li>
                  ))}
                </ul>

                {reviewError && (
                  <div role="alert" className="mt-5 p-3 bg-[#FCEBE8] border border-[#E8B4AC] text-[#A93226] rounded-lg">{reviewError}</div>
                )}

                {r.land.status === 'PENDING_REVIEW' || r.land.status === 'DOCUMENTS_REQUESTED' ? (
                  <div className="mt-6 p-4 bg-brand-50/50 border border-brand-100 rounded-xl space-y-4">
                    <h4 className="font-bold text-ink">Qərarınız</h4>
                    {reviewMode !== 'none' && (
                      <div>
                        <label htmlFor="review-text" className="block font-bold mb-1">
                          {reviewMode === 'request' ? 'Hansı sənəd lazımdır?' : 'Rədd etmə səbəbi'}
                        </label>
                        <textarea
                          id="review-text"
                          rows={3}
                          value={reviewText}
                          onChange={e => setReviewText(e.target.value)}
                          placeholder={reviewMode === 'request' ? 'Məs: Kadastr pasportunun ikinci səhifəsini yükləyin.' : 'Məs: Sənəd başqa şəxsin adınadır.'}
                          className="w-full bg-white border-2 border-[#9AA89E] rounded-xl p-3 text-ink text-lg"
                        />
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3">
                      {reviewMode === 'none' && (
                        <>
                          <button type="button" disabled={busy !== null} onClick={() => submitReview('approve')} className={primaryBtn}>
                            <CheckCircle className="w-5 h-5" aria-hidden="true" />
                            {busy === 'approve' ? 'Təsdiqlənir…' : 'Təsdiq et və dərc et'}
                          </button>
                          <button type="button" onClick={() => setReviewMode('request')} className={outlineBtn}>
                            <FileText className="w-5 h-5" aria-hidden="true" />
                            Əlavə sənəd istə
                          </button>
                          <button type="button" onClick={() => setReviewMode('reject')} className={dangerBtn}>
                            <XCircle className="w-5 h-5" aria-hidden="true" />
                            Rədd et
                          </button>
                        </>
                      )}
                      {reviewMode === 'request' && (
                        <button type="button" disabled={busy !== null} onClick={() => submitReview('request-documents')} className={primaryBtn}>
                          {busy === 'request-documents' ? 'Göndərilir…' : 'Sənəd tələbini göndər'}
                        </button>
                      )}
                      {reviewMode === 'reject' && (
                        <button type="button" disabled={busy !== null} onClick={() => submitReview('reject')} className={dangerBtn}>
                          {busy === 'reject' ? 'Göndərilir…' : 'Rədd et'}
                        </button>
                      )}
                      {reviewMode !== 'none' && (
                        <button type="button" onClick={() => { setReviewMode('none'); setReviewError(''); }} className={outlineBtn}>Geri</button>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })()}

        {/* PROPOSAL DIALOG */}
        {viewProposal && (() => {
          const p = viewProposal;
          const info = statusInfo(p);
          return (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setViewProposal(null)}>
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="proposal-title"
                className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-line text-base"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-line">
                  <div>
                    <span className="font-extrabold text-brand-900 text-lg">{p.referenceNumber}</span>
                    <h3 id="proposal-title" className="text-lg font-bold text-ink mt-0.5">{p.land?.title || p.opportunity?.title}</h3>
                    <span className={`inline-block mt-2 font-bold text-sm px-3 py-1 rounded-full ${info.badge}`}>{info.label}</span>
                  </div>
                  <button type="button" onClick={() => setViewProposal(null)} className="shrink-0 min-h-12 px-3 rounded-xl border-2 border-line font-bold flex items-center gap-1.5 hover:border-brand-900">
                    <XCircle className="w-5 h-5" aria-hidden="true" />
                    Bağla
                  </button>
                </div>

                <div className="mt-4 p-4 bg-cream rounded-xl border border-line space-y-3">
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <span className="text-muted text-sm block">İnvestor</span>
                      <strong className="text-ink">{p.user?.firstName} {p.user?.lastName}</strong>
                      <span className="block text-sm break-all">{p.user?.email}</span>
                    </div>
                    <div>
                      <span className="text-muted text-sm block">Telefon</span>
                      <strong className="text-ink whitespace-nowrap">{p.contactPhone || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-muted text-sm block">Təklif olunan sərmayə</span>
                      <strong className="text-brand-900 text-lg">{formatManat(p.proposedInvestmentAmount)}</strong>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted text-sm block">İcra müddəti</span>
                    <strong>{p.estimatedImplementationPeriod || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-muted text-sm block">Biznes planın xülasəsi</span>
                    <p className="text-ink leading-relaxed mt-1 bg-white p-3 rounded border border-line whitespace-pre-line">{p.businessPlanSummary}</p>
                  </div>
                  <div>
                    <span className="text-muted text-sm block">Sənədlər</span>
                    {p.documents.length === 0 ? <p>—</p> : (
                      <ul className="mt-1 flex flex-col gap-1.5">
                        {p.documents.map(d => (
                          <li key={d.id}>
                            <a href={d.url} target="_blank" rel="noopener" className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-line rounded-lg font-bold underline underline-offset-4 break-all">
                              <FileText className="w-4 h-4 text-brand-700 shrink-0" aria-hidden="true" />
                              {d.fileName}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {p.statusHistory.length > 0 && (
                  <section className="mt-5">
                    <h4 className="font-bold text-ink mb-2">Tarixçə</h4>
                    <ol className="flex flex-col gap-2 border-l-4 border-brand-100 ml-2 pl-4">
                      {p.statusHistory.map(h => (
                        <li key={h.id}>
                          <span className="text-sm text-muted">{formatDateAz(h.createdAt)}</span>
                          <p>{h.comment}</p>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                {p.canSelectWinner && (
                  <div className="mt-6 p-4 bg-brand-50/50 border border-brand-100 rounded-xl">
                    {!confirmWinner ? (
                      <button type="button" onClick={() => setConfirmWinner(true)} className={primaryBtn}>
                        <Trophy className="w-5 h-5" aria-hidden="true" />
                        Bu təklifi qalib seç
                      </button>
                    ) : (
                      <>
                        <p className="text-lg">
                          Elan bağlanacaq, yeni təklif qəbul edilməyəcək və digər investorlara “Seçilmədi” bildirişi göndəriləcək. Bunu geri qaytarmaq olmaz.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3">
                          <button type="button" disabled={busy !== null} onClick={() => selectWinner(p)} className={primaryBtn}>
                            <Check className="w-5 h-5" aria-hidden="true" />
                            {busy === `win-${p.id}` ? 'Seçilir…' : 'Bəli, qalib seç'}
                          </button>
                          <button type="button" onClick={() => setConfirmWinner(false)} className={outlineBtn}>Ləğv et</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
