import React from 'react';

interface FooterProps {
  navigate: (route: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ navigate }) => {
  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-md bg-emerald-700 text-amber-300 flex items-center justify-center font-bold text-xs">
                AQ
              </span>
              <span className="text-white font-bold text-base tracking-tight">AgroInvest Qarabağ</span>
            </div>
            <p className="text-xs text-slate-400 italic">
              "Qarabağın torpağına sərmayə, gələcəyinə dəyər."
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Qarabağ regionu üzrə kənd təsərrüfatı torpaqları və investisiya müsabiqələri vahid rəqəmsal platforması.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Bölmələr</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><button onClick={() => navigate('/')} className="hover:text-white transition-colors">Ana səhifə</button></li>
              <li><button onClick={() => navigate('/opportunities')} className="hover:text-white transition-colors">İnvestisiya imkanları</button></li>
              <li><button onClick={() => navigate('/map')} className="hover:text-white transition-colors">İnteraktiv xəritə</button></li>
              <li><button onClick={() => navigate('/agromatch')} className="hover:text-white transition-colors">AgroMatch tövsiyə sistemi</button></li>
              <li><button onClick={() => navigate('/login')} className="hover:text-white transition-colors">Sahibkar Girişi</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Əhatə Dairəsi</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ağdam · Füzuli · Zəngilan · Cəbrayıl · Qubadlı · Xocavənd · Kəlbəcər · Laçın
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800">
              <span className="text-xs text-emerald-400 font-medium">Aqrar İxtisaslaşma:</span>
              <p className="text-[11px] text-slate-400 mt-1">
                Dənli bitkilər, intensiv bağçılıq, hidroponik istixanalar, cins heyvandarlıq və arıçılıq.
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Prototip Qeydi</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-800/50 p-3 rounded-lg border border-slate-800">
              Bu tətbiq universitet hakatonu üçün hazırlanmış prototipdir. Məlumatlar nümayiş xarakterlidir və rəsmi dövlət sənədi hesab edilmir.
            </p>
            <p className="text-[11px] text-slate-500 mt-3 font-mono-numbers">
              EKTİS Adapter: Simulyasiya rejimi
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <span>© 2026 AgroInvest Qarabağ. Bütün hüquqlar qorunur.</span>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Məxfilik siyasəti</span>
            <span>·</span>
            <span>İstifadə qaydaları</span>
            <span>·</span>
            <span>Əlaqə: info@agroinvest.gov.az</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
