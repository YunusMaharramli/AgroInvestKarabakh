import type { AppNotification, AppUser, InvestmentRequest, Land, SoilType, Irrigation, InvestmentModel } from '../types/agro';
import { regionByKey } from '../data/regions';

/** Mock database seed (Part 2, section 7). Deterministic so screenshots and tests are repeatable. */

export const TEST_PASSWORD = 'Test1234';

export const SEED_USERS: AppUser[] = [
  {
    id: 'u-both', fullName: 'Leyla Məmmədova', email: 'both@agroinvest.az', phone: '+994 50 210 34 56', avatar: null,
    roles: ['landowner', 'investor'], verified: true, investorType: 'individual', region: 'aghdam', plotsCount: 3,
    preferences: { budgetMin: 50000, budgetMax: 400000, fieldTypes: ['orchards', 'greenhouse'], regions: ['zangilan', 'fuzuli'], riskTolerance: 'medium' },
  },
  {
    id: 'u-owner', fullName: 'Rauf Həsənov', email: 'owner@agroinvest.az', phone: '+994 55 321 44 10', avatar: null,
    roles: ['landowner'], verified: true, region: 'aghdam', plotsCount: 5,
    preferences: { budgetMin: 0, budgetMax: 0, fieldTypes: [], regions: [], riskTolerance: 'medium' },
  },
  {
    id: 'u-investor', fullName: 'Kamran Əliyev', email: 'investor@agroinvest.az', phone: '+994 70 455 12 90', avatar: null,
    roles: ['investor'], verified: true, investorType: 'company', companyName: 'Kür Agro MMC',
    preferences: { budgetMin: 100000, budgetMax: 600000, fieldTypes: ['crops', 'orchards', 'livestock'], regions: ['aghdam', 'fuzuli', 'jabrayil'], riskTolerance: 'medium' },
  },
  // Other platform users (owners / investors that appear in lists)
  { id: 'u-o4', fullName: 'Nigar Quliyeva', email: 'nigar@example.az', phone: '+994 51 600 11 22', avatar: null, roles: ['landowner'], verified: false, preferences: { budgetMin: 0, budgetMax: 0, fieldTypes: [], regions: [], riskTolerance: 'low' } },
  { id: 'u-o5', fullName: 'Elçin Babayev', email: 'elchin@example.az', phone: '+994 50 777 18 40', avatar: null, roles: ['landowner'], verified: true, preferences: { budgetMin: 0, budgetMax: 0, fieldTypes: [], regions: [], riskTolerance: 'low' } },
  { id: 'u-i6', fullName: 'Tural Nəsirov', email: 'tural@example.az', phone: '+994 55 901 22 33', avatar: null, roles: ['investor'], verified: true, investorType: 'individual', preferences: { budgetMin: 30000, budgetMax: 200000, fieldTypes: ['greenhouse'], regions: [], riskTolerance: 'low' } },
  { id: 'u-i7', fullName: 'Aysel Rzayeva', email: 'aysel@example.az', phone: '+994 70 120 98 76', avatar: null, roles: ['investor'], verified: false, investorType: 'company', companyName: 'Qarabağ Bağları', preferences: { budgetMin: 200000, budgetMax: 900000, fieldTypes: ['orchards'], regions: [], riskTolerance: 'high' } },
  { id: 'u-i8', fullName: 'Orxan Kərimov', email: 'orxan@example.az', phone: '+994 50 333 41 41', avatar: null, roles: ['investor'], verified: true, investorType: 'individual', preferences: { budgetMin: 50000, budgetMax: 300000, fieldTypes: ['livestock'], regions: [], riskTolerance: 'medium' } },
];

type Row = [id: string, owner: string, type: string, region: string, area: number, soil: SoilType, fert: number, irr: Irrigation, min: number, max: number, model: InvestmentModel, ret: number, dur: number, raised: number, status: Land['status'], photos: string[], special?: boolean];

