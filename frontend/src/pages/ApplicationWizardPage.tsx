import React, { useState, useEffect } from 'react';
import { Competition, Application } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import {
  CheckCircle2, ArrowRight, ArrowLeft, Upload, FileText, Trash2, ShieldCheck, AlertCircle, Check, Phone, Info,
} from 'lucide-react';
import { formatManat, formatDateAz } from '../lib/landImages.js';
import { HELP_LINE } from '../components/Header.js';

interface ApplicationWizardPageProps {
  competitionId: string;
  navigate: (route: string) => void;
}

const STEPS = [
  { num: 1, label: 'Sizin məlumatlar' },
  { num: 2, label: 'Torpaq sahəsi' },
  { num: 3, label: 'Təklifiniz' },
  { num: 4, label: 'Sənədlər' },
  { num: 5, label: 'Yoxlayın və göndərin' },
];

const inputClass =
  'w-full min-h-[3.25rem] px-4 rounded-xl border-2 border-[#9AA89E] bg-white text-ink text-base focus:border-brand-700 disabled:bg-[#F1EEE6] disabled:text-muted disabled:cursor-not-allowed';
const labelClass = 'block font-bold mb-2';
const hintClass = 'text-[0.92rem] text-muted mt-1.5';

const BackButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="min-h-14 px-6 rounded-xl border-2 border-brand-900 text-brand-900 font-display font-bold flex items-center justify-center gap-2 hover:bg-brand-50"
  >
    <ArrowLeft className="w-5 h-5" aria-hidden="true" />
    Geri
  </button>
);

