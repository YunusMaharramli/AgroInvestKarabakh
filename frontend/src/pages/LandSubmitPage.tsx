import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Upload, Trash2, AlertCircle, CheckCircle2, MapPin, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { MyLand } from '../types/index.js';
import { normalizeAzPhone, apiError } from '../lib/applicationStatus.js';
import { HELP_LINE } from '../components/Header.js';

interface LandSubmitPageProps {
  navigate: (route: string) => void;
}

const REGIONS = ['Ağdam', 'Füzuli', 'Zəngilan', 'Cəbrayıl', 'Qubadlı', 'Xocavənd', 'Kəlbəcər', 'Laçın', 'Şuşa', 'Xankəndi', 'Tərtər', 'Ağdərə'];
const TYPES = [
  { value: 'Əkinçilik', label: 'Əkinçilik', hint: 'buğda, arpa, tərəvəz' },
  { value: 'Bağçılıq', label: 'Bağçılıq', hint: 'nar, üzüm, meyvə' },
  { value: 'İstixana təsərrüfatı', label: 'İstixana', hint: 'pomidor, xiyar' },
  { value: 'Heyvandarlıq', label: 'Heyvandarlıq', hint: 'mal-qara, qoyun' },
  { value: 'Arıçılıq', label: 'Arıçılıq', hint: 'bal' },
];

const inputClass =
  'w-full min-h-[3.25rem] px-4 rounded-xl border-2 border-[#9AA89E] bg-white text-ink text-lg focus:border-brand-700';
const labelClass = 'block font-bold text-base mb-1.5';
const hintClass = 'text-[0.95rem] text-muted mt-1';
const KARABAKH_CENTER: [number, number] = [39.75, 46.75];

const Section: React.FC<{ step: number; title: string; children: React.ReactNode; hint?: string }> = ({ step, title, hint, children }) => (
  <fieldset className="bg-white rounded-3xl border border-line p-5 sm:p-8 flex flex-col gap-5">
    <legend className="sr-only">{title}</legend>
    <div className="flex items-start gap-3">
      <span className="w-10 h-10 rounded-full bg-brand-700 text-white flex items-center justify-center font-display font-extrabold text-lg shrink-0" aria-hidden="true">{step}</span>
      <div>
        <h2 className="font-display font-extrabold text-xl sm:text-2xl text-brand-900">{title}</h2>
        {hint && <p className={hintClass}>{hint}</p>}
      </div>
    </div>
    {children}
  </fieldset>
);