const c = (n: string) => `/images/categories/${n}-sm.jpg`;
const s = (n: string) => `/images/site/${n}-sm.jpg`;

const ROWS: Row[] = [
  ['L-101', 'u-owner', 'crops', 'aghdam', 120, 'chestnut', 78, 'canal', 250000, 400000, 'profitSharing', 14, 36, 120000, 'active', [c('crops-12'), c('crops-1'), s('photo-08'), c('crops-11')], true],
  ['L-102', 'u-owner', 'orchards', 'zangilan', 45, 'alluvial', 84, 'drip', 180000, 320000, 'jointVenture', 18, 60, 95000, 'active', [c('orchards-6'), c('orchards-8'), c('orchards-2')]],
  ['L-103', 'u-owner', 'livestock', 'kalbajar', 300, 'mountainMeadow', 66, 'well', 150000, 280000, 'lease', 12, 48, 280000, 'funded', [c('livestock-2'), c('livestock-4'), c('livestock-1')]],
  ['L-104', 'u-owner', 'greenhouse', 'fuzuli', 6, 'grayBrown', 72, 'drip', 300000, 450000, 'profitSharing', 20, 36, 0, 'underReview', [c('greenhouse-4'), c('greenhouse-1')]],
  ['L-105', 'u-owner', 'crops', 'jabrayil', 210, 'chestnut', 61, 'none', 200000, 350000, 'lease', 10, 24, 0, 'draft', [c('crops-2')]],
  ['L-106', 'u-both', 'orchards', 'fuzuli', 60, 'alluvial', 80, 'drip', 220000, 380000, 'profitSharing', 17, 60, 60000, 'active', [c('orchards-7'), s('photo-02'), c('orchards-1')]],
  ['L-107', 'u-both', 'beekeeping', 'gubadli', 15, 'mountainMeadow', 70, 'none', 40000, 90000, 'jointVenture', 15, 24, 25000, 'active', ['/images/beekeeping-gubadli.jpg']],
  ['L-108', 'u-both', 'nursery', 'aghdam', 4, 'chernozem', 88, 'drip', 60000, 120000, 'profitSharing', 19, 24, 0, 'underReview', [s('photo-11'), s('photo-14')]],
  ['L-109', 'u-o4', 'crops', 'barda', 340, 'chernozem', 86, 'canal', 350000, 600000, 'profitSharing', 13, 36, 210000, 'active', [c('crops-16'), c('crops-5'), s('photo-25')], true],
  ['L-110', 'u-o4', 'greenhouse', 'lankaran', 8, 'alluvial', 82, 'drip', 280000, 420000, 'jointVenture', 22, 48, 150000, 'active', [c('greenhouse-5'), c('greenhouse-2')]],
  ['L-111', 'u-o5', 'livestock', 'lachin', 420, 'mountainMeadow', 64, 'well', 120000, 260000, 'lease', 11, 36, 40000, 'active', [c('livestock-3'), c('livestock-5')]],
  ['L-112', 'u-o5', 'pasture', 'shusha', 500, 'mountainMeadow', 58, 'none', 60000, 140000, 'lease', 8, 60, 20000, 'active', [s('photo-04'), c('crops-17')]],
  ['L-113', 'u-o5', 'orchards', 'guba', 70, 'grayBrown', 90, 'drip', 260000, 480000, 'profitSharing', 21, 72, 300000, 'active', [c('orchards-4'), c('orchards-3'), s('photo-02')], true],
  ['L-114', 'u-o4', 'crops', 'sabirabad', 260, 'sandyLoam', 52, 'canal', 150000, 300000, 'lease', 9, 24, 30000, 'active', [c('crops-14'), c('crops-6')]],
  ['L-115', 'u-o5', 'mixed', 'tartar', 140, 'chestnut', 74, 'canal', 180000, 320000, 'jointVenture', 13, 36, 90000, 'active', [c('crops-4'), c('crops-10')]],
  ['L-116', 'u-o4', 'processing', 'ganja', 3, 'grayBrown', 50, 'well', 400000, 700000, 'jointVenture', 16, 60, 180000, 'active', [s('photo-02'), s('photo-06')]],
  ['L-117', 'u-o5', 'machinery', 'aghdam', 2, 'chestnut', 45, 'none', 150000, 250000, 'lease', 12, 36, 0, 'active', [s('photo-22'), s('photo-18')]],
  ['L-118', 'u-o4', 'crops', 'sheki', 95, 'chernozem', 83, 'canal', 120000, 220000, 'profitSharing', 14, 24, 60000, 'active', [c('crops-8'), c('crops-13')]],
  ['L-119', 'u-o5', 'orchards', 'shamakhi', 55, 'grayBrown', 79, 'drip', 160000, 300000, 'profitSharing', 19, 60, 40000, 'active', [s('photo-09'), s('photo-03')]],
  ['L-120', 'u-o4', 'agrotourism', 'shusha', 12, 'mountainMeadow', 60, 'well', 300000, 550000, 'jointVenture', 15, 84, 50000, 'active', [c('crops-15'), c('crops-17')]],
  ['L-121', 'u-o5', 'renewable', 'jabrayil', 80, 'sandyLoam', 30, 'none', 700000, 1200000, 'jointVenture', 11, 120, 300000, 'active', [s('photo-13'), s('photo-24')]],
  ['L-122', 'u-o4', 'nursery', 'zangilan', 5, 'alluvial', 87, 'drip', 70000, 140000, 'profitSharing', 18, 24, 35000, 'active', [s('photo-14'), s('photo-11')]],
  ['L-123', 'u-o5', 'crops', 'fuzuli', 180, 'chestnut', 69, 'none', 160000, 280000, 'lease', 10, 36, 0, 'active', [c('crops-9'), s('photo-19')]],
  ['L-124', 'u-o4', 'livestock', 'khojavend', 150, 'chestnut', 62, 'well', 110000, 230000, 'profitSharing', 13, 36, 70000, 'active', [c('livestock-1'), s('photo-04')]],
];