const NextButton: React.FC<{ onClick: () => void; disabled?: boolean; children?: React.ReactNode }> = ({ onClick, disabled, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="min-h-14 px-8 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-display font-extrabold text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {children ?? 'Növbəti addım'}
    <ArrowRight className="w-6 h-6" aria-hidden="true" />
  </button>
);

const SummaryRow: React.FC<{ label: string; value: React.ReactNode; onEdit?: () => void }> = ({ label, value, onEdit }) => (
  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-4 border-b border-[#EFE8D6] last:border-0">
    <div className="min-w-0">
      <dt className="text-[0.92rem] text-muted">{label}</dt>
      <dd className="font-bold text-[1.05rem] mt-0.5 break-words">{value}</dd>
    </div>
    {onEdit && (
      <button type="button" onClick={onEdit} className="min-h-11 px-3 font-bold text-brand-700 underline underline-offset-4">
        Dəyiş
      </button>
    )}
  </div>
);

export const ApplicationWizardPage: React.FC<ApplicationWizardPageProps> = ({ competitionId, navigate }) => {
  const { user, profile, token, isLoading: authLoading } = useAuth();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fileError, setFileError] = useState('');
  const [submittedApp, setSubmittedApp] = useState<Application | null>(null);

  const [applicantName, setApplicantName] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [applicantPhone, setApplicantPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [taxNumber, setTaxNumber] = useState('');

  const [proposedAmount, setProposedAmount] = useState<number>(0);
  const [implementationPeriod, setImplementationPeriod] = useState('24 ay');
  const [businessPlanSummary, setBusinessPlanSummary] = useState('');

  const [uploadedDocs, setUploadedDocs] = useState<{ fileName: string; mimeType: string; fileSize: number; fileData?: string }[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    // Wait until the saved login has been checked; otherwise a page reload
    // would send a logged-in person to the login page.
    if (authLoading) return;
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/applications/new/${competitionId}`)}`);
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
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        setCompetition(data);
        if (data?.land) {
          setProposedAmount(data.land.estimatedInvestmentRequirement || 500000);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [competitionId, user, authLoading]);

  const goToStep = (n: number) => {
    setCurrentStep(n);
    setErrorMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setFileError(`"${file.name}" çox böyükdür. Faylın həcmi 15 MB-dan artıq ola bilməz.`);
      e.target.value = '';
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
    e.target.value = ''; // allow choosing the same file name again
  };

  const removeDoc = (index: number) => {
    setUploadedDocs(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!termsAccepted) {
      setErrorMessage('Göndərməzdən əvvəl məlumatların düzgünlüyünü təsdiq edin (aşağıdakı qutunu işarələyin).');
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
        setErrorMessage(data.error || 'Müraciət göndərilərkən xəta baş verdi. Bir az sonra yenidən cəhd edin.');
      } else {
        setSubmittedApp(data);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch {
      setErrorMessage('İnternet bağlantısında problem yarandı. Bağlantını yoxlayıb yenidən "Göndər" düyməsini basın.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-lg text-muted" role="status">
        Müsabiqə məlumatları yüklənir…
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <h1 className="font-display font-extrabold text-2xl text-brand-900">Müsabiqə tapılmadı</h1>
        <p className="text-lg text-muted mt-3">Bu müsabiqə bağlanıb və ya mövcud deyil.</p>
        <button type="button" onClick={() => navigate('/opportunities')} className="mt-8 min-h-14 px-7 rounded-xl bg-brand-700 text-white font-display font-bold">
          Torpaq sahələrinə qayıt
        </button>
      </div>
    );
  }

  const land = competition.land;
  const minRequired = land?.estimatedInvestmentRequirement ?? 0;
  const belowMinimum = minRequired > 0 && proposedAmount > 0 && proposedAmount < minRequired;
  const step1Missing = !applicantName.trim() || !applicantPhone.trim();
  const step3Missing = !proposedAmount || !businessPlanSummary.trim();

  // SUCCESS SCREEN
  if (submittedApp) {
    return (
      <div className="bg-cream py-14">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-3xl border border-line p-8 sm:p-10 text-center" role="status">
            <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-5 text-brand-700">
              <CheckCircle2 className="w-11 h-11" aria-hidden="true" />
            </div>
            <h1 className="font-display font-extrabold text-3xl text-brand-900">Müraciətiniz qəbul edildi</h1>
            <p className="text-lg text-[#3E4F45] mt-3">Müraciət nömrəniz:</p>
            <p className="font-display font-extrabold text-4xl text-brand-900 mt-1 tracking-wide">{submittedApp.referenceNumber}</p>
            <p className="text-base text-muted mt-2">Bu nömrəni yazın və ya ekranın şəklini çəkin. Zəng edəndə lazım olacaq.</p>

            <dl className="mt-7 text-left bg-cream rounded-2xl border border-line px-5">
              <SummaryRow label="Müsabiqə" value={competition.title} />
              <SummaryRow label="Rayon və sahə" value={`${land?.region ?? ''} (${land?.areaHectares ?? ''} ha)`} />
              <SummaryRow label="Təklif etdiyiniz sərmayə" value={formatManat(submittedApp.proposedInvestmentAmount)} />
              <SummaryRow label="Vəziyyəti" value="Qəbul edilib — baxılmağa göndərilib" />
            </dl>

            <p className="text-base text-[#3E4F45] mt-6">
              Nəticə və ekspert qeydləri şəxsi kabinetinizdə görünəcək. Sualınız olsa, zəng edin: <strong>{HELP_LINE}</strong>
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="min-h-14 px-7 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-display font-extrabold"
              >
                Müraciətlərimə baxın
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-14 px-6 rounded-xl border-2 border-brand-900 text-brand-900 font-display font-bold"
              >
                Çap edin
              </button>
              <button
                type="button"
                onClick={() => navigate('/opportunities')}
                className="min-h-14 px-6 rounded-xl border-2 border-line text-brand-900 font-display font-bold"
              >
                Torpaq sahələrinə qayıt
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stepTitle = STEPS[currentStep - 1].label;

  return (
    <div className="bg-cream py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate(`/opportunities/${competition.landId}`)}
          className="inline-flex items-center gap-2 min-h-[3.25rem] px-5 rounded-xl border-2 border-brand-900 text-brand-900 font-display font-bold hover:bg-white mb-6"
        >
          <ArrowLeft className="w-6 h-6" aria-hidden="true" />
          Sahənin səhifəsinə qayıt
        </button>

        <h1 className="font-display font-extrabold text-3xl sm:text-4xl leading-tight text-brand-900">Müraciət forması</h1>
        <p className="text-lg text-[#3E4F45] mt-2">{competition.title}</p>

        {/* Progress */}
        <div className="mt-7 mb-7">
          <p className="font-display font-bold text-lg text-brand-900 mb-3" aria-live="polite">
            Addım {currentStep} / {STEPS.length}: {stepTitle}
          </p>
          <ol className="grid grid-cols-5 gap-2" aria-label="Müraciətin addımları">
            {STEPS.map(s => {
              const done = currentStep > s.num;
              const now = currentStep === s.num;
              return (
                <li key={s.num} aria-current={now ? 'step' : undefined} className="flex flex-col gap-2">
                  <span className={`h-2.5 rounded-full ${done || now ? 'bg-brand-700' : 'bg-line'}`} aria-hidden="true" />
                  <span className={`hidden sm:flex items-center gap-1.5 text-sm ${now ? 'font-bold text-brand-900' : done ? 'text-brand-700' : 'text-muted'}`}>
                    {done && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                    <span className="sr-only">{done ? 'Tamamlanıb: ' : now ? 'İndiki addım: ' : 'Növbəti: '}</span>
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {errorMessage && (
          <div role="alert" className="mb-6 p-5 rounded-2xl bg-[#FDECEA] border-2 border-[#B42318] text-[#7A1A10] flex gap-3 items-start">
            <AlertCircle className="w-7 h-7 shrink-0" aria-hidden="true" />
            <p className="text-[1.05rem] font-semibold">{errorMessage}</p>
          </div>
        )}

        <div className="bg-white rounded-3xl border border-line p-6 sm:p-9">
          {/* STEP 1 */}
          {currentStep === 1 && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="font-display font-extrabold text-2xl text-brand-900">Sizin məlumatlarınız</h2>
                <p className="text-base text-muted mt-1">Kabinetinizdən götürülüb. Səhv varsa, düzəldin.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="w-name" className={labelClass}>Adınız və soyadınız</label>
                  <input id="w-name" type="text" autoComplete="name" value={applicantName} onChange={e => setApplicantName(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="w-phone" className={labelClass}>Telefon nömrəniz</label>
                  <input id="w-phone" type="tel" autoComplete="tel" value={applicantPhone} onChange={e => setApplicantPhone(e.target.value)} placeholder="+994 50 000 00 00" className={inputClass} />
                  <p className={hintClass}>Məsləhətçimiz bu nömrə ilə sizinlə əlaqə saxlayacaq.</p>
                </div>
                <div>
                  <label htmlFor="w-email" className={labelClass}>Elektron poçt</label>
                  <input id="w-email" type="email" disabled value={applicantEmail} className={inputClass} />
                  <p className={hintClass}>Bunu kabinetinizdə dəyişə bilərsiniz.</p>
                </div>
                <div>
                  <label htmlFor="w-company" className={labelClass}>Şirkət və ya təsərrüfat adı <span className="font-normal text-muted">(varsa)</span></label>
                  <input id="w-company" type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Məsələn: Qarabağ Aqro MMC" className={inputClass} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="w-tax" className={labelClass}>VÖEN <span className="font-normal text-muted">(varsa)</span></label>
                  <input id="w-tax" type="text" inputMode="numeric" value={taxNumber} onChange={e => setTaxNumber(e.target.value)} placeholder="10 rəqəm" className={`${inputClass} sm:max-w-sm`} />
                  <p className={hintClass}>Vergi ödəyicisinin eyniləşdirmə nömrəsi — vergi şəhadətnamənizdə yazılıb.</p>
                </div>
              </div>
              {step1Missing && (
                <p className="flex items-center gap-2 text-gold-900 font-semibold"><Info className="w-5 h-5" aria-hidden="true" />Davam etmək üçün ad və telefon nömrəsini yazın.</p>
              )}
              <div className="pt-6 border-t border-line flex justify-end">
                <NextButton onClick={() => goToStep(2)} disabled={step1Missing} />
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {currentStep === 2 && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="font-display font-extrabold text-2xl text-brand-900">Müraciət etdiyiniz torpaq sahəsi</h2>
                <p className="text-base text-muted mt-1">Doğru sahəni seçdiyinizə əmin olun.</p>
              </div>
              <dl className="bg-cream rounded-2xl border border-line px-5">
                <SummaryRow label="Müsabiqə" value={competition.title} />
                <SummaryRow label="Torpaq sahəsi" value={land?.title ?? '—'} />
                <SummaryRow label="Rayon və ölçü" value={`${land?.region ?? ''} rayonu, ${land?.areaHectares ?? ''} hektar`} />
                <SummaryRow label="Minimal sərmayə" value={formatManat(minRequired)} />
                <SummaryRow label="Son müraciət tarixi" value={formatDateAz(competition.applicationDeadline)} />
              </dl>
              {competition.eligibilityConditions?.length > 0 && (
                <div>
                  <h3 className="font-display font-bold text-lg text-brand-900 mb-3">Şərtlər</h3>
                  <ul className="flex flex-col gap-2">
                    {competition.eligibilityConditions.map((c, i) => (
                      <li key={i} className="flex gap-3 items-start">
                        <Check className="w-6 h-6 text-brand-700 shrink-0" aria-hidden="true" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="pt-6 border-t border-line flex flex-col-reverse sm:flex-row justify-between gap-3">
                <BackButton onClick={() => goToStep(1)} />
                <NextButton onClick={() => goToStep(3)}>Bəli, bu sahədir</NextButton>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {currentStep === 3 && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="font-display font-extrabold text-2xl text-brand-900">Sizin təklifiniz</h2>
                <p className="text-base text-muted mt-1">Nə qədər sərmayə qoyacağınızı və nə edəcəyinizi qısaca yazın.</p>
              </div>
              <div>
                <label htmlFor="w-amount" className={labelClass}>Sərmayə məbləği (manatla)</label>
                <input
                  id="w-amount"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1000}
                  value={proposedAmount || ''}
                  onChange={e => setProposedAmount(Number(e.target.value))}
                  aria-describedby="w-amount-hint"
                  className={`${inputClass} sm:max-w-sm font-bold text-lg`}
                />
                <p id="w-amount-hint" className={hintClass}>
                  Yazdığınız: <strong className="text-ink">{formatManat(proposedAmount)}</strong> · Tələb olunan minimum: <strong className="text-ink">{formatManat(minRequired)}</strong>
                </p>
                {belowMinimum && (
                  <p className="mt-2 flex items-start gap-2 text-gold-900 font-semibold">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                    Məbləğ tələb olunan minimumdan azdır. Belə müraciətə baxılmaya bilər.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="w-period" className={labelClass}>Layihə nə qədər vaxta başa çatacaq?</label>
                <select id="w-period" value={implementationPeriod} onChange={e => setImplementationPeriod(e.target.value)} className={`${inputClass} sm:max-w-sm`}>
                  <option value="12 ay">1 il (12 ay)</option>
                  <option value="18 ay">1 il yarım (18 ay)</option>
                  <option value="24 ay">2 il (24 ay)</option>
                  <option value="36 ay">3 il (36 ay)</option>
                </select>
              </div>
              <div>
                <label htmlFor="w-plan" className={labelClass}>Nə etmək istəyirsiniz? (qısa biznes plan)</label>
                <textarea
                  id="w-plan"
                  rows={6}
                  value={businessPlanSummary}
                  onChange={e => setBusinessPlanSummary(e.target.value)}
                  aria-describedby="w-plan-hint"
                  className="w-full px-4 py-3 rounded-xl border-2 border-[#9AA89E] bg-white text-ink text-base leading-relaxed focus:border-brand-700"
                />
                <p id="w-plan-hint" className={hintClass}>
                  Məsələn: nə əkəcəksiniz və ya hansı heyvanı saxlayacaqsınız, necə suvaracaqsınız, neçə nəfərə iş yeri açacaqsınız, məhsulu harada satacaqsınız.
                </p>
              </div>
              {step3Missing && (
                <p className="flex items-center gap-2 text-gold-900 font-semibold"><Info className="w-5 h-5" aria-hidden="true" />Davam etmək üçün məbləği və qısa planı yazın.</p>
              )}
              <div className="pt-6 border-t border-line flex flex-col-reverse sm:flex-row justify-between gap-3">
                <BackButton onClick={() => goToStep(2)} />
                <NextButton onClick={() => goToStep(4)} disabled={step3Missing} />
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {currentStep === 4 && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="font-display font-extrabold text-2xl text-brand-900">Sənədləri əlavə edin</h2>
                <p className="text-base text-muted mt-1">PDF və ya Word faylı (ən çox 15 MB). Sənədləri bir-bir əlavə edə bilərsiniz.</p>
              </div>

              {competition.requiredDocuments?.length > 0 && (
                <div className="bg-cream rounded-2xl border border-line p-5">
                  <h3 className="font-display font-bold text-lg text-brand-900 mb-3">Lazım olan sənədlər</h3>
                  <ul className="flex flex-col gap-2">
                    {competition.requiredDocuments.map((d, i) => (
                      <li key={i} className="flex gap-3 items-start">
                        <FileText className="w-6 h-6 text-brand-700 shrink-0" aria-hidden="true" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <label
                  htmlFor="w-file"
                  className="flex flex-col sm:flex-row items-center justify-center gap-4 border-2 border-dashed border-[#9AA89E] rounded-2xl p-7 text-center cursor-pointer hover:bg-brand-50 hover:border-brand-700 transition-colors"
                >
                  <Upload className="w-10 h-10 text-brand-700" aria-hidden="true" />
                  <span className="flex flex-col">
                    <span className="font-display font-extrabold text-lg text-brand-900">Kompüterdən fayl seçin</span>
                    <span className="text-muted">Bu sahəyə basın və faylı seçin</span>
                  </span>
                </label>
                <input id="w-file" type="file" accept=".pdf,.doc,.docx" onChange={handleFileUpload} className="sr-only" />
              </div>

              {fileError && (
                <p role="alert" className="flex items-start gap-2 text-[#7A1A10] font-semibold">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                  {fileError}
                </p>
              )}

              {uploadedDocs.length > 0 && (
                <div>
                  <p className="font-bold mb-3">Əlavə etdiyiniz sənədlər ({uploadedDocs.length}):</p>
                  <ul className="flex flex-col gap-2">
                    {uploadedDocs.map((doc, i) => (
                      <li key={i} className="flex flex-wrap items-center justify-between gap-3 p-4 bg-cream rounded-xl border border-line">
                        <span className="flex items-center gap-3 min-w-0">
                          <FileText className="w-6 h-6 text-brand-700 shrink-0" aria-hidden="true" />
                          <span className="font-semibold break-all">{doc.fileName}</span>
                          <span className="text-muted text-sm whitespace-nowrap">({Math.max(1, Math.round(doc.fileSize / 1024))} KB)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeDoc(i)}
                          className="min-h-11 px-3 rounded-lg border-2 border-line text-[#B42318] font-bold flex items-center gap-2 hover:border-[#B42318]"
                        >
                          <Trash2 className="w-5 h-5" aria-hidden="true" />
                          Sil
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-6 border-t border-line flex flex-col-reverse sm:flex-row justify-between gap-3">
                <BackButton onClick={() => goToStep(3)} />
                <NextButton onClick={() => goToStep(5)}>Yoxlamaya keçin</NextButton>
              </div>
            </div>
          )}

          {/* STEP 5 */}
          {currentStep === 5 && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="font-display font-extrabold text-2xl text-brand-900">Hər şeyi yoxlayın</h2>
                <p className="text-base text-muted mt-1">Səhv görsəniz, "Dəyiş" düyməsini basın. Hər şey düzdürsə, göndərin.</p>
              </div>

              <dl className="bg-cream rounded-2xl border border-line px-5">
                <SummaryRow label="Ərizəçi" value={`${applicantName}${companyName ? ` (${companyName})` : ''}`} onEdit={() => goToStep(1)} />
                <SummaryRow label="Əlaqə" value={`${applicantPhone} · ${applicantEmail}`} onEdit={() => goToStep(1)} />
                <SummaryRow label="Torpaq sahəsi" value={`${land?.title ?? ''} — ${land?.region ?? ''}, ${land?.areaHectares ?? ''} ha`} />
                <SummaryRow label="Sərmayə məbləği" value={formatManat(proposedAmount)} onEdit={() => goToStep(3)} />
                <SummaryRow label="Müddət" value={implementationPeriod} onEdit={() => goToStep(3)} />
                <SummaryRow label="Qısa plan" value={<span className="font-normal whitespace-pre-line">{businessPlanSummary}</span>} onEdit={() => goToStep(3)} />
                <SummaryRow
                  label="Sənədlər"
                  value={uploadedDocs.length ? `${uploadedDocs.length} sənəd əlavə olunub` : 'Sənəd əlavə olunmayıb'}
                  onEdit={() => goToStep(4)}
                />
              </dl>

              {uploadedDocs.length === 0 && (
                <p className="flex items-start gap-2 text-gold-900 font-semibold">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                  Sənəd əlavə etməmisiniz. Göndərə bilərsiniz, amma komissiya sizdən sənədləri sonra istəyəcək.
                </p>
              )}

              <label className="flex items-start gap-4 p-5 bg-brand-50 rounded-2xl border-2 border-brand-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={e => setTermsAccepted(e.target.checked)}
                  className="mt-1 w-7 h-7 shrink-0 accent-[#1F6B3C]"
                />
                <span className="text-[1.05rem] leading-relaxed">
                  Yazdığım məlumatların və sənədlərin düzgün olduğunu təsdiq edirəm. Müsabiqənin qaydaları ilə razıyam.
                </span>
              </label>

              <div className="pt-6 border-t border-line flex flex-col-reverse sm:flex-row justify-between gap-3">
                <BackButton onClick={() => goToStep(4)} />
                <button
                  type="button"
                  disabled={submitting || !termsAccepted}
                  onClick={handleSubmit}
                  className="min-h-16 px-8 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-display font-extrabold text-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShieldCheck className="w-7 h-7" aria-hidden="true" />
                  {submitting ? 'Göndərilir…' : 'Müraciəti göndərin'}
                </button>
              </div>
              {!termsAccepted && (
                <p className="text-right text-muted -mt-3">Göndərmək üçün yuxarıdakı qutunu işarələyin.</p>
              )}
            </div>
          )}
        </div>

        <p className="mt-6 flex items-center gap-3 text-base text-[#3E4F45]">
          <Phone className="w-6 h-6 text-brand-700 shrink-0" aria-hidden="true" />
          Çətinlik çəkirsiniz? Zəng edin, birlikdə dolduraq: <strong className="text-brand-900">{HELP_LINE}</strong>
        </p>
      </div>
    </div>
  );
};
