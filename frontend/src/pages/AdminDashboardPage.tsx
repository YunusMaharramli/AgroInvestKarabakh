import React, { useState, useEffect } from 'react';
import { Application, AgriculturalLand, Competition, AnalyticsSummary, IntegrationLog } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { statusInfo } from '../lib/applicationStatus.js';
import { formatManat, formatDateAz } from '../lib/landImages.js';
import {
  Shield,
  FileCheck,
  MapPin,
  Calendar,
  BarChart3,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Plus,
  Trash2,
  FileText,
  Activity,
  Layers,
  Database,
  ArrowRight
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

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ navigate }) => {
  const { user, token, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'applications' | 'lands' | 'competitions' | 'analytics' | 'ektis'>('applications');

  const [applications, setApplications] = useState<Application[]>([]);
  const [lands, setLands] = useState<AgriculturalLand[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [ektisLogs, setEktisLogs] = useState<IntegrationLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Review Modal
  const [reviewApp, setReviewApp] = useState<Application | null>(null);
  const [newStatus, setNewStatus] = useState<Application['status']>('UNDER_REVIEW');
  const [decisionOutcome, setDecisionOutcome] = useState<Application['decisionOutcome']>('NONE');
  const [adminComment, setAdminComment] = useState('');
  const [statusUpdateError, setStatusUpdateError] = useState('');

  // Info Request Modal inside Review
  const [infoReqMsg, setInfoReqMsg] = useState('');
  const [showInfoReqBox, setShowInfoReqBox] = useState(false);

  // Land Create Modal
  const [showLandModal, setShowLandModal] = useState(false);
  const [newLandTitle, setNewLandTitle] = useState('');
  const [newLandRegion, setNewLandRegion] = useState('Ağdam');
  const [newLandArea, setNewLandArea] = useState(150);
  const [newLandSector, setNewLandSector] = useState<any>('Əkinçilik');
  const [newLandInvestment, setNewLandInvestment] = useState(400000);
  const [newLandUse, setNewLandUse] = useState('');
  const [newLandDesc, setNewLandDesc] = useState('');

  // Competition Create Modal
  const [showCompModal, setShowCompModal] = useState(false);
  const [newCompTitle, setNewCompTitle] = useState('');
  const [newCompLandId, setNewCompLandId] = useState('');
  const [newCompDeadline, setNewCompDeadline] = useState('2026-12-31');
  const [newCompDesc, setNewCompDesc] = useState('');

  // EKTIS sync state
  const [syncingEktis, setSyncingEktis] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const [appsRes, landsRes, compsRes, analRes, ektisRes] = await Promise.all([
        fetch('/api/admin/applications', { headers }),
        fetch('/api/lands', { headers }),
        fetch('/api/competitions', { headers }),
        fetch('/api/admin/analytics', { headers }),
        fetch('/api/admin/integrations/ektis/logs', { headers }),
      ]);

      if (appsRes.ok) setApplications(await appsRes.json());
      if (landsRes.ok) setLands(await landsRes.json());
      if (compsRes.ok) setCompetitions(await compsRes.json());
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

  const handleStatusChangeSubmit = async () => {
    if (!reviewApp) return;
    setStatusUpdateError('');

    try {
      const res = await fetch(`/api/admin/applications/${reviewApp.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          status: newStatus,
          comment: adminComment,
          decisionOutcome: newStatus === 'DECIDED' ? decisionOutcome : 'NONE',
          decisionNote: adminComment,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatusUpdateError(data.error || 'Status yenilənmədi.');
      } else {
        setReviewApp(data);
        setAdminComment('');
        fetchAdminData();
      }
    } catch (e) {
      setStatusUpdateError('Şəbəkə xətası.');
    }
  };

  const handleSendInfoRequest = async () => {
    if (!reviewApp || !infoReqMsg.trim()) return;

    try {
      const res = await fetch(`/api/admin/applications/${reviewApp.id}/information-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: infoReqMsg }),
      });

      if (res.ok) {
        setShowInfoReqBox(false);
        setInfoReqMsg('');
        const updated = await (await fetch(`/api/admin/applications/${reviewApp.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })).json();
        setReviewApp(updated);
        fetchAdminData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateLand = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/lands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: newLandTitle,
          region: newLandRegion,
          areaHectares: newLandArea,
          agricultureType: newLandSector,
          estimatedInvestmentRequirement: newLandInvestment,
          intendedUse: newLandUse,
          description: newLandDesc,
        }),
      });
      if (res.ok) {
        setShowLandModal(false);
        setNewLandTitle('');
        setNewLandUse('');
        setNewLandDesc('');
        fetchAdminData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/competitions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: newCompTitle,
          landId: newCompLandId || lands[0]?.id,
          description: newCompDesc,
          applicationDeadline: `${newCompDeadline}T23:59:59Z`,
          eligibilityConditions: ['Müvafiq aqrar təcrübə', 'Bank zəmanət məktubu'],
          requiredDocuments: ['Biznes Plan və TİƏ', 'VÖEN və nizamnamə'],
        }),
      });
      if (res.ok) {
        setShowCompModal(false);
        setNewCompTitle('');
        setNewCompDesc('');
        fetchAdminData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerEktisSync = async () => {
    setSyncingEktis(true);
    setSyncResult(null);

    try {
      const res = await fetch('/api/admin/integrations/ektis/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          syncType: 'CADASTRAL_DATA_SYNC',
          targetRegions: ['Ağdam', 'Füzuli', 'Zəngilan', 'Cəbrayıl'],
        }),
      });

      const data = await res.json();
      setSyncResult(data);
      fetchAdminData();
    } catch (e) {
      console.error(e);
    } finally {
      setSyncingEktis(false);
    }
  };

  const COLORS = ['#1F6B3C', '#B7791F', '#2B6CB0', '#8E2A1F', '#6B46C1', '#46564C'];

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
              Müraciətlər və müsabiqələr
            </h1>
            <p className="text-lg text-[#3E4F45] mt-1">
              Müraciətlərə baxın, qərar verin, torpaq sahələrini və müsabiqələri idarə edin.
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
            { label: 'Yeni gələn', value: applications.filter(a => a.status === 'RECEIVED').length, cls: 'text-brand-900' },
            { label: 'Yoxlanılır', value: applications.filter(a => a.status === 'UNDER_REVIEW').length, cls: 'text-gold-900' },
            { label: 'Sahibkarın cavabı gözlənilir', value: applications.filter(a => a.status === 'ADDITIONAL_INFORMATION_REQUIRED').length, cls: 'text-[#A93226]' },
            { label: 'Qərar verilib', value: applications.filter(a => a.status === 'DECIDED').length, cls: 'text-ink' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl border border-line p-4">
              <p className="text-base text-muted leading-snug">{c.label}</p>
              <p className={`font-display font-extrabold text-3xl mt-1 ${c.cls}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Navigation Tabs */}
        <div role="tablist" aria-label="Panel bölmələri" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-6">
          {([
            ['applications', `Müraciətlər (${applications.length})`],
            ['lands', `Torpaq sahələri (${lands.length})`],
            ['competitions', `Müsabiqələr (${competitions.length})`],
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

        {/* TAB 1: APPLICATIONS REVIEW */}
        {activeTab === 'applications' && (
          <div className="bg-white rounded-2xl border border-line overflow-hidden">
            <div className="px-6 py-4 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-ink">Müsabiqə Müraciətləri Reyestri</h3>
                <p className="text-base text-muted">Müraciətləri nəzərdən keçirin, ekspert rəyi verin və statusu yeniləyin</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-base border-collapse">
                <thead>
                  <tr className="bg-cream border-b border-line text-muted text-sm">
                    <th className="p-4 whitespace-nowrap">Referans №</th>
                    <th className="p-4">Ərizəçi / Şirkət</th>
                    <th className="p-4">Müsabiqə və Region</th>
                    <th className="p-4">Təklif Edilən İnvestisiya</th>
                    <th className="p-4">Tarix</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {applications.map(app => (
                    <tr key={app.id} className="hover:bg-cream transition-colors">
                      <td className="p-4 font-bold text-brand-900 whitespace-nowrap">
                        {app.referenceNumber}
                      </td>
                      <td className="p-4">
                        <strong className="text-ink block">{app.user?.firstName} {app.user?.lastName}</strong>
                        <span className="text-muted text-sm block">{app.user?.email}</span>
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-ink block line-clamp-1">{app.competition?.title}</span>
                        <span className="text-muted text-sm">{app.land?.region} ({app.land?.areaHectares} ha)</span>
                      </td>
                      <td className="p-4 font-bold text-ink">
                        {formatManat(app.proposedInvestmentAmount)}
                      </td>
                      <td className="p-4 text-muted text-sm">
                        {formatDateAz(app.submittedAt)}
                      </td>
                      <td className="p-4">
                        <span className={`inline-block font-bold text-sm px-3 py-1 rounded-full whitespace-nowrap ${statusInfo(app).badge}`}>{app.status === 'ADDITIONAL_INFORMATION_REQUIRED' ? 'Sahibkarın cavabı gözlənilir' : statusInfo(app).label}</span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => {
                            setReviewApp(app);
                            setNewStatus(app.status);
                            setDecisionOutcome(app.decisionOutcome || 'NONE');
                            setStatusUpdateError('');
                          }}
                          className="min-h-12 px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-base font-bold "
                        >
                          Ekspertiza
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: LAND MANAGEMENT */}
        {activeTab === 'lands' && (
          <div className="bg-white rounded-2xl border border-line p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-ink">Dövlət Aqrar Torpaq Fondu İdarəçiliyi</h3>
                <p className="text-base text-muted">Mövcud massivlər, meliorasiya vəziyyəti və statuslar</p>
              </div>
              <button
                onClick={() => setShowLandModal(true)}
                className="min-h-12 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-base font-bold transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Yeni Torpaq Massivi Əlavə Et</span>
              </button>
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
                      <span>Təyinat: {land.intendedUse}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
                    <span className="font-bold text-ink">
                      {formatManat(land.estimatedInvestmentRequirement)}
                    </span>
                    <button
                      onClick={() => navigate(`/opportunities/${land.id}`)}
                      className="px-2.5 py-1 bg-sand hover:bg-line text-ink rounded font-bold text-sm"
                    >
                      Bax
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: COMPETITION MANAGEMENT */}
        {activeTab === 'competitions' && (
          <div className="bg-white rounded-2xl border border-line p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-ink">İnvestisiya Müsabiqələrinin İdarə Olunması</h3>
                <p className="text-base text-muted">Müsabiqə statusları, son müraciət tarixləri və sənəd tələbləri</p>
              </div>
              <button
                onClick={() => setShowCompModal(true)}
                className="min-h-12 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-base font-bold transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Yeni Müsabiqə Elan Et</span>
              </button>
            </div>

            <div className="space-y-4">
              {competitions.map(comp => (
                <div key={comp.id} className="p-4 rounded-xl border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-base">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-sm font-bold ${comp.status === 'ACTIVE' ? 'bg-brand-100 text-brand-700' : 'bg-sand text-[#3E4F45]'}`}>
                        {comp.status === 'ACTIVE' ? 'Aktiv (Müraciət Açıqdır)' : 'Bağlanıb'}
                      </span>
                      <span className="text-muted">Son tarix: {formatDateAz(comp.applicationDeadline)}</span>
                    </div>
                    <h4 className="text-lg font-bold text-ink">{comp.title}</h4>
                    <p className="text-[#3E4F45] mt-1 max-w-2xl">{comp.description}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={async () => {
                        const newSt = comp.status === 'ACTIVE' ? 'CLOSED' : 'ACTIVE';
                        await fetch(`/api/admin/competitions/${comp.id}`, {
                          method: 'PATCH',
                          headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { Authorization: `Bearer ${token}` } : {}),
                          },
                          body: JSON.stringify({ status: newSt }),
                        });
                        fetchAdminData();
                      }}
                      className="min-h-12 px-3 py-1.5 bg-sand hover:bg-line text-ink rounded-lg font-bold"
                    >
                      {comp.status === 'ACTIVE' ? 'Müsabiqəni Bağla' : 'Yenidən Aç'}
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
              <div className="bg-white p-5 rounded-2xl border border-line">
                <span className="text-base text-muted font-medium block">Cəmi Təqdim Edilmiş Müraciət</span>
                <span className="text-2xl font-black text-ink mt-1 block">
                  {analytics.totalApplications}
                </span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-line">
                <span className="text-base text-muted font-medium block">Təklif Olunan Ümumi İnvestisiya</span>
                <span className="text-2xl font-black text-brand-700 mt-1 block">
                  {(analytics.totalProposedInvestment / 1000000).toFixed(2)}M AZN
                </span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-line">
                <span className="text-base text-muted font-medium block">Orta Ekspertiza Müddəti</span>
                <span className="text-2xl font-black text-ink mt-1 block">
                  {analytics.averageProcessingDays} gün
                </span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-line">
                <span className="text-base text-muted font-medium block">Təsdiq / Rədd Nisbəti</span>
                <span className="text-2xl font-black text-ink mt-1 block">
                  {analytics.approvedApplications} / {analytics.rejectedApplications}
                </span>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Region Chart */}
              <div className="bg-white p-6 rounded-2xl border border-line ">
                <h3 className="text-base font-bold text-ink mb-4">
                  Regionlar Üzrə Müraciətlər Sayı
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.applicationsByRegion}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4DCC6" />
                      <XAxis dataKey="region" stroke="#46564C" fontSize={14} />
                      <YAxis stroke="#46564C" fontSize={14} />
                      <Tooltip />
                      <Bar dataKey="count" name="Müraciət sayı" fill="#1F6B3C" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Sector Chart */}
              <div className="bg-white p-6 rounded-2xl border border-line ">
                <h3 className="text-base font-bold text-ink mb-4">
                  Sektorlar Üzrə İnvestisiya Marağı
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
                  Aylar Üzrə İnvestisiya Dinamikası
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

        {/* REVIEW AND DECISION MODAL */}
        {reviewApp && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-line text-base">
              <div className="flex items-start justify-between pb-4 border-b border-line">
                <div>
                  <span className="font-extrabold text-brand-900 text-lg">
                    {reviewApp.referenceNumber}
                  </span>
                  <h3 className="text-base font-bold text-ink mt-0.5">{reviewApp.competition?.title}</h3>
                </div>
                <button
                  onClick={() => setReviewApp(null)}
                  className="p-1 rounded-lg text-muted hover:text-[#3E4F45]"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Applicant proposal details */}
              <div className="mt-4 p-4 bg-cream rounded-xl border border-line space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-muted text-sm block">Ərizəçi</span>
                    <strong className="text-ink">{reviewApp.user?.firstName} {reviewApp.user?.lastName} ({reviewApp.user?.email})</strong>
                  </div>
                  <div>
                    <span className="text-muted text-sm block">Təklif Olunan Sərmayə</span>
                    <strong className="text-brand-900 text-lg">{formatManat(reviewApp.proposedInvestmentAmount)}</strong>
                  </div>
                </div>

                <div>
                  <span className="text-muted text-sm block">Biznes Plan Xülasəsi</span>
                  <p className="text-ink leading-relaxed mt-1 bg-white p-3 rounded border border-line">
                    {reviewApp.businessPlanSummary}
                  </p>
                </div>

                <div>
                  <span className="text-muted text-sm block">Yüklənmiş Sənədlər</span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {reviewApp.documents?.map(d => (
                      <span key={d.id} className="px-2.5 py-1 bg-white border border-line rounded text-[#3E4F45] font-medium">
                        📄 {d.fileName}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Status Update & Decision Section */}
              <div className="mt-6 p-4 bg-brand-50/50 border border-brand-100 rounded-xl space-y-4">
                <h4 className="font-bold text-ink text-sm">
                  İnzibatçı Qərarı və Status Keçidi
                </h4>

                {statusUpdateError && (
                  <div className="p-3 bg-[#FCEBE8] border border-[#E8B4AC] text-[#A93226] rounded-lg">
                    {statusUpdateError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-[#3E4F45] mb-1">Yeni Status</label>
                    <select
                      value={newStatus}
                      onChange={e => setNewStatus(e.target.value as any)}
                      className="w-full bg-white border border-line rounded-lg p-2.5 text-ink"
                    >
                      <option value="RECEIVED">Qəbul edildi</option>
                      <option value="UNDER_REVIEW">Yoxlanılır</option>
                      <option value="ADDITIONAL_INFORMATION_REQUIRED">Əlavə məlumat tələb olunur</option>
                      <option value="DECIDED">Yekun qərar</option>
                    </select>
                  </div>

                  {newStatus === 'DECIDED' && (
                    <div>
                      <label className="block font-bold text-[#3E4F45] mb-1">Qərar Nəticəsi *</label>
                      <select
                        value={decisionOutcome}
                        onChange={e => setDecisionOutcome(e.target.value as any)}
                        className="w-full bg-white border border-line rounded-lg p-2.5 text-ink font-bold"
                      >
                        <option value="NONE">Seçin...</option>
                        <option value="APPROVED">Təsdiq edildi</option>
                        <option value="REJECTED">Rədd edildi</option>
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-[#3E4F45] mb-1">İnzibatçı / Ekspertiza Rəsmi Rəyi</label>
                  <textarea
                    rows={3}
                    value={adminComment}
                    onChange={e => setAdminComment(e.target.value)}
                    placeholder="Müraciət statusunun dəyişdirilməsi səbəbini və komissiya protokol qeydini yazın..."
                    className="w-full bg-white border border-line rounded-lg p-2.5 text-ink"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInfoReqBox(!showInfoReqBox)}
                    className="text-base font-bold text-[#A93226] hover:underline"
                  >
                    + Sahibkardan rəsmi əlavə məlumat tələb et
                  </button>

                  <button
                    type="button"
                    onClick={handleStatusChangeSubmit}
                    className="min-h-12 px-5 py-2.5 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-lg transition-colors"
                  >
                    Statusu Saxla və Sahibkarı Bildir
                  </button>
                </div>

                {/* Additional info request input box */}
                {showInfoReqBox && (
                  <div className="p-3 bg-[#FCEBE8] border border-[#E8B4AC] rounded-lg space-y-2 mt-2">
                    <label className="block font-bold text-[#7A1F14]">Tələb olunan sənəd və ya məlumatın mətni:</label>
                    <input
                      type="text"
                      value={infoReqMsg}
                      onChange={e => setInfoReqMsg(e.target.value)}
                      placeholder="Məs: Suvarma texniki şərtini təqdim edin..."
                      className="w-full bg-white border border-[#E8B4AC] rounded p-2 text-ink"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleSendInfoRequest}
                        className="min-h-12 px-3 py-1 bg-[#7A1F14] text-white rounded font-bold text-base"
                      >
                        Sorğunu Göndər
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CREATE LAND */}
        {showLandModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-line text-base">
              <h3 className="text-base font-bold text-ink mb-4">Yeni Torpaq Massivi Əlavə Et</h3>
              <form onSubmit={handleCreateLand} className="space-y-3">
                <div>
                  <label className="block font-bold text-[#3E4F45] mb-1">Massivin Adı</label>
                  <input
                    type="text"
                    required
                    value={newLandTitle}
                    onChange={e => setNewLandTitle(e.target.value)}
                    placeholder="Məs: Ağdam Sarıcalı Əkin Sahəsi"
                    className="w-full bg-cream border border-line rounded-lg p-2 text-ink"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#3E4F45] mb-1">Region</label>
                    <select
                      value={newLandRegion}
                      onChange={e => setNewLandRegion(e.target.value)}
                      className="w-full bg-cream border border-line rounded-lg p-2 text-ink"
                    >
                      <option value="Ağdam">Ağdam</option>
                      <option value="Füzuli">Füzuli</option>
                      <option value="Zəngilan">Zəngilan</option>
                      <option value="Cəbrayıl">Cəbrayıl</option>
                      <option value="Qubadlı">Qubadlı</option>
                      <option value="Xocavənd">Xocavənd</option>
                      <option value="Kəlbəcər">Kəlbəcər</option>
                      <option value="Laçın">Laçın</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-[#3E4F45] mb-1">Sahə (hektar)</label>
                    <input
                      type="number"
                      required
                      value={newLandArea}
                      onChange={e => setNewLandArea(Number(e.target.value))}
                      className="w-full bg-cream border border-line rounded-lg p-2 text-ink"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#3E4F45] mb-1">Aqrar Sektor</label>
                    <select
                      value={newLandSector}
                      onChange={e => setNewLandSector(e.target.value)}
                      className="w-full bg-cream border border-line rounded-lg p-2 text-ink"
                    >
                      <option value="Əkinçilik">Əkinçilik</option>
                      <option value="Bağçılıq">Bağçılıq</option>
                      <option value="İstixana təsərrüfatı">İstixana</option>
                      <option value="Heyvandarlıq">Heyvandarlıq</option>
                      <option value="Arıçılıq">Arıçılıq</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-[#3E4F45] mb-1">Minimal Sərmayə (AZN)</label>
                    <input
                      type="number"
                      required
                      value={newLandInvestment}
                      onChange={e => setNewLandInvestment(Number(e.target.value))}
                      className="w-full bg-cream border border-line rounded-lg p-2 text-ink"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-[#3E4F45] mb-1">Təyinat</label>
                  <input
                    type="text"
                    required
                    value={newLandUse}
                    onChange={e => setNewLandUse(e.target.value)}
                    placeholder="Məs: Buğda və arpa əkini"
                    className="w-full bg-cream border border-line rounded-lg p-2 text-ink"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#3E4F45] mb-1">Təsvir</label>
                  <textarea
                    rows={2}
                    value={newLandDesc}
                    onChange={e => setNewLandDesc(e.target.value)}
                    className="w-full bg-cream border border-line rounded-lg p-2 text-ink"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowLandModal(false)}
                    className="min-h-12 px-4 py-2 bg-sand rounded-lg font-bold"
                  >
                    Ləğv et
                  </button>
                  <button
                    type="submit"
                    className="min-h-12 px-4 py-2 bg-brand-700 text-white rounded-lg font-bold"
                  >
                    Əlavə Et
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: CREATE COMPETITION */}
        {showCompModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-line text-base">
              <h3 className="text-base font-bold text-ink mb-4">Yeni İnvestisiya Müsabiqəsi Elan Et</h3>
              <form onSubmit={handleCreateCompetition} className="space-y-3">
                <div>
                  <label className="block font-bold text-[#3E4F45] mb-1">Müsabiqənin Başlığı</label>
                  <input
                    type="text"
                    required
                    value={newCompTitle}
                    onChange={e => setNewCompTitle(e.target.value)}
                    placeholder="Məs: Füzuli Bağçılıq Müsabiqəsi"
                    className="w-full bg-cream border border-line rounded-lg p-2 text-ink"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#3E4F45] mb-1">Əlaqəli Torpaq Sahəsi</label>
                  <select
                    value={newCompLandId}
                    onChange={e => setNewCompLandId(e.target.value)}
                    className="w-full bg-cream border border-line rounded-lg p-2 text-ink"
                  >
                    {lands.map(l => (
                      <option key={l.id} value={l.id}>{l.title} ({l.region}, {l.areaHectares} ha)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#3E4F45] mb-1">Son Müraciət Tarixi</label>
                  <input
                    type="date"
                    required
                    value={newCompDeadline}
                    onChange={e => setNewCompDeadline(e.target.value)}
                    className="w-full bg-cream border border-line rounded-lg p-2 text-ink"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#3E4F45] mb-1">Təsvir və Hədəf</label>
                  <textarea
                    rows={2}
                    value={newCompDesc}
                    onChange={e => setNewCompDesc(e.target.value)}
                    className="w-full bg-cream border border-line rounded-lg p-2 text-ink"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCompModal(false)}
                    className="min-h-12 px-4 py-2 bg-sand rounded-lg font-bold"
                  >
                    Ləğv et
                  </button>
                  <button
                    type="submit"
                    className="min-h-12 px-4 py-2 bg-brand-700 text-white rounded-lg font-bold"
                  >
                    Elan Et
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