const LAST_CROP: Record<string, string> = {
  crops: 'wheat', orchards: 'apple', livestock: 'fodder', greenhouse: 'tomato', beekeeping: 'clover', nursery: 'seedlings',
  pasture: 'grass', mixed: 'barley', processing: 'none', machinery: 'none', agrotourism: 'grass', renewable: 'none',
};
const VOLATILITY: Record<string, number> = { crops: 0.4, orchards: 0.35, greenhouse: 0.3, livestock: 0.45, beekeeping: 0.5, nursery: 0.3, pasture: 0.35, mixed: 0.3, processing: 0.25, machinery: 0.2, agrotourism: 0.55, renewable: 0.2 };
const VERIFIED: Record<string, boolean> = { 'u-owner': true, 'u-both': true, 'u-o4': false, 'u-o5': true };

export const SEED_LANDS: Land[] = ROWS.map(([id, ownerId, fieldType, region, areaHa, soilType, fertilityPct, irrigation, investmentMin, investmentMax, investmentModel, expectedReturnPct, durationMonths, raisedAmount, status, photos, isSpecial], i) => {
  const r = regionByKey(region)!;
  // Spread markers a little around the region centre
  const lat = +(r.lat + Math.sin(i * 1.7) * 0.06).toFixed(5);
  const lng = +(r.lng + Math.cos(i * 1.3) * 0.08).toFixed(5);
  const day = new Date(Date.UTC(2026, 5 + (i % 4), 2 + i));
  return {
    id, ownerId, fieldType, region, address: '', lat, lng, areaHa, soilType, fertilityPct, irrigation,
    lastCrop: LAST_CROP[fieldType] ?? 'none', roadAccess: i % 5 !== 3, electricity: i % 4 !== 2, ownershipDoc: 'extract',
    investmentMin, investmentMax, investmentModel, expectedReturnPct, durationMonths, isSpecial: !!isSpecial,
    photos, documents: [{ name: 'cixaris.pdf', size: 420000 }], status, raisedAmount,
    views: 120 + ((i * 97) % 900), ownerVerified: VERIFIED[ownerId] ?? false, priceVolatility: VOLATILITY[fieldType] ?? 0.4,
    createdAt: day.toISOString(), winnerRequestId: status === 'funded' ? 'R-209' : null,
  };
});

