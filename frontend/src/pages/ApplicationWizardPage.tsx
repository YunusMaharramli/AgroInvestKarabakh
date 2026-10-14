import React, { useState, useEffect } from 'react';
import { Competition, Application } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { CheckCircle2, ArrowRight, ArrowLeft, Upload, FileText, Trash2, ShieldCheck, AlertCircle } from 'lucide-react';

interface ApplicationWizardPageProps {
  competitionId: string;
  navigate: (route: string) => void;
}

export const ApplicationWizardPage: React.FC<ApplicationWizardPageProps> = ({ competitionId, navigate }) => {
  const { user, profile, token } = useAuth();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submittedApp, setSubmittedApp] = useState<Application | null>(null);

  // Form Fields
  const [applicantName, setApplicantName] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [applicantPhone, setApplicantPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [taxNumber, setTaxNumber] = useState('');

  const [proposedAmount, setProposedAmount] = useState<number>(0);
  const [implementationPeriod, setImplementationPeriod] = useState('24 ay');
  const [businessPlanSummary, setBusinessPlanSummary] = useState('');

  // Uploaded documents
  const [uploadedDocs, setUploadedDocs] = useState<{ fileName: string; mimeType: string; fileSize: number; fileData?: string }[]>([]);

  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    setApplicantName(`${user.firstName} ${user.lastName}`);
    setApplicantEmail(user.email);
    setApplicantPhone(user.phone || '');
    if (profile) {
      setCompanyName(profile.companyName || '');
      setTaxNumber(profile.taxIdentificationNumber || '');
    }

    fetch(`/api/competitions/${competitionId}`)
      .then(res => res.json())
      .then(data => {
        setCompetition(data);
        if (data.land) {
          setProposedAmount(data.land.estimatedInvestmentRequirement || 500000);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [competitionId, user]);

  const handleSimulatedFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // 15MB limit
      if (file.size > 15 * 1024 * 1024) {
        alert('Faylın həcmi 15MB-dan artıq ola bilməz.');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setUploadedDocs(prev => [
          ...prev,
          {
            fileName: file.name,
            mimeType: file.type || 'application/pdf',
            fileSize: file.size,
            fileData: (reader.result as string)?.slice(0, 100), // snippet for demo storage
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeDoc = (index: number) => {
    setUploadedDocs(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!termsAccepted) {
      setErrorMessage('Məlumatların düzgünlüyünü təsdiq etməlisiniz.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          competitionId,
          proposedInvestmentAmount: Number(proposedAmount),
          businessPlanSummary,
          estimatedImplementationPeriod: implementationPeriod,
          documents: uploadedDocs,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Müraciət göndərilərkən xəta baş verdi.');
      } else {
        setSubmittedApp(data);
      }
    } catch (e) {
      setErrorMessage('Şəbəkə bağlantısında problem yarandı.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-xs text-slate-500">
        Müsabiqə məlumatları yüklənir...
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-bold text-slate-900">Müsabiqə tapılmadı</h2>
        <button onClick={() => navigate('/opportunities')} className="mt-4 px-4 py-2 bg-emerald-800 text-white rounded-lg text-xs">
          Kataloqa qayıt
        </button>
      </div>
    );
  }

  // SUCCESS CONFIRMATION SCREEN
  if (submittedApp) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] py-16">
        <div className="max-w-xl mx-auto px-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-800">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
              Müraciət Uğurla Qəbul Edildi!
            </span>

            <h1 className="text-2xl font-black text-slate-900 mt-1">
              {submittedApp.referenceNumber}
            </h1>

            <p className="text-xs text-slate-600 mt-3 leading-relaxed">
              Müraciətiniz qeydiyyata alındı və baxılma mərhələsinə göndərildi. Nəticələr və ekspert qeydləri şəxsi kabinetinizdə yenilənəcəkdir.
            </p>

            <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Müsabiqə:</span>
                <span className="font-semibold text-slate-800 truncate max-w-[240px]">{competition.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Region və Sahə:</span>
                <span className="font-semibold text-slate-800">{competition.land?.region} ({competition.land?.areaHectares} ha)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Təklif edilən investisiya:</span>
                <span className="font-bold text-emerald-900 font-mono-numbers">{submittedApp.proposedInvestmentAmount.toLocaleString()} AZN</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-emerald-800">Qəbul edilib (RECEIVED)</span>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex-1 py-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                Müraciətlərimə Keçid
              </button>
              <button
                onClick={() => navigate('/opportunities')}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Kataloqa Qayıt
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Breadcrumb */}
        <div className="mb-8">
          <button
            onClick={() => navigate(`/opportunities/${competition.landId}`)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Müsabiqə səhifəsinə qayıt</span>
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Elektron İnvestisiya Müraciəti
          </h1>
          <p className="text-xs text-slate-500 mt-1">{competition.title}</p>
        </div>

        {/* Step Indicator */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-8 shadow-xs">
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            {[
              { num: 1, label: 'Ərizəçi' },
              { num: 2, label: 'Müsabiqə' },
              { num: 3, label: 'İnvestisiya' },
              { num: 4, label: 'Sənədlər' },
              { num: 5, label: 'Təsdiq' },
            ].map(s => (
              <div
                key={s.num}
                className={`py-2 px-1 rounded-lg border font-semibold transition-colors ${
                  currentStep === s.num
                    ? 'bg-emerald-800 text-white border-emerald-800'
                    : currentStep > s.num
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-slate-50 text-slate-400 border-slate-100'
                }`}
              >
                <span className="block text-[10px] font-mono-numbers">0{s.num}</span>
                <span className="truncate block">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {errorMessage}
          </div>
        )}

        {/* STEP 1: APPLICANT INFO */}
        {currentStep === 1 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4 text-xs">
            <h2 className="text-base font-bold text-slate-900">Addım 1: Ərizəçi və Təsərrüfat Məlumatları</h2>
            <p className="text-slate-500">Müraciət edən şəxsin və ya şirkətin rəsmi rekvizitləri</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Məsul şəxsin tam adı</label>
                <input
                  type="text"
                  required
                  value={applicantName}
                  onChange={e => setApplicantName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Elektron poçt</label>
                <input
                  type="email"
                  required
                  disabled
                  value={applicantEmail}
                  className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2.5 text-slate-600 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Telefon nömrəsi</label>
                <input
                  type="text"
                  required
                  value={applicantPhone}
                  onChange={e => setApplicantPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Şirkət / Təsərrüfat adı</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Məs: Qarabağ Aqro Park MMC"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Vergi Ödəyicisinin Eyniləşdirmə Nömrəsi (VÖEN)</label>
                <input
                  type="text"
                  value={taxNumber}
                  onChange={e => setTaxNumber(e.target.value)}
                  placeholder="1402398111"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <span>Növbəti</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: COMPETITION SELECTION */}
        {currentStep === 2 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4 text-xs">
            <h2 className="text-base font-bold text-slate-900">Addım 2: Müsabiqə və Torpaq Sahəsi Şərtləri</h2>
            <p className="text-slate-500">Müraciət etdiyiniz dövlət torpaq fondu massivi haqqında məlumat</p>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                <span className="text-slate-500">Müsabiqə:</span>
                <span className="font-bold text-slate-900">{competition.title}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                <span className="text-slate-500">Torpaq sahəsi:</span>
                <span className="font-semibold text-slate-800">{competition.land?.title}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                <span className="text-slate-500">Region və Sahə:</span>
                <span className="font-semibold text-slate-800">{competition.land?.region} ({competition.land?.areaHectares} ha)</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                <span className="text-slate-500">Son müraciət tarixi:</span>
                <span className="font-bold text-emerald-800 font-mono-numbers">
                  {new Date(competition.applicationDeadline).toLocaleDateString('az-AZ')}
                </span>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold"
              >
                Geri
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <span>Növbəti</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: INVESTMENT PROPOSAL */}
        {currentStep === 3 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4 text-xs">
            <h2 className="text-base font-bold text-slate-900">Addım 3: İnvestisiya Təklifi və Biznes Plan Xülasəsi</h2>
            <p className="text-slate-500">Layihənin büdcəsi və aqro-texnoloji icra planı</p>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Təklif edilən investisiya məbləği (AZN) *
                </label>
                <input
                  type="number"
                  required
                  value={proposedAmount}
                  onChange={e => setProposedAmount(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-mono-numbers text-sm font-bold"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Tələb olunan minimal həcm: {competition.land?.estimatedInvestmentRequirement?.toLocaleString()} AZN
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  İcra və tam istismara verilmə müddəti
                </label>
                <select
                  value={implementationPeriod}
                  onChange={e => setImplementationPeriod(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900"
                >
                  <option value="12 ay">12 ay (1 il)</option>
                  <option value="18 ay">18 ay (1.5 il)</option>
                  <option value="24 ay">24 ay (2 il)</option>
                  <option value="36 ay">36 ay (3 il)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Biznes plan və aqro-texnoloji layihə xülasəsi *
                </label>
                <textarea
                  rows={5}
                  required
                  value={businessPlanSummary}
                  onChange={e => setBusinessPlanSummary(e.target.value)}
                  placeholder="Əkiləcək bitki və ya heyvandarlıq növü, tətbiq olunacaq suvarma texnologiyası, planlaşdırılan yeni iş yerlərinin sayı və satış bazarı barədə ətraflı məlumat verin..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 leading-relaxed"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold"
              >
                Geri
              </button>
              <button
                type="button"
                disabled={!proposedAmount || !businessPlanSummary.trim()}
                onClick={() => setCurrentStep(4)}
                className="px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <span>Növbəti</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: DOCUMENT UPLOAD */}
        {currentStep === 4 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4 text-xs">
            <h2 className="text-base font-bold text-slate-900">Addım 4: Təsdiqedici Sənədlərin Yüklənməsi</h2>
            <p className="text-slate-500">Biznes Plan, TİƏ, bank zəmanəti və nizamnamə sənədlərini PDF formatında əlavə edin</p>

            {/* Dropzone */}
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50/50 hover:bg-emerald-50/30 transition-colors">
              <Upload className="w-8 h-8 text-emerald-800 mx-auto mb-2" />
              <label className="cursor-pointer">
                <span className="text-emerald-800 font-bold hover:underline">Fayl seçin</span>
                <span className="text-slate-500"> və ya bura sürükləyin</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleSimulatedFileUpload}
                  className="hidden"
                />
              </label>
              <p className="text-[11px] text-slate-400 mt-1">Yalnız PDF və DOCX formatları (Maksimal həcm: 15MB)</p>
            </div>

            {/* Uploaded files list */}
            {uploadedDocs.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="font-semibold text-slate-800 block">Əlavə olunmuş sənədlər ({uploadedDocs.length}):</span>
                {uploadedDocs.map((doc, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-800" />
                      <span className="font-semibold text-slate-800">{doc.fileName}</span>
                      <span className="text-slate-400 font-mono-numbers">({Math.round(doc.fileSize / 1024)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDoc(i)}
                      className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-6 border-t border-slate-100 flex justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold"
              >
                Geri
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                className="px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <span>Yoxlama Mərhələsinə Keç</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: REVIEW & CONFIRM */}
        {currentStep === 5 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6 text-xs">
            <div>
              <h2 className="text-base font-bold text-slate-900">Addım 5: Yekun Yoxlama və Rəsmi Təqdimat</h2>
              <p className="text-slate-500 mt-0.5">Zəhmət olmasa təqdim ediləcək bütün məlumatların dəqiqliyini təsdiq edin</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="grid grid-cols-2 gap-4 border-b border-slate-200/60 pb-3">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Ərizəçi:</span>
                  <strong className="text-slate-900">{applicantName} ({companyName || 'Fərdi'})</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Əlaqə:</span>
                  <span className="text-slate-700">{applicantPhone} · {applicantEmail}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b border-slate-200/60 pb-3">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Müsabiqə Sahəsi:</span>
                  <strong className="text-slate-900">{competition.land?.title}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Region və Sahə:</span>
                  <span className="text-slate-700">{competition.land?.region} ({competition.land?.areaHectares} ha)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b border-slate-200/60 pb-3">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Təklif Edilən İnvestisiya:</span>
                  <strong className="text-emerald-900 font-mono-numbers text-sm">{proposedAmount.toLocaleString()} AZN</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">İcra Müddəti:</span>
                  <span className="text-slate-700">{implementationPeriod}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Biznes Plan Xülasəsi:</span>
                <p className="text-slate-800 leading-relaxed mt-1 bg-white p-3 rounded-lg border border-slate-200">
                  {businessPlanSummary}
                </p>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Qoşulmuş Sənədlər:</span>
                <span className="text-slate-700 font-medium">{uploadedDocs.length} ədəd sənəd əlavə olunub</span>
              </div>
            </div>

            {/* Declaration Checkbox */}
            <label className="flex items-start gap-2.5 p-3.5 bg-emerald-50 rounded-xl border border-emerald-200/60 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={e => setTermsAccepted(e.target.checked)}
                className="mt-0.5 rounded text-emerald-800 focus:ring-emerald-700"
              />
              <span className="text-slate-800 leading-relaxed">
                Təqdim etdiyim məlumatların və sənədlərin tamlığını, doğruluğunu təsdiq edirəm və investisiya müsabiqəsinin qaydaları ilə razıyam.
              </span>
            </label>

            <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold"
              >
                Geri
              </button>
              <button
                type="button"
                disabled={submitting || !termsAccepted}
                onClick={handleSubmit}
                className="px-6 py-3 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl shadow-md transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <span>Təsdiqlənir və Göndərilir...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Müraciəti Rəsmi Göndər</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
