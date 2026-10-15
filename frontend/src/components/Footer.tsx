import React from 'react';
import { HELP_LINE } from './Header.js';

interface FooterProps {
  navigate: (route: string) => void;
}

const LINKS: { route: string; label: string }[] = [
  { route: '/opportunities', label: 'İnvestisiya imkanları' },
  { route: '/map', label: 'Xəritə' },
  { route: '/agromatch', label: 'Mənə uyğun sahə' },
  { route: '/login', label: 'Kabinetə daxil ol' },
];

export const Footer: React.FC<FooterProps> = ({ navigate }) => {
  return (
    <footer className="bg-brand-950 text-[#E3ECE5] mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
          <div className="space-y-4">
            <img src="/brand/agroinvest-qarabag-mark.png" alt="AgroInvest Qarabağ" className="h-16 w-16 translate-x-1 object-contain" />
            <p className="text-[0.95rem] leading-relaxed">
              Qarabağ regionunda torpaq sahiblərini və investorları birləşdirən vahid rəqəmsal platforma.
            </p>
          </div>

          <nav aria-label="Bölmələr">
            <h2 className="font-display font-bold text-gold-400 mb-3 text-base">Bölmələr</h2>
            <ul className="space-y-1">
              {LINKS.map(l => (
                <li key={l.route}>
                  <button
                    type="button"
                    onClick={() => navigate(l.route)}
                    className="text-white text-[0.95rem] min-h-11 hover:underline underline-offset-4"
                  >
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="font-display font-bold text-gold-400 mb-3 text-base">Rayonlar</h2>
            <p className="text-[0.95rem] leading-relaxed">
              Ağdam · Füzuli · Zəngilan · Cəbrayıl · Qubadlı · Xocavənd · Kəlbəcər · Laçın
            </p>
            <p className="text-sm text-[#C9D8CE] mt-4 leading-relaxed">
              Dənli bitkilər, bağçılıq, istixanalar, heyvandarlıq və arıçılıq.
            </p>
          </div>

          <div>
            <h2 className="font-display font-bold text-gold-400 mb-3 text-base">Əlaqə</h2>
            <p className="text-[0.95rem]">Kömək xətti: <strong className="text-white">{HELP_LINE}</strong></p>
            <p className="text-[0.95rem] mt-1">Hər gün 09:00–18:00</p>
            <a href="mailto:info@agroinvest.gov.az" className="text-white text-[0.95rem] underline underline-offset-4 mt-2 inline-block">
              info@agroinvest.gov.az
            </a>
          </div>
        </div>

        <p className="text-sm text-[#C9D8CE] bg-white/5 border border-white/10 rounded-xl p-4 mb-6 leading-relaxed">
          Prototip qeydi: bu tətbiq universitet hakatonu üçün hazırlanıb. Məlumatlar və şəkillər nümayiş xarakterlidir
          (şəkillər süni intellektlə yaradılıb) və rəsmi dövlət sənədi hesab edilmir.
        </p>

        <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-[#C9D8CE]">
          <span>© 2026 AgroInvest Qarabağ. Bütün hüquqlar qorunur.</span>
          <span>Məxfilik siyasəti · İstifadə qaydaları · Əlçatanlıq</span>
        </div>
      </div>
    </footer>
  );
};