/** Owner submits their land for admin review (with JPG/PNG ownership documents). */
export const LandSubmitPage: React.FC<LandSubmitPageProps> = ({ navigate }) => {
  const { user, token, isLoading: authLoading, refreshUser } = useAuth();
  const profilePhone = normalizeAzPhone(user?.phone);

  const [title, setTitle] = useState('');
  const [region, setRegion] = useState('');
  const [type, setType] = useState('');
  const [area, setArea] = useState('');
  const [investment, setInvestment] = useState('');
  const [intendedUse, setIntendedUse] = useState('');
  const [description, setDescription] = useState('');
  const [soil, setSoil] = useState('');
  const [water, setWater] = useState('');
  const [point, setPoint] = useState<[number, number] | null>(null);
  const [files, setFiles] = useState<{ file: File; preview: string }[]>([]);
  const [requiredDocs, setRequiredDocs] = useState('');
  const [conditions, setConditions] = useState('');
  const [deadline, setDeadline] = useState('');
  const [phone, setPhone] = useState('');

  const [fileError, setFileError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<MyLand | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const marker = useRef<any>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate(`/login?next=${encodeURIComponent('/lands/new')}`);
  }, [authLoading, user]);

  // Small marker map: click to place the land.
  useEffect(() => {
    if (!user || user.role === 'ADMIN' || done) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapRef.current || leafletMap.current) return;
      const map = L.map(mapRef.current, { center: KARABAKH_CENTER, zoom: 9, scrollWheelZoom: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 18 }).addTo(map);
      const icon = L.divIcon({
        className: '',
        html: '<div style="width:40px;height:40px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#C0392B;border:4px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.35);"></div>',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      });
      map.on('click', (e: any) => {
        const p: [number, number] = [Number(e.latlng.lat.toFixed(5)), Number(e.latlng.lng.toFixed(5))];
        if (marker.current) marker.current.setLatLng(p);
        else marker.current = L.marker(p, { icon }).addTo(map);
        setPoint(p);
      });
      leafletMap.current = map;
    })();
    return () => {
      cancelled = true;
      leafletMap.current?.remove();
      leafletMap.current = null;
      marker.current = null;
    };
  }, [user?.id, done]);

  useEffect(() => () => files.forEach(f => URL.revokeObjectURL(f.preview)), []);

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const picked = Array.from(e.target.files ?? []);
    for (const file of picked) {
      const ok = ['image/jpeg', 'image/png'].includes(file.type) || /\.(jpe?g|png)$/i.test(file.name);
      if (!ok) { setFileError(`"${file.name}" qəbul edilmir. Sənədin şəklini JPG və ya PNG kimi yükləyin.`); continue; }
      if (file.size > 10 * 1024 * 1024) { setFileError(`"${file.name}" çox böyükdür (ən çox 10 MB).`); continue; }
      setFiles(prev => (prev.length >= 10 ? prev : [...prev, { file, preview: URL.createObjectURL(file) }]));
    }
    e.target.value = '';
  };

  const removeFile = (i: number) => setFiles(prev => {
    URL.revokeObjectURL(prev[i].preview);
    return prev.filter((_, idx) => idx !== i);
  });

  const phoneOk = Boolean(profilePhone) || Boolean(normalizeAzPhone(phone));
  const missing: string[] = [];
  if (!title.trim()) missing.push('sahənin adı');
  if (!region) missing.push('rayon');
  if (!type) missing.push('fəaliyyət növü');
  if (!(Number(area.replace(',', '.')) > 0)) missing.push('sahənin ölçüsü');
  if (investment.trim() === '' || Number(investment.replace(/\s/g, '')) < 0) missing.push('lazım olan sərmayə');
  if (!point) missing.push('xəritədə yer');
  if (files.length === 0) missing.push('mülkiyyət sənədi');
  if (!phoneOk) missing.push('əlaqə telefonu');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (missing.length > 0) {
      setError(`Zəhmət olmasa doldurun: ${missing.join(', ')}.`);
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('title', title.trim());
      form.append('region', region);
      form.append('agricultureType', type);
      form.append('areaHectares', area.replace(',', '.'));
      form.append('estimatedInvestmentRequirement', investment.replace(/\s/g, ''));
      form.append('latitude', String(point![0]));
      form.append('longitude', String(point![1]));
      form.append('intendedUse', intendedUse.trim());
      form.append('description', description.trim());
      form.append('soilQuality', soil.trim());
      form.append('waterSupply', water.trim());
      form.append('requiredDocuments', requiredDocs);
      form.append('eligibilityConditions', conditions);
      if (deadline) form.append('applicationDeadline', deadline);
      if (!profilePhone) form.append('contactPhone', phone);
      files.forEach(f => form.append('documents', f.file, f.file.name));

      const res = await fetch('/api/my/lands', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) {
        setError(await apiError(res, 'Göndərmək alınmadı. Bir az sonra yenidən cəhd edin.'));
        return;
      }
      setDone(await res.json());
      if (!profilePhone) refreshUser();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('İnternet bağlantısında problem yarandı. Yenidən cəhd edin.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-lg" role="status">Yüklənir…</div>;
  }

  if (user.role === 'ADMIN') {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <h1 className="font-display font-extrabold text-2xl text-brand-900">Torpağı yalnız sahibi əlavə edir</h1>
        <p className="text-lg text-muted mt-3">İnzibatçılar torpaq sahiblərinin müraciətlərini “Yoxlama növbəsi” bölməsində yoxlayır.</p>
        <button type="button" onClick={() => navigate('/admin?tab=reviews')} className="mt-8 min-h-14 px-7 rounded-xl bg-brand-700 text-white font-display font-bold">
          Yoxlama növbəsinə keçin
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="bg-cream py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="bg-white rounded-3xl border border-line p-8 sm:p-10 text-center">
            <CheckCircle2 className="w-16 h-16 text-brand-700 mx-auto" aria-hidden="true" />
            <h1 className="font-display font-extrabold text-3xl text-brand-900 mt-4">Torpağınız yoxlamaya göndərildi</h1>
            <p className="text-lg text-[#3E4F45] mt-3">
              İnzibatçı sənədlərinizi yoxlayacaq. Təsdiq olunanda sahəniz “İnvestisiya imkanları” siyahısında dərc ediləcək və sizə bildiriş gələcək.
              Əlavə sənəd lazım olsa, bunu da bildirişdə görəcəksiniz.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <button type="button" onClick={() => navigate('/dashboard?tab=lands')} className="min-h-14 px-7 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-display font-bold">
                Torpaqlarıma baxın
              </button>
              <button type="button" onClick={() => navigate('/opportunities')} className="min-h-14 px-7 rounded-xl border-2 border-brand-900 text-brand-900 font-display font-bold">
                İnvestisiya imkanları
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-cream pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8">
        <button
          type="button"
          onClick={() => navigate('/dashboard?tab=lands')}
          className="inline-flex items-center gap-2 min-h-[3.25rem] px-5 rounded-xl border-2 border-brand-900 text-brand-900 font-display font-bold hover:bg-white mb-6"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          Kabinetə qayıt
        </button>
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl leading-tight text-brand-900">Torpaq əlavə edin</h1>
        <p className="text-lg text-[#3E4F45] mt-2 mb-7">
          Torpağınızı investor tapmaq üçün yerləşdirin. İnzibatçı mülkiyyət sənədini yoxlayandan sonra sahəniz dərc olunacaq.
        </p>

        <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
          <Section step={1} title="Sahə haqqında">
            <div>
              <label htmlFor="l-title" className={labelClass}>Sahənin adı</label>
              <input id="l-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} placeholder="Məsələn: Ağdam, Qiyaslı kəndi yanında əkin sahəsi" className={inputClass} />
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="l-region" className={labelClass}>Rayon</label>
                <select id="l-region" value={region} onChange={e => setRegion(e.target.value)} className={inputClass}>
                  <option value="">Seçin…</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="l-area" className={labelClass}>Sahənin ölçüsü (hektar)</label>
                <input id="l-area" inputMode="decimal" value={area} onChange={e => setArea(e.target.value)} placeholder="Məsələn: 120" className={inputClass} />
              </div>
            </div>
            <div role="radiogroup" aria-labelledby="l-type-label">
              <p id="l-type-label" className={labelClass}>Nə üçün yararlıdır?</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TYPES.map(t => (
                  <label key={t.value} className={`min-h-14 px-4 py-3 rounded-xl border-2 cursor-pointer flex items-center gap-3 ${type === t.value ? 'border-brand-700 bg-brand-50' : 'border-line bg-white hover:border-brand-900'}`}>
                    <input type="radio" name="l-type" value={t.value} checked={type === t.value} onChange={() => setType(t.value)} className="w-6 h-6 accent-[#1F6B3C]" />
                    <span>
                      <span className="block font-bold text-lg leading-tight">{t.label}</span>
                      <span className="block text-[0.95rem] text-muted">{t.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="l-invest" className={labelClass}>Lazım olan sərmayə (manat)</label>
              <input id="l-invest" inputMode="numeric" value={investment} onChange={e => setInvestment(e.target.value)} placeholder="Məsələn: 400000" className={inputClass} />
              <p className={hintClass}>Sahəni işlətmək üçün investordan gözlədiyiniz təxmini məbləğ.</p>
            </div>
            <div>
              <label htmlFor="l-use" className={labelClass}>Nə əkmək / etmək olar? <span className="font-normal text-muted">(istəyə görə)</span></label>
              <input id="l-use" value={intendedUse} onChange={e => setIntendedUse(e.target.value)} maxLength={500} placeholder="Məsələn: buğda və arpa" className={inputClass} />
            </div>
            <div>
              <label htmlFor="l-desc" className={labelClass}>Qısa təsvir <span className="font-normal text-muted">(istəyə görə)</span></label>
              <textarea id="l-desc" rows={4} value={description} onChange={e => setDescription(e.target.value)} maxLength={4000} className={`${inputClass} py-3`} placeholder="Yolu, suyu, işığı varmı? Nəyə yaxındır?" />
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="l-soil" className={labelClass}>Torpağın keyfiyyəti <span className="font-normal text-muted">(istəyə görə)</span></label>
                <input id="l-soil" value={soil} onChange={e => setSoil(e.target.value)} maxLength={500} className={inputClass} />
              </div>
              <div>
                <label htmlFor="l-water" className={labelClass}>Su təminatı <span className="font-normal text-muted">(istəyə görə)</span></label>
                <input id="l-water" value={water} onChange={e => setWater(e.target.value)} maxLength={500} className={inputClass} />
              </div>
            </div>
          </Section>

          <Section step={2} title="Sahənin yeri" hint="Xəritədə sahənizin olduğu yerə basın — qırmızı nişan qoyulacaq. Böyütmək üçün “+” düyməsini basın.">
            <div ref={mapRef} className="w-full h-[22rem] rounded-2xl border border-line overflow-hidden z-0" role="application" aria-label="Sahənin yerini seçmək üçün xəritə" />
            <p className="text-lg flex items-center gap-2" aria-live="polite">
              <MapPin className={`w-6 h-6 ${point ? 'text-[#C0392B]' : 'text-muted'}`} aria-hidden="true" />
              {point ? <>Seçildi: <strong>{point[0]}, {point[1]}</strong></> : 'Hələ yer seçilməyib.'}
            </p>
          </Section>

          <Section step={3} title="Mülkiyyət sənədi" hint="Torpağın sizə məxsus olduğunu göstərən sənədin şəklini (çıxarış, kadastr pasportu) yükləyin. JPG və ya PNG, hər biri ən çox 10 MB.">
            <label htmlFor="l-files" className="flex flex-col sm:flex-row items-center justify-center gap-4 border-2 border-dashed border-[#9AA89E] rounded-2xl p-7 text-center cursor-pointer hover:bg-brand-50 hover:border-brand-700">
              <Upload className="w-10 h-10 text-brand-700" aria-hidden="true" />
              <span className="flex flex-col">
                <span className="font-display font-extrabold text-lg text-brand-900">Şəkil seçin</span>
                <span className="text-muted">Telefonla çəkilmiş şəkil də olar</span>
              </span>
            </label>
            <input id="l-files" type="file" multiple accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={addFiles} className="sr-only" />
            {fileError && (
              <p role="alert" className="flex items-start gap-2 text-[#7A1A10] font-semibold">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                {fileError}
              </p>
            )}
            {files.length > 0 && (
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {files.map((f, i) => (
                  <li key={f.preview} className="rounded-2xl border border-line overflow-hidden bg-cream">
                    <img src={f.preview} alt={`Sənəd ${i + 1}`} className="w-full h-32 object-cover" />
                    <div className="p-2 flex items-center justify-between gap-2">
                      <span className="text-sm truncate">{f.file.name}</span>
                      <button type="button" onClick={() => removeFile(i)} className="min-h-10 px-2 rounded-lg border-2 border-line text-[#B42318] font-bold text-sm flex items-center gap-1 hover:border-[#B42318]">
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                        Sil
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section step={4} title="İnvestorlar üçün şərtlər" hint="Hamısı istəyə görədir. Boş saxlasanız, investorlar sənədsiz təklif göndərə bilər.">
            <div>
              <label htmlFor="l-reqdocs" className={labelClass}>İnvestordan hansı sənədləri istəyirsiniz?</label>
              <textarea id="l-reqdocs" rows={3} value={requiredDocs} onChange={e => setRequiredDocs(e.target.value)} className={`${inputClass} py-3`} placeholder={'Hər sənədi ayrı sətirdə yazın, məsələn:\nBiznes plan\nBank hesabından çıxarış'} />
            </div>
            <div>
              <label htmlFor="l-cond" className={labelClass}>İnvestora tələblər</label>
              <textarea id="l-cond" rows={3} value={conditions} onChange={e => setConditions(e.target.value)} className={`${inputClass} py-3`} placeholder={'Hər tələbi ayrı sətirdə yazın, məsələn:\nKənd təsərrüfatında təcrübə'} />
            </div>
            <div>
              <label htmlFor="l-deadline" className={labelClass}>Təkliflər üçün son tarix</label>
              <input id="l-deadline" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} min={new Date().toISOString().slice(0, 10)} className={`${inputClass} sm:max-w-xs`} />
            </div>
          </Section>

          <Section step={5} title="Əlaqə telefonu" hint="Bu nömrəni yalnız sizə təklif göndərən investorlar görəcək.">
            {profilePhone ? (
              <p className="text-lg">Profilinizdəki nömrə istifadə olunacaq: <strong>{profilePhone}</strong></p>
            ) : (
              <div>
                <label htmlFor="l-phone" className={labelClass}>Telefon nömrəniz</label>
                <input id="l-phone" type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+994 50 123 45 67" className={`${inputClass} sm:max-w-sm`} aria-invalid={phone.length > 0 && !phoneOk} />
                {phone.length > 0 && !phoneOk && (
                  <p role="alert" className="text-[#7A1A10] font-semibold mt-1">Nömrə düzgün deyil. Azərbaycan nömrəsi yazın, məsələn: 050 123 45 67.</p>
                )}
              </div>
            )}
          </Section>

          {error && (
            <div role="alert" className="p-4 rounded-xl bg-[#FCEBE8] border-2 border-[#C0392B] text-[#7A1F14] text-base flex gap-3">
              <AlertCircle className="w-6 h-6 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="min-h-16 px-10 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white font-display font-extrabold text-xl flex items-center justify-center gap-3"
            >
              <Send className="w-6 h-6" aria-hidden="true" />
              {submitting ? 'Göndərilir…' : 'Yoxlamaya göndərin'}
            </button>
            <p className="text-base text-muted">Sualınız var? Zəng edin: <strong className="text-brand-900">{HELP_LINE}</strong></p>
          </div>
        </form>
      </div>
    </div>
  );
};
