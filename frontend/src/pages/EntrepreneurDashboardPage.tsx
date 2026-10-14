import React, { useState, useEffect } from 'react';
import { Application, Favorite, Notification } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { LayoutDashboard, FileText, Heart, Bell, User, Clock, CheckCircle, AlertTriangle, Send, Eye, X, ArrowRight, ExternalLink } from 'lucide-react';

interface EntrepreneurDashboardPageProps {
  navigate: (route: string) => void;
}

export const EntrepreneurDashboardPage: React.FC<EntrepreneurDashboardPageProps> = ({ navigate }) => {
  const { user, profile, token, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'applications' | 'favorites' | 'notifications' | 'profile'>('overview');
  const [applications, setApplications] = useState<Application[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected application for detail modal
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [infoResponseText, setInfoResponseText] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);

  // Profile edit states
  const [editFirstName, setEditFirstName] = useState(user?.firstName || '');
  const [editLastName, setEditLastName] = useState(user?.lastName || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editCompanyName, setEditCompanyName] = useState(profile?.companyName || '');
  const [editTin, setEditTin] = useState(profile?.taxIdentificationNumber || '');
  const [editActivity, setEditActivity] = useState(profile?.businessActivity || '');
  const [profileMsg, setProfileMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const [appsRes, favsRes, notifsRes] = await Promise.all([
        fetch('/api/applications/my', { headers }),
        fetch('/api/favorites', { headers }),
        fetch('/api/notifications', { headers }),
      ]);

      if (appsRes.ok) setApplications(await appsRes.json());
      if (favsRes.ok) setFavorites(await favsRes.json());
      if (notifsRes.ok) setNotifications(await notifsRes.json());
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const handleInfoResponseSubmit = async (requestId: string) => {
    if (!infoResponseText.trim() || !selectedApp) return;
    setSubmittingResponse(true);

    try {
      const res = await fetch(`/api/applications/${selectedApp.id}/respond-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          requestId,
          responseText: infoResponseText,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSelectedApp(data.application);
        setInfoResponseText('');
        loadData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    const res = await updateProfile({
      firstName: editFirstName,
      lastName: editLastName,
      phone: editPhone,
      companyName: editCompanyName,
      taxIdentificationNumber: editTin,
      businessActivity: editActivity,
    });
    if (res.success) {
      setProfileMsg('Profil məlumatları uğurla yeniləndi.');
    } else {
      setProfileMsg(res.error || 'Yenilənmədi.');
    }
  };

  // Status badge styling helper
  const renderStatus = (status: Application['status'], outcome: Application['decisionOutcome']) => {
    if (status === 'DECIDED') {
      if (outcome === 'APPROVED') {
        return <span className="font-bold text-emerald-800">Qəbul edildi (Təsdiqləndi)</span>;
      }
      return <span className="font-bold text-rose-700">İmtina edildi</span>;
    }
    if (status === 'UNDER_REVIEW') {
      return <span className="font-bold text-amber-700">Ekspertizada baxılır</span>;
    }
    if (status === 'ADDITIONAL_INFORMATION_REQUIRED') {
      return <span className="font-bold text-indigo-700">Əlavə məlumat tələb olunur</span>;
    }
    return <span className="font-bold text-slate-700">Qəbul edilib</span>;
  };

  const pendingInfoCount = applications.filter(a => a.status === 'ADDITIONAL_INFORMATION_REQUIRED').length;
  const underReviewCount = applications.filter(a => a.status === 'UNDER_REVIEW').length;
  const decidedCount = applications.filter(a => a.status === 'DECIDED').length;

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top welcome greeting */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
              Sahibkar Şəxsi Kabineti
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
              Xoş gördük, {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-xs text-slate-500">
              {profile?.companyName ? `${profile.companyName} · VÖEN: ${profile.taxIdentificationNumber || '—'}` : 'Fərdi Sahibkar'}
            </p>
          </div>

          <button
            onClick={() => navigate('/opportunities')}
            className="px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
          >
            <span>Yeni Müsabiqə Seç</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Dashboard Layout: Sidebar Navigation + Main Viewport */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="md:col-span-1 space-y-1">
            <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs space-y-1 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('overview')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-colors text-left ${
                  activeTab === 'overview' ? 'bg-emerald-800 text-white' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>İcmal</span>
              </button>

              <button
                onClick={() => setActiveTab('applications')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors text-left ${
                  activeTab === 'applications' ? 'bg-emerald-800 text-white' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4" />
                  <span>Müraciətlərim</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono-numbers ${activeTab === 'applications' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {applications.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('favorites')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors text-left ${
                  activeTab === 'favorites' ? 'bg-emerald-800 text-white' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Heart className="w-4 h-4" />
                  <span>Seçilmişlər</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono-numbers ${activeTab === 'favorites' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {favorites.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('notifications')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors text-left ${
                  activeTab === 'notifications' ? 'bg-emerald-800 text-white' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Bell className="w-4 h-4" />
                  <span>Bildirişlər</span>
                </div>
                {notifications.some(n => !n.isRead) && (
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-colors text-left ${
                  activeTab === 'profile' ? 'bg-emerald-800 text-white' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Müəssisə Profili</span>
              </button>
            </div>
          </div>

          {/* Main Content Viewport */}
          <div className="md:col-span-3">
            {/* 1. OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Stats cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Cəmi Müraciət</span>
                    <span className="text-2xl font-black text-slate-900 font-mono-numbers mt-1 block">
                      {applications.length}
                    </span>
                  </div>

                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">Baxılmada</span>
                    <span className="text-2xl font-black text-amber-700 font-mono-numbers mt-1 block">
                      {underReviewCount}
                    </span>
                  </div>

                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">Əlavə Məlumat Tələbi</span>
                    <span className="text-2xl font-black text-indigo-700 font-mono-numbers mt-1 block">
                      {pendingInfoCount}
                    </span>
                  </div>

                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Qərar Verilmiş</span>
                    <span className="text-2xl font-black text-emerald-800 font-mono-numbers mt-1 block">
                      {decidedCount}
                    </span>
                  </div>
                </div>

                {/* Attention notice if information is requested */}
                {pendingInfoCount > 0 && (
                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-xs flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-indigo-700 shrink-0" />
                      <div>
                        <strong className="text-indigo-900 block">Komissiya tərəfindən əlavə sənəd tələb olunur!</strong>
                        <span className="text-indigo-700">Müraciətinizin icraatını sürətləndirmək üçün zəhmət olmasa cavab təqdim edin.</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('applications')}
                      className="px-3.5 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-semibold whitespace-nowrap"
                    >
                      Cavabla
                    </button>
                  </div>
                )}

                {/* Recent Applications Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">Son Müraciətlər</h3>
                    <button
                      onClick={() => setActiveTab('applications')}
                      className="text-xs font-semibold text-emerald-800 hover:underline"
                    >
                      Hamısına bax
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {applications.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        Hələ heç bir elektron müraciət göndərilməyib.
                      </div>
                    ) : (
                      applications.slice(0, 3).map(app => (
                        <div key={app.id} className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                          <div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                              <span className="font-bold text-slate-900 font-mono-numbers">{app.referenceNumber}</span>
                              <span aria-hidden="true">·</span>
                              <span>{app.land?.region}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-numbers">{new Date(app.submittedAt).toLocaleDateString('az-AZ')}</span>
                            </div>
                            <h4 className="text-xs font-semibold text-slate-800">{app.competition?.title}</h4>
                            <div className="mt-1 text-xs">
                              {renderStatus(app.status, app.decisionOutcome)}
                            </div>
                          </div>

                          <button
                            onClick={() => setSelectedApp(app)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-800 hover:text-white text-slate-800 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 shrink-0"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Statusa bax</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 2. APPLICATIONS TAB */}
            {activeTab === 'applications' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Müraciətlər Siyahısı və Status İzləmə</h3>
                    <p className="text-[11px] text-slate-500">Müraciət tarixçəsi, ekspert qeydləri və yekun qərarlar</p>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {applications.length === 0 ? (
                    <div className="p-12 text-center text-xs text-slate-400">
                      Heç bir müraciət tapılmadı.
                    </div>
                  ) : (
                    applications.map(app => (
                      <div key={app.id} className="p-6 hover:bg-slate-50/50 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                              <span className="font-extrabold text-emerald-950 font-mono-numbers text-sm">
                                {app.referenceNumber}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{app.land?.region}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-numbers">{new Date(app.submittedAt).toLocaleDateString('az-AZ')}</span>
                            </div>

                            <h4 className="text-sm font-bold text-slate-900">{app.competition?.title}</h4>
                            <p className="text-xs text-slate-600 mt-1 line-clamp-2">{app.businessPlanSummary}</p>

                            <div className="mt-3 flex items-center gap-3 text-xs">
                              <div>
                                <span className="text-slate-400">Təklif edilən məbləğ: </span>
                                <strong className="text-slate-900 font-mono-numbers">{app.proposedInvestmentAmount.toLocaleString()} AZN</strong>
                              </div>
                              <span aria-hidden="true">·</span>
                              <div>
                                <span className="text-slate-400">İcra müddəti: </span>
                                <strong className="text-slate-900">{app.estimatedImplementationPeriod}</strong>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col sm:items-end gap-2 shrink-0">
                            <div>{renderStatus(app.status, app.decisionOutcome)}</div>
                            <button
                              onClick={() => setSelectedApp(app)}
                              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Ətraflı Bax</span>
                            </button>
                          </div>
                        </div>

                        {/* If pending information required */}
                        {app.status === 'ADDITIONAL_INFORMATION_REQUIRED' && (
                          <div className="mt-4 p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs">
                            <span className="font-bold text-indigo-900 block mb-1">Komissiyanın rəsmi sorğusu:</span>
                            <p className="text-indigo-800">
                              {app.infoRequests?.find(r => r.status === 'PENDING')?.message || 'Əlavə sənəd tələb olunur.'}
                            </p>
                            <button
                              onClick={() => setSelectedApp(app)}
                              className="mt-2 text-xs font-bold text-indigo-900 underline"
                            >
                              Rəsmi cavab təqdim et
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 3. FAVORITES TAB */}
            {activeTab === 'favorites' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Seçilmiş Torpaq Sahələri</h3>
                {favorites.length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-400">
                    Seçilmişlər siyahısında heç bir torpaq sahəsi yoxdur.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {favorites.map(fav => (
                      <div key={fav.id} className="p-4 rounded-xl border border-slate-200 hover:border-emerald-300 transition-colors flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start">
                            <span className="text-[11px] font-bold text-emerald-800">{fav.land?.region}</span>
                            <span className="text-[11px] text-slate-400 font-mono-numbers">{fav.land?.areaHectares} ha</span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 mt-1">{fav.land?.title}</h4>
                          <p className="text-[11px] text-slate-600 line-clamp-2 mt-1">{fav.land?.description}</p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-bold font-mono-numbers">
                            {fav.land?.estimatedInvestmentRequirement?.toLocaleString()} AZN
                          </span>
                          <button
                            onClick={() => navigate(`/opportunities/${fav.landId}`)}
                            className="px-3 py-1 bg-emerald-800 text-white rounded text-xs font-semibold"
                          >
                            Ətraflı
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 4. NOTIFICATIONS TAB */}
            {activeTab === 'notifications' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Bildirişlər</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">Bildiriş yoxdur.</div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className="p-4 sm:px-6 hover:bg-slate-50 text-xs">
                        <div className="flex items-center justify-between">
                          <strong className="text-slate-900">{n.title}</strong>
                          <span className="text-[10px] text-slate-400 font-mono-numbers">
                            {new Date(n.createdAt).toLocaleDateString('az-AZ')}
                          </span>
                        </div>
                        <p className="text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 5. PROFILE TAB */}
            {activeTab === 'profile' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
                <h3 className="text-sm font-bold text-slate-900 mb-1">Müəssisə və Sahibkar Profili</h3>
                <p className="text-xs text-slate-500 mb-6">Müsabiqə müraciətlərində istifadə olunan rəsmi rekvizitlər</p>

                {profileMsg && (
                  <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                    {profileMsg}
                  </div>
                )}

                <form onSubmit={handleProfileSave} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Ad</label>
                      <input
                        type="text"
                        value={editFirstName}
                        onChange={e => setEditFirstName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Soyad</label>
                      <input
                        type="text"
                        value={editLastName}
                        onChange={e => setEditLastName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Əlaqə Telefonu</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={e => setEditPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Şirkət / Təsərrüfat Adı</label>
                      <input
                        type="text"
                        value={editCompanyName}
                        onChange={e => setEditCompanyName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">VÖEN</label>
                      <input
                        type="text"
                        value={editTin}
                        onChange={e => setEditTin(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Fəaliyyət Sahəsi / İxtisaslaşma</label>
                    <textarea
                      rows={3}
                      value={editActivity}
                      onChange={e => setEditActivity(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900"
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg text-xs transition-colors"
                  >
                    Məlumatları Saxla
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* APPLICATION DETAILS & TIMELINE MODAL */}
        {selectedApp && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 text-xs">
              <div className="flex items-start justify-between pb-4 border-b border-slate-200">
                <div>
                  <span className="font-extrabold text-emerald-900 text-sm font-mono-numbers">
                    {selectedApp.referenceNumber}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">{selectedApp.competition?.title}</h3>
                </div>
                <button
                  onClick={() => setSelectedApp(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Banner */}
              <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Cari Status</span>
                <div className="mt-1 text-sm font-bold">
                  {renderStatus(selectedApp.status, selectedApp.decisionOutcome)}
                </div>
                {selectedApp.adminDecisionNote && (
                  <p className="mt-2 text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
                    <strong>Komissiya qeydi: </strong> {selectedApp.adminDecisionNote}
                  </p>
                )}
              </div>

              {/* Status History Timeline */}
              <div className="mt-6">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-3">
                  Müraciətin Rəsmi İcraat Tarixçəsi
                </h4>
                <div className="space-y-4 border-l-2 border-slate-200 ml-2 pl-4">
                  {selectedApp.statusHistory?.map(hist => (
                    <div key={hist.id} className="relative">
                      <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-700 ring-4 ring-white" />
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono-numbers">
                        <span>{new Date(hist.createdAt).toLocaleString('az-AZ')}</span>
                        <span>·</span>
                        <span className="text-slate-600 font-semibold">{hist.changedBy}</span>
                      </div>
                      <p className="text-slate-800 font-medium mt-0.5">{hist.comment}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional Information Request & Response Form */}
              {selectedApp.status === 'ADDITIONAL_INFORMATION_REQUIRED' && (
                <div className="mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <span className="font-bold text-indigo-900 uppercase tracking-wider text-[11px] block mb-1">
                    Komissiyanın Əlavə Məlumat Tələbi
                  </span>
                  <p className="text-indigo-800 mb-3">
                    {selectedApp.infoRequests?.find(r => r.status === 'PENDING')?.message || 'Zəhmət olmasa tələb olunan məlumatı qeyd edin.'}
                  </p>

                  <div className="space-y-2">
                    <label className="block font-semibold text-slate-700">Rəsmi Cavabınız:</label>
                    <textarea
                      rows={3}
                      value={infoResponseText}
                      onChange={e => setInfoResponseText(e.target.value)}
                      placeholder="Tələb olunan texniki izahat və ya sənəd nömrəsini daxil edin..."
                      className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-slate-900"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={submittingResponse || !infoResponseText.trim()}
                        onClick={() => {
                          const pendingReq = selectedApp.infoRequests?.find(r => r.status === 'PENDING');
                          if (pendingReq) handleInfoResponseSubmit(pendingReq.id);
                        }}
                        className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Cavabı Göndər</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Uploaded Documents List */}
              <div className="mt-6 pt-4 border-t border-slate-100">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2">
                  Təqdim Edilmiş Sənədlər ({selectedApp.documents?.length || 0})
                </h4>
                <div className="space-y-1.5">
                  {selectedApp.documents?.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-800" />
                        <span className="font-semibold text-slate-800">{doc.fileName}</span>
                      </div>
                      <span className="text-slate-400 font-mono-numbers">{Math.round(doc.fileSize / 1024)} KB</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setSelectedApp(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-semibold"
                >
                  Bağla
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
