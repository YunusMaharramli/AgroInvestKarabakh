import React from 'react';
import { useComparison } from '../context/ComparisonContext.js';
import { Layers, Trash2, ArrowLeft, Plus, Check } from 'lucide-react';

interface ComparePageProps {
  navigate: (route: string) => void;
}

export const ComparePage: React.FC<ComparePageProps> = ({ navigate }) => {
  const { compareLands, removeFromCompare, clearCompare } = useComparison();

  if (compareLands.length === 0) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] py-16">
        <div className="max-w-xl mx-auto px-4 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Layers className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Müqayisə cədvəli boşdur</h2>
          <p className="text-xs text-slate-500 mt-2">
            Müqayisə etmək üçün kataloqdan ən çox 3 torpaq sahəsi seçə bilərsiniz.
          </p>
          <button
            onClick={() => navigate('/opportunities')}
            className="mt-6 px-5 py-2.5 bg-emerald-800 text-white font-semibold text-xs rounded-lg hover:bg-emerald-900 transition-colors"
          >
            Kataloqa keçid
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={() => navigate('/opportunities')}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kataloqa qayıt</span>
            </button>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Torpaq Sahələrinin Müqayisəsi ({compareLands.length}/3)
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {compareLands.length < 3 && (
              <button
                onClick={() => navigate('/opportunities')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-semibold shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Sahə əlavə et</span>
              </button>
            )}
            <button
              onClick={clearCompare}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Təmizlə</span>
            </button>
          </div>
        </div>

        {/* Comparison Matrix Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="p-4 w-44 font-bold text-slate-500 uppercase tracking-wider text-[11px]">
                  Parametrlər
                </th>
                {compareLands.map(land => (
                  <th key={land.id} className="p-4 min-w-[240px] align-top">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-sm text-slate-900">{land.title}</span>
                      <button
                        onClick={() => removeFromCompare(land.id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors"
                        title="Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="text-[11px] text-emerald-800 font-semibold block mt-1">
                      {land.region}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/50">Şəkil</td>
                {compareLands.map(land => (
                  <td key={land.id} className="p-4">
                    <img
                      src={land.imageUrl}
                      alt={land.title}
                      className="w-full h-32 object-cover rounded-lg"
                      referrerPolicy="no-referrer"
                    />
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/50">Region</td>
                {compareLands.map(land => (
                  <td key={land.id} className="p-4 font-bold text-slate-900">
                    {land.region}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/50">Torpaq Sahəsi</td>
                {compareLands.map(land => (
                  <td key={land.id} className="p-4 font-mono-numbers font-bold text-emerald-800 text-sm">
                    {land.areaHectares} hektar
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/50">Aqrar Kateqoriya</td>
                {compareLands.map(land => (
                  <td key={land.id} className="p-4 text-slate-800 font-medium">
                    {land.agricultureType}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/50">Tələb Olunan İnvestisiya</td>
                {compareLands.map(land => (
                  <td key={land.id} className="p-4 font-mono-numbers font-extrabold text-slate-900 text-sm">
                    {land.estimatedInvestmentRequirement.toLocaleString()} ₼
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/50">Torpaq Keyfiyyəti</td>
                {compareLands.map(land => (
                  <td key={land.id} className="p-4 text-slate-700">
                    {land.soilQuality || 'Şabalıdı münbit torpaq'}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/50">Suvarma Təminatı</td>
                {compareLands.map(land => (
                  <td key={land.id} className="p-4 text-slate-700">
                    {land.waterSupply || 'Dövlət kanalı'}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/50">İstifadə Təyinatı</td>
                {compareLands.map(land => (
                  <td key={land.id} className="p-4 text-slate-700 leading-relaxed">
                    {land.intendedUse}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/50">Əməliyyat</td>
                {compareLands.map(land => (
                  <td key={land.id} className="p-4">
                    <button
                      onClick={() => navigate(`/opportunities/${land.id}`)}
                      className="w-full py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
                    >
                      Ətraflı Bax və Müraciət Et
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