const rq = (id: string, landId: string, investorId: string, amount: number, model: InvestmentModel, dur: number, status: InvestmentRequest['status'], dayOffset: number, viewed = true, message = 'requestMessages.default'): InvestmentRequest => {
  const d = new Date(Date.UTC(2026, 8, 1 + dayOffset)).toISOString();
  return { id, landId, investorId, amount, investmentModel: model, durationMonths: dur, message, status, viewedByOwner: viewed, createdAt: d, updatedAt: d };
};

export const SEED_REQUESTS: InvestmentRequest[] = [
  rq('R-201', 'L-101', 'u-investor', 300000, 'profitSharing', 36, 'pending', 30, true, 'requestMessages.experience'),
  rq('R-202', 'L-101', 'u-i6', 260000, 'profitSharing', 36, 'pending', 32, false),
  rq('R-203', 'L-102', 'u-both', 200000, 'jointVenture', 60, 'pending', 33, false, 'requestMessages.orchard'),
  rq('R-204', 'L-102', 'u-i7', 320000, 'jointVenture', 60, 'pending', 35, false),
  rq('R-205', 'L-106', 'u-investor', 240000, 'profitSharing', 60, 'pending', 34),
  rq('R-206', 'L-109', 'u-investor', 400000, 'profitSharing', 36, 'pending', 28, true, 'requestMessages.experience'),
  rq('R-207', 'L-113', 'u-investor', 260000, 'profitSharing', 72, 'notSelected', 10),
  rq('R-208', 'L-103', 'u-investor', 160000, 'lease', 48, 'notSelected', 5),
  rq('R-209', 'L-103', 'u-i8', 280000, 'lease', 48, 'selected', 6),
  rq('R-210', 'L-110', 'u-both', 300000, 'jointVenture', 48, 'pending', 36),
  rq('R-211', 'L-107', 'u-i6', 50000, 'jointVenture', 24, 'pending', 37, false),
  rq('R-212', 'L-111', 'u-investor', 150000, 'lease', 36, 'selected', 12),
];

export const SEED_NOTIFICATIONS: AppNotification[] = [
  { id: 'N-1', userId: 'u-owner', type: 'request', textKey: 'notifications.newRequest', values: { land: 'L-102' }, link: '/owner/requests', read: false, createdAt: '2026-10-06T09:00:00Z' },
  { id: 'N-2', userId: 'u-owner', type: 'request', textKey: 'notifications.newRequest', values: { land: 'L-101' }, link: '/owner/requests', read: false, createdAt: '2026-10-03T09:00:00Z' },
  { id: 'N-3', userId: 'u-owner', type: 'review', textKey: 'notifications.underReview', values: { land: 'L-104' }, link: '/owner/properties', read: true, createdAt: '2026-09-20T09:00:00Z' },
  { id: 'N-4', userId: 'u-investor', type: 'decision', textKey: 'notifications.selected', values: { land: 'L-111' }, link: '/investor/investments', read: false, createdAt: '2026-09-14T09:00:00Z' },
  { id: 'N-5', userId: 'u-investor', type: 'decision', textKey: 'notifications.notSelected', values: { land: 'L-113' }, link: '/investor/investments', read: true, createdAt: '2026-09-12T09:00:00Z' },
  { id: 'N-6', userId: 'u-both', type: 'request', textKey: 'notifications.newRequest', values: { land: 'L-107' }, link: '/owner/requests', read: false, createdAt: '2026-10-08T09:00:00Z' },
];
