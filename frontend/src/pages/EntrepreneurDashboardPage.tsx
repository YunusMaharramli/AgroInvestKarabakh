import React, { useState, useEffect, useRef } from 'react';
import { Application, Favorite, Notification } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { useFavorites } from '../context/FavoritesContext.js';
import { FileText, Heart, Bell, User, AlertTriangle, Send, X, ArrowRight, Check, Search, Phone } from 'lucide-react';
import { landImage, formatManat, formatDateAz } from '../lib/landImages.js';
import { statusInfo, STATUS_STEPS } from '../lib/applicationStatus.js';
import { HELP_LINE } from '../components/Header.js';

interface EntrepreneurDashboardPageProps {
  navigate: (route: string) => void;
}

type Tab = 'applications' | 'favorites' | 'notifications' | 'profile';

const fieldClass =
  'w-full min-h-[3.25rem] px-4 rounded-xl border-2 border-[#9AA89E] bg-white text-ink text-lg focus:border-brand-700';

/** Three-step progress: Göndərildi → Yoxlanılır → Qərar verildi */
const StatusSteps: React.FC<{ app: Application }> = ({ app }) => {
  const info = statusInfo(app);
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Müraciətin mərhələləri">
      {STATUS_STEPS.map((s, i) => {
        const done = i < info.step || (i === info.step && info.step === 2);
        const current = i === info.step;
        return (
          <li key={s} className="flex flex-col gap-1.5" aria-current={current ? 'step' : undefined}>
            <span className={`h-2.5 rounded-full ${i <= info.step ? 'bg-brand-700' : 'bg-sand'}`} />
            <span className={`text-sm leading-tight ${current ? 'font-extrabold text-ink' : 'text-muted'}`}>
              {done && !current ? '✓ ' : ''}{s}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

export const EntrepreneurDashboardPage: React.FC<EntrepreneurDashboardPageProps> = ({ navigate }) => {
  const { user, profile, token, isLoading: authLoading, updateProfile } = useAuth();
  const { toggleFavorite } = useFavorites();
  const [activeTab, setActiveTab] = useState<Tab>('applications');
  const [applications, setApplications] = useState<Application[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [infoResponseText, setInfoResponseText] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [responseSent, setResponseSent] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editTin, setEditTin] = useState('');
  const [editActivity, setEditActivity] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
    if (authLoading) return;
    if (!user) { navigate('/login?next=%2Fdashboard'); return; }
    if (user.role === 'ADMIN') { navigate('/admin'); return; }
    loadData();
  }, [user, authLoading]);

  // Dialog: close with Escape, stop the page behind from scrolling
  useEffect(() => {
    if (!selectedApp) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedApp(null); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    closeBtnRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [selectedApp?.id]);

  const openApp = (app: Application) => {
    setResponseSent(false);
    setInfoResponseText('');
    setSelectedApp(app);
  };

  const handleInfoResponseSubmit = async (requestId: string) => {
    if (!infoResponseText.trim() || !selectedApp) return;
    setSubmittingResponse(true);
    try {
      const res = await fetch(`/api/applications/${selectedApp.id}/respond-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ requestId, responseText: infoResponseText }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedApp(data.application);
        setInfoResponseText('');
        setResponseSent(true);
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

  const needAction = applications.filter(a => a.status === 'ADDITIONAL_INFORMATION_REQUIRED');
  const unread = notifications.filter(n => !n.isRead).length;

  const TABS: { id: Tab; label: string; Icon: React.FC<any>; count?: number; dot?: boolean }[] = [
    { id: 'applications', label: 'Müraciətlərim', Icon: FileText, count: applications.length },
    { id: 'favorites', label: 'Yadda saxladıqlarım', Icon: Heart, count: favorites.length },
    { id: 'notifications', label: 'Bildirişlər', Icon: Bell, count: unread || undefined, dot: unread > 0 },
    { id: 'profile', label: 'Məlumatlarım', Icon: User },
  ];

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
          <button
            type="button"
            onClick={() => navigate('/opportunities')}
            className="min-h-14 px-6 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-display font-bold flex items-center gap-2"
          >
            <Search className="w-5 h-5" aria-hidden="true" />
            Yeni sahə axtar
          </button>
        </div>

        {/* What needs doing: shown first, in red */}
        {needAction.length > 0 && (
          <div role="alert" className="mb-6 p-5 rounded-2xl bg-[#FCEBE8] border-2 border-[#C0392B] flex flex-col sm:flex-row sm:items-center gap-4">
            <AlertTriangle className="w-8 h-8 text-[#C0392B] shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-display font-extrabold text-xl text-[#7A1F14]">Sizdən cavab gözlənilir</p>
              <p className="text-base text-[#7A1F14]">
                Komissiya {needAction.length === 1 ? 'bir müraciətiniz' : `${needAction.length} müraciətiniz`} üzrə əlavə məlumat istəyir.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setActiveTab('applications'); openApp(needAction[0]); }}
              className="min-h-14 px-6 rounded-xl bg-[#C0392B] hover:bg-[#A93226] text-white font-display font-bold flex items-center justify-center gap-2"
            >
              İndi cavab yazın
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Big tabs */}
        <div role="tablist" aria-label="Kabinet bölmələri" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-6">
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

        <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
          {loading && <p className="text-lg" role="status">Yüklənir…</p>}

          {/* APPLICATIONS */}
          {!loading && activeTab === 'applications' && (
            applications.length === 0 ? (
              <div className="text-center py-14 px-6 bg-white rounded-3xl border border-line">
                <p className="font-display font-extrabold text-2xl text-brand-900">Hələ müraciətiniz yoxdur</p>
                <p className="text-lg text-muted mt-2">Bəyəndiyiniz sahəni seçin və “Müraciət edin” düyməsini basın.</p>
                <button type="button" onClick={() => navigate('/opportunities')} className="mt-6 min-h-14 px-7 rounded-xl bg-brand-700 text-white font-display font-bold hover:bg-brand-800">
                  Torpaq sahələrinə baxın
                </button>
              </div>
            ) : (
              <ul className="flex flex-col gap-5">
                {applications.map(app => {
                  const info = statusInfo(app);
                  return (
                    <li key={app.id} className={`bg-white rounded-3xl border-2 p-5 sm:p-6 ${info.needsAction ? 'border-[#C0392B]' : 'border-line'}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base text-muted">
                            № <span className="font-bold text-ink">{app.referenceNumber}</span> · {formatDateAz(app.submittedAt)}
                          </p>
                          <h2 className="font-display font-extrabold text-xl leading-snug text-brand-900 mt-1">
                            {app.competition?.title || app.land?.title}
                          </h2>
                          {app.land?.region && <p className="text-base text-[#3E4F45]">{app.land.region}</p>}
                        </div>
                        <span className={`font-display font-extrabold text-base px-4 py-2 rounded-full ${info.badge}`}>{info.label}</span>
                      </div>
                      <div className="mt-5"><StatusSteps app={app} /></div>
                      <p className="mt-4 text-lg">{info.explain}</p>
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => openApp(app)}
                          className={`min-h-14 px-6 rounded-xl font-display font-bold flex items-center gap-2 ${
                            info.needsAction ? 'bg-[#C0392B] hover:bg-[#A93226] text-white' : 'bg-brand-700 hover:bg-brand-800 text-white'
                          }`}
                        >
                          {info.needsAction ? 'Cavab yazın' : 'Ətraflı baxın'}
                          <ArrowRight className="w-5 h-5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          )}

          {/* FAVORITES */}
          {!loading && activeTab === 'favorites' && (
            favorites.length === 0 ? (
              <div className="text-center py-14 px-6 bg-white rounded-3xl border border-line">
                <p className="font-display font-extrabold text-2xl text-brand-900">Yadda saxlanmış sahə yoxdur</p>
                <p className="text-lg text-muted mt-2">Sahələrin üzərindəki “Yadda saxla” düyməsini basın — burada görünəcək.</p>
              </div>
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
                        <button type="button" onClick={() => navigate(`/opportunities/${fav.landId}`)} className="flex-1 min-h-14 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-display font-bold flex items-center justify-center gap-2">
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
              <p className="text-lg text-muted mt-1 mb-6">Bu məlumatlar müraciət formalarına avtomatik yazılır.</p>
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
                  <input id="p-phone" type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} className={fieldClass} />
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

        {/* APPLICATION DETAILS DIALOG */}
        {selectedApp && (() => {
          const info = statusInfo(selectedApp);
          const pendingReq = selectedApp.infoRequests?.find(r => r.status === 'PENDING');
          return (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setSelectedApp(null)}>
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="app-dialog-title"
                className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-base text-muted">Müraciət № <strong className="text-ink">{selectedApp.referenceNumber}</strong></p>
                    <h2 id="app-dialog-title" className="font-display font-extrabold text-2xl leading-snug text-brand-900 mt-1">
                      {selectedApp.competition?.title || selectedApp.land?.title}
                    </h2>
                  </div>
                  <button
                    ref={closeBtnRef}
                    type="button"
                    onClick={() => setSelectedApp(null)}
                    className="shrink-0 min-h-12 px-3 rounded-xl border-2 border-line font-bold flex items-center gap-1.5 hover:border-brand-900"
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                    Bağla
                  </button>
                </div>

                <div className="mt-5 p-5 rounded-2xl bg-cream border border-line">
                  <span className={`inline-block font-display font-extrabold text-base px-4 py-2 rounded-full ${info.badge}`}>{info.label}</span>
                  <div className="mt-4"><StatusSteps app={selectedApp} /></div>
                  <p className="mt-4 text-lg">{info.explain}</p>
                  {selectedApp.adminDecisionNote && (
                    <p className="mt-3 text-lg bg-white p-4 rounded-xl border border-line">
                      <strong>Komissiyanın qeydi:</strong> {selectedApp.adminDecisionNote}
                    </p>
                  )}
                </div>

                {responseSent && (
                  <div role="status" className="mt-5 p-4 rounded-xl bg-brand-50 border-2 border-brand-700 text-brand-900 text-lg flex gap-2">
                    <Check className="w-6 h-6 shrink-0" aria-hidden="true" />
                    Cavabınız göndərildi. Təşəkkür edirik!
                  </div>
                )}

                {selectedApp.status === 'ADDITIONAL_INFORMATION_REQUIRED' && pendingReq && (
                  <div className="mt-5 p-5 rounded-2xl border-2 border-[#C0392B] bg-[#FCEBE8]/40">
                    <p className="font-display font-extrabold text-xl text-[#7A1F14]">Komissiyanın sualı</p>
                    <p className="text-lg mt-2">{pendingReq.message}</p>
                    <label htmlFor="info-reply" className="block font-bold text-lg mt-5 mb-2">Cavabınız</label>
                    <textarea
                      id="info-reply"
                      rows={4}
                      value={infoResponseText}
                      onChange={e => setInfoResponseText(e.target.value)}
                      className={`${fieldClass} py-3`}
                    />
                    <button
                      type="button"
                      disabled={submittingResponse || !infoResponseText.trim()}
                      onClick={() => handleInfoResponseSubmit(pendingReq.id)}
                      className="mt-4 min-h-14 px-7 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-display font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-5 h-5" aria-hidden="true" />
                      {submittingResponse ? 'Göndərilir…' : 'Cavabı göndər'}
                    </button>
                  </div>
                )}

                <dl className="mt-6 grid sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-line">
                    <dt className="text-base text-muted">Təklif etdiyiniz məbləğ</dt>
                    <dd className="font-extrabold text-xl">{formatManat(selectedApp.proposedInvestmentAmount)}</dd>
                  </div>
                  <div className="p-4 rounded-xl border border-line">
                    <dt className="text-base text-muted">İcra müddəti</dt>
                    <dd className="font-extrabold text-xl">{selectedApp.estimatedImplementationPeriod || '—'}</dd>
                  </div>
                </dl>

                {selectedApp.statusHistory && selectedApp.statusHistory.length > 0 && (
                  <section className="mt-6">
                    <h3 className="font-display font-extrabold text-xl text-brand-900 mb-3">Nə vaxt nə baş verib</h3>
                    <ol className="flex flex-col gap-4 border-l-4 border-brand-100 ml-2 pl-5">
                      {selectedApp.statusHistory.map(hist => (
                        <li key={hist.id} className="relative">
                          <span className="absolute -left-[1.85rem] top-1.5 w-4 h-4 rounded-full bg-brand-700 ring-4 ring-white" aria-hidden="true" />
                          <p className="text-base text-muted">{formatDateAz(hist.createdAt)}</p>
                          <p className="text-lg">{hist.comment}</p>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                {selectedApp.documents && selectedApp.documents.length > 0 && (
                  <section className="mt-6">
                    <h3 className="font-display font-extrabold text-xl text-brand-900 mb-3">Göndərdiyiniz sənədlər</h3>
                    <ul className="flex flex-col gap-2">
                      {selectedApp.documents.map(doc => (
                        <li key={doc.id} className="flex items-center gap-3 p-3 rounded-xl border border-line text-base">
                          <FileText className="w-5 h-5 text-brand-700 shrink-0" aria-hidden="true" />
                          <span className="font-bold break-all">{doc.fileName}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
