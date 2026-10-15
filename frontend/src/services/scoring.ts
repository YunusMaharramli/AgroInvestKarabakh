import type { Land, RiskTolerance, SearchFilters } from '../types/agro';
import { regionByKey } from '../data/regions';

/**
 * Mock scoring (Part 2, section 4.2). Frontend placeholder — the real values will come from the backend.
 * Keep all logic in this file so it can be replaced in one place.
 */

export type RiskLevel = 'low' | 'medium' | 'high';

export interface ScoreBreakdown {
  budget: number;   // 0..1
  fieldType: number;
  fertility: number;
  risk: number;
  region: number;
}

export interface LandScore {
  suitability: number; // 0..100
  breakdown: ScoreBreakdown;
  risk: RiskLevel;
  riskValue: number; // 0..1
  riskFactors: string[]; // translation keys
}

export const WEIGHTS = { budget: 0.3, fieldType: 0.25, fertility: 0.2, risk: 0.15, region: 0.1 } as const;

/** Risk from water access, regional climate, soil quality, owner verification and crop price volatility. */
export function landRisk(land: Land): { level: RiskLevel; value: number; factors: string[] } {
  const factors: string[] = [];
  const water = land.irrigation === 'none' ? 1 : land.irrigation === 'canal' ? 0.4 : land.irrigation === 'well' ? 0.3 : 0.1;
  if (land.irrigation === 'none') factors.push('risk.noIrrigation');
  const climate = regionByKey(land.region)?.climateRisk ?? 0.4;
  if (climate >= 0.5) factors.push('risk.drought');
  const soil = 1 - land.fertilityPct / 100;
  if (land.fertilityPct < 60) factors.push('risk.lowFertility');
  const owner = land.ownerVerified ? 0 : 1;
  if (!land.ownerVerified) factors.push('risk.unverified');
  const price = land.priceVolatility;
  if (price >= 0.45) factors.push('risk.volatile');
  const value = 0.3 * water + 0.25 * climate + 0.2 * soil + 0.1 * owner + 0.15 * price;
  const level: RiskLevel = value < 0.3 ? 'low' : value < 0.45 ? 'medium' : 'high';
  return { level, value, factors };
}

const TOL: Record<RiskTolerance, number> = { low: 0.3, medium: 0.45, high: 0.7 };

export function scoreLand(land: Land, f: Partial<SearchFilters>): LandScore {
  const risk = landRisk(land);

  // Budget fit: overlap between the investor's range and the land's required range
  let budget = 0.6;
  if (f.budgetMax && f.budgetMax > 0) {
    const lo = Math.max(f.budgetMin ?? 0, land.investmentMin);
    const hi = Math.min(f.budgetMax, land.investmentMax);
    if (hi >= lo) budget = 1;
    else {
      const gap = land.investmentMin > f.budgetMax ? land.investmentMin - f.budgetMax : (f.budgetMin ?? 0) - land.investmentMax;
      budget = Math.max(0, 1 - gap / Math.max(land.investmentMin, 1));
    }
  }

  const fieldType = !f.fieldTypes?.length ? 0.6 : f.fieldTypes.includes(land.fieldType) ? 1 : 0;
  const fertility = land.fertilityPct / 100;
  const tol = TOL[f.riskTolerance ?? 'medium'];
  const riskFit = risk.value <= tol ? 1 : Math.max(0, 1 - (risk.value - tol) * 3);
  const region = !f.regions?.length ? 0.6 : f.regions.includes(land.region) ? 1 : 0.2;

  const breakdown = { budget, fieldType, fertility, risk: riskFit, region };
  const suitability = Math.round(100 * (
    WEIGHTS.budget * budget + WEIGHTS.fieldType * fieldType + WEIGHTS.fertility * fertility + WEIGHTS.risk * riskFit + WEIGHTS.region * region
  ));
  return { suitability, breakdown, risk: risk.level, riskValue: risk.value, riskFactors: risk.factors };
}

export const scoreColor = (s: number) => (s >= 75 ? '#2E7D32' : s >= 50 ? '#B26A00' : '#B3261E');
