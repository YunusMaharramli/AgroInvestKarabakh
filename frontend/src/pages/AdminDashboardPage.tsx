import React, { useState, useEffect } from 'react';
import { Application, AgriculturalLand, Competition, AnalyticsSummary, IntegrationLog } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
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
  const { user, token } = useAuth();
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
    if (user && user.role === 'ADMIN') {
      fetchAdminData();
    } else {
      navigate('/login');
    }
  }, [user]);

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

  const COLORS = ['#166534', '#0284c7', '#d97706', '#7c3aed', '#db2777', '#4b5563'];

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-amber-500 text-slate-900">
                <Shield className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                Dövlət İdarəetmə Konsolu
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              İnzibatçı Nəzarət və Qərar Paneli
            </h1>
            <p className="text-xs text-slate-500">
              Qarabağ aqrar müsabiqələrinin idarə edilməsi, müraciətlərin ekspertizası və EKTİS inteqrasiyası
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAdminData}
              className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-lg shadow-2xs"
              title="Məlumatları yenilə"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-8 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('applications')}
            className={`px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors ${activeTab === 'applications' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Müraciətlər ({applications.length})
          </button>
          <button
            onClick={() => setActiveTab('lands')}
            className={`px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors ${activeTab === 'lands' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Torpaq Fondu ({lands.length})
          </button>
          <button
            onClick={() => setActiveTab('competitions')}
            className={`px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors ${activeTab === 'competitions' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Müsabiqələr ({competitions.length})
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors ${activeTab === 'analytics' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Analitika və Hesabatlar
          </button>
          <button
            onClick={() => setActiveTab('ektis')}
            className={`px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors ${activeTab === 'ektis' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Mock EKTİS İnteqrasiyası
          </button>
        </div>

        {/* TAB 1: APPLICATIONS REVIEW */}
        {activeTab === 'applications' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Müsabiqə Müraciətləri Reyestri</h3>
                <p className="text-xs text-slate-500">Müraciətləri nəzərdən keçirin, ekspert rəyi verin və statusu yeniləyin</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                    <th className="p-4">Referans №</th>
                    <th className="p-4">Ərizəçi / Şirkət</th>
                    <th className="p-4">Müsabiqə və Region</th>
                    <th className="p-4">Təklif Edilən İnvestisiya</th>
                    <th className="p-4">Tarix</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {applications.map(app => (
                    <tr key={app.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4 font-mono-numbers font-bold text-emerald-900">
                        {app.referenceNumber}
                      </td>
                      <td className="p-4">
                        <strong className="text-slate-900 block">{app.user?.firstName} {app.user?.lastName}</strong>
                        <span className="text-slate-500 text-[11px] block">{app.user?.email}</span>
                      </td>
                      <td className="p-4">
                        <span className="font-semibold text-slate-800 block line-clamp-1">{app.competition?.title}</span>
                        <span className="text-slate-500 text-[11px]">{app.land?.region} ({app.land?.areaHectares} ha)</span>
                      </td>
                      <td className="p-4 font-mono-numbers font-bold text-slate-900">
                        {app.proposedInvestmentAmount.toLocaleString()} AZN
                      </td>
                      <td className="p-4 text-slate-500 font-mono-numbers text-[11px]">
                        {new Date(app.submittedAt).toLocaleDateString('az-AZ')}
                      </td>
                      <td className="p-4">
                        {app.status === 'RECEIVED' && <span className="text-slate-700 font-bold">Qəbul edilib</span>}
                        {app.status === 'UNDER_REVIEW' && <span className="text-amber-700 font-bold">Baxılır</span>}
                        {app.status === 'ADDITIONAL_INFORMATION_REQUIRED' && <span className="text-indigo-700 font-bold">Əlavə məlumat sorğusu</span>}
                        {app.status === 'DECIDED' && (
                          <span className={`font-bold ${app.decisionOutcome === 'APPROVED' ? 'text-emerald-800' : 'text-rose-700'}`}>
                            {app.decisionOutcome === 'APPROVED' ? 'Təsdiqləndi' : 'İmtina edildi'}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => {
                            setReviewApp(app);
                            setNewStatus(app.status);
                            setDecisionOutcome(app.decisionOutcome || 'NONE');
                            setStatusUpdateError('');
                          }}
                          className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold shadow-2xs"
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Dövlət Aqrar Torpaq Fondu İdarəçiliyi</h3>
                <p className="text-xs text-slate-500">Mövcud massivlər, meliorasiya vəziyyəti və statuslar</p>
              </div>
              <button
                onClick={() => setShowLandModal(true)}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Yeni Torpaq Massivi Əlavə Et</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {lands.map(land => (
                <div key={land.id} className="p-4 rounded-xl border border-slate-200 hover:border-emerald-300 transition-colors flex flex-col justify-between text-xs">
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-bold text-emerald-800">{land.region}</span>
                      <span className="font-mono-numbers text-slate-500">{land.areaHectares} ha</span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{land.title}</h4>
                    <p className="text-slate-600 mt-1 line-clamp-2">{land.description}</p>
                    <div className="mt-3 text-[11px] text-slate-500">
                      <span>Təyinat: {land.intendedUse}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="font-bold text-slate-900 font-mono-numbers">
                      {land.estimatedInvestmentRequirement.toLocaleString()} ₼
                    </span>
                    <button
                      onClick={() => navigate(`/opportunities/${land.id}`)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold text-[11px]"
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">İnvestisiya Müsabiqələrinin İdarə Olunması</h3>
                <p className="text-xs text-slate-500">Müsabiqə statusları, son müraciət tarixləri və sənəd tələbləri</p>
              </div>
              <button
                onClick={() => setShowCompModal(true)}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Yeni Müsabiqə Elan Et</span>
              </button>
            </div>

            <div className="space-y-4">
              {competitions.map(comp => (
                <div key={comp.id} className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${comp.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                        {comp.status === 'ACTIVE' ? 'Aktiv (Müraciət Açıqdır)' : 'Bağlanıb'}
                      </span>
                      <span className="text-slate-400 font-mono-numbers">Son tarix: {new Date(comp.applicationDeadline).toLocaleDateString('az-AZ')}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">{comp.title}</h4>
                    <p className="text-slate-600 mt-1 max-w-2xl">{comp.description}</p>
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
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold"
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
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <span className="text-xs text-slate-400 font-medium block">Cəmi Təqdim Edilmiş Müraciət</span>
                <span className="text-2xl font-black text-slate-900 font-mono-numbers mt-1 block">
                  {analytics.totalApplications}
                </span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <span className="text-xs text-slate-400 font-medium block">Təklif Olunan Ümumi İnvestisiya</span>
                <span className="text-2xl font-black text-emerald-800 font-mono-numbers mt-1 block">
                  {(analytics.totalProposedInvestment / 1000000).toFixed(2)}M AZN
                </span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <span className="text-xs text-slate-400 font-medium block">Orta Ekspertiza Müddəti</span>
                <span className="text-2xl font-black text-slate-900 font-mono-numbers mt-1 block">
                  {analytics.averageProcessingDays} gün
                </span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <span className="text-xs text-slate-400 font-medium block">Təsdiq / Rədd Nisbəti</span>
                <span className="text-2xl font-black text-slate-900 font-mono-numbers mt-1 block">
                  {analytics.approvedApplications} / {analytics.rejectedApplications}
                </span>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Region Chart */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
                  Regionlar Üzrə Müraciətlər Sayı
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.applicationsByRegion}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="region" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="count" name="Müraciət sayı" fill="#166534" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Sector Chart */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
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
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
                  Aylar Üzrə İnvestisiya Dinamikası
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.timeline}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip />
                      <Line type="monotone" dataKey="investment" name="Sərmayə həcmi (AZN)" stroke="#166534" strokeWidth={2.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: MOCK EKTİS INTEGRATION */}
        {activeTab === 'ektis' && (
          <div className="space-y-6 text-xs">
            {/* Disclaimer card */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 leading-relaxed">
              <strong>Simulyasiya Qeydi:</strong> Bu bölmə EKTİS (Elektron Kənd Təsərrüfatı İnformasiya Sistemi) ilə gələcək inteqrasiya imkanlarının nümayişi üçün hazırlanmışdır. Real dövlət informasiya sistemi ilə əlaqə mövcud deyil, məlumat mübadiləsi simulyativ adapter vasitəsilə həyata keçirilir.
            </div>

            {/* Action Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">EKTİS Kadastr və Subsidiya Sinxronizasiyası</h3>
                  <p className="text-slate-500 mt-0.5">Torpaq parseli sərhədlərini və sahibkar reyestrini EKTİS adapteri ilə test edin</p>
                </div>
                <button
                  onClick={handleTriggerEktisSync}
                  disabled={syncingEktis}
                  className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold shadow-xs transition-colors flex items-center gap-2 self-start sm:self-auto disabled:opacity-50"
                >
                  <Database className="w-4 h-4" />
                  <span>{syncingEktis ? 'Sinxronizasiya gedir...' : 'Sinxronizasiyanı Başlat'}</span>
                </button>
              </div>

              {/* Sync Live Result Inspector */}
              {syncResult && (
                <div className="mt-6 p-4 bg-slate-900 rounded-xl text-slate-200 font-mono text-[11px] overflow-x-auto space-y-3">
                  <div className="flex items-center justify-between text-emerald-400 font-bold border-b border-slate-800 pb-2">
                    <span>EKTIS_RESPONSE: 200 OK (TOKEN: {syncResult.response?.syncToken})</span>
                    <span>{new Date().toISOString()}</span>
                  </div>
                  <div>
                    <span className="text-amber-300">// Cavab Xülasəsi:</span>
                    <pre className="text-slate-300 mt-1">{JSON.stringify(syncResult.response, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>

            {/* Audit Logs Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">İnteqrasiya Audit Loqları</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {ektisLogs.map(log => (
                  <div key={log.id} className="p-4 sm:px-6 hover:bg-slate-50">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-bold text-emerald-800">{log.integrationType}</span>
                      <span className="text-slate-400 font-mono-numbers">{new Date(log.createdAt).toLocaleString('az-AZ')}</span>
                    </div>
                    <p className="text-slate-700 font-medium">Status: {log.status}</p>
                    <div className="mt-2 text-[10px] text-slate-500 font-mono bg-slate-50 p-2 rounded border border-slate-100 truncate">
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
          <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 text-xs">
              <div className="flex items-start justify-between pb-4 border-b border-slate-200">
                <div>
                  <span className="font-extrabold text-emerald-900 font-mono-numbers text-sm">
                    {reviewApp.referenceNumber}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">{reviewApp.competition?.title}</h3>
                </div>
                <button
                  onClick={() => setReviewApp(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Applicant proposal details */}
              <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase block">Ərizəçi</span>
                    <strong className="text-slate-900">{reviewApp.user?.firstName} {reviewApp.user?.lastName} ({reviewApp.user?.email})</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase block">Təklif Olunan Sərmayə</span>
                    <strong className="text-emerald-900 font-mono-numbers text-sm">{reviewApp.proposedInvestmentAmount.toLocaleString()} AZN</strong>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] uppercase block">Biznes Plan Xülasəsi</span>
                  <p className="text-slate-800 leading-relaxed mt-1 bg-white p-3 rounded border border-slate-200">
                    {reviewApp.businessPlanSummary}
                  </p>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] uppercase block">Yüklənmiş Sənədlər</span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {reviewApp.documents?.map(d => (
                      <span key={d.id} className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 font-medium">
                        📄 {d.fileName}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Status Update & Decision Section */}
              <div className="mt-6 p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-4">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  İnzibatçı Qərarı və Status Keçidi
                </h4>

                {statusUpdateError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                    {statusUpdateError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Yeni Status</label>
                    <select
                      value={newStatus}
                      onChange={e => setNewStatus(e.target.value as any)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-slate-900"
                    >
                      <option value="RECEIVED">Qəbul edilib (RECEIVED)</option>
                      <option value="UNDER_REVIEW">Baxılır (UNDER_REVIEW)</option>
                      <option value="ADDITIONAL_INFORMATION_REQUIRED">Əlavə məlumat tələb olunur</option>
                      <option value="DECIDED">Yekun qərar verildi (DECIDED)</option>
                    </select>
                  </div>

                  {newStatus === 'DECIDED' && (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Qərar Nəticəsi *</label>
                      <select
                        value={decisionOutcome}
                        onChange={e => setDecisionOutcome(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-slate-900 font-bold"
                      >
                        <option value="NONE">Seçin...</option>
                        <option value="APPROVED">Müsabiqə Qalibi (TƏSDİQLƏNDİ)</option>
                        <option value="REJECTED">Müsabiqədən İmtina Edildi (RƏDD)</option>
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">İnzibatçı / Ekspertiza Rəsmi Rəyi</label>
                  <textarea
                    rows={3}
                    value={adminComment}
                    onChange={e => setAdminComment(e.target.value)}
                    placeholder="Müraciət statusunun dəyişdirilməsi səbəbini və komissiya protokol qeydini yazın..."
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-slate-900"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInfoReqBox(!showInfoReqBox)}
                    className="text-xs font-semibold text-indigo-700 hover:underline"
                  >
                    + Sahibkardan rəsmi əlavə məlumat tələb et
                  </button>

                  <button
                    type="button"
                    onClick={handleStatusChangeSubmit}
                    className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg shadow-xs transition-colors"
                  >
                    Statusu Saxla və Sahibkarı Bildir
                  </button>
                </div>

                {/* Additional info request input box */}
                {showInfoReqBox && (
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2 mt-2">
                    <label className="block font-semibold text-indigo-900">Tələb olunan sənəd və ya məlumatın mətni:</label>
                    <input
                      type="text"
                      value={infoReqMsg}
                      onChange={e => setInfoReqMsg(e.target.value)}
                      placeholder="Məs: Suvarma texniki şərtini təqdim edin..."
                      className="w-full bg-white border border-indigo-200 rounded p-2 text-slate-900"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleSendInfoRequest}
                        className="px-3 py-1 bg-indigo-800 text-white rounded font-bold text-xs"
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
          <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-xs">
              <h3 className="text-base font-bold text-slate-900 mb-4">Yeni Torpaq Massivi Əlavə Et</h3>
              <form onSubmit={handleCreateLand} className="space-y-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Massivin Adı</label>
                  <input
                    type="text"
                    required
                    value={newLandTitle}
                    onChange={e => setNewLandTitle(e.target.value)}
                    placeholder="Məs: Ağdam Sarıcalı Əkin Sahəsi"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Region</label>
                    <select
                      value={newLandRegion}
                      onChange={e => setNewLandRegion(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900"
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
                    <label className="block font-semibold text-slate-700 mb-1">Sahə (hektar)</label>
                    <input
                      type="number"
                      required
                      value={newLandArea}
                      onChange={e => setNewLandArea(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Aqrar Sektor</label>
                    <select
                      value={newLandSector}
                      onChange={e => setNewLandSector(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900"
                    >
                      <option value="Əkinçilik">Əkinçilik</option>
                      <option value="Bağçılıq">Bağçılıq</option>
                      <option value="İstixana təsərrüfatı">İstixana</option>
                      <option value="Heyvandarlıq">Heyvandarlıq</option>
                      <option value="Arıçılıq">Arıçılıq</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Minimal Sərmayə (AZN)</label>
                    <input
                      type="number"
                      required
                      value={newLandInvestment}
                      onChange={e => setNewLandInvestment(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Təyinat</label>
                  <input
                    type="text"
                    required
                    value={newLandUse}
                    onChange={e => setNewLandUse(e.target.value)}
                    placeholder="Məs: Buğda və arpa əkini"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Təsvir</label>
                  <textarea
                    rows={2}
                    value={newLandDesc}
                    onChange={e => setNewLandDesc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowLandModal(false)}
                    className="px-4 py-2 bg-slate-100 rounded-lg font-semibold"
                  >
                    Ləğv et
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-800 text-white rounded-lg font-bold"
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
          <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-xs">
              <h3 className="text-base font-bold text-slate-900 mb-4">Yeni İnvestisiya Müsabiqəsi Elan Et</h3>
              <form onSubmit={handleCreateCompetition} className="space-y-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Müsabiqənin Başlığı</label>
                  <input
                    type="text"
                    required
                    value={newCompTitle}
                    onChange={e => setNewCompTitle(e.target.value)}
                    placeholder="Məs: Füzuli Bağçılıq Müsabiqəsi"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Əlaqəli Torpaq Sahəsi</label>
                  <select
                    value={newCompLandId}
                    onChange={e => setNewCompLandId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900"
                  >
                    {lands.map(l => (
                      <option key={l.id} value={l.id}>{l.title} ({l.region}, {l.areaHectares} ha)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Son Müraciət Tarixi</label>
                  <input
                    type="date"
                    required
                    value={newCompDeadline}
                    onChange={e => setNewCompDeadline(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Təsvir və Hədəf</label>
                  <textarea
                    rows={2}
                    value={newCompDesc}
                    onChange={e => setNewCompDesc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCompModal(false)}
                    className="px-4 py-2 bg-slate-100 rounded-lg font-semibold"
                  >
                    Ləğv et
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-800 text-white rounded-lg font-bold"
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
