/** Azerbaijan regions used in forms and filters. Names are translated under "regions.<key>". */
export interface Region {
  key: string;
  lat: number;
  lng: number;
  /** 0 (low) – 1 (high) climate / drought risk, used by the mock risk score. */
  climateRisk: number;
}

export const REGIONS: Region[] = [
  { key: 'aghdam', lat: 39.993, lng: 46.93, climateRisk: 0.45 },
  { key: 'fuzuli', lat: 39.6, lng: 47.14, climateRisk: 0.55 },
  { key: 'jabrayil', lat: 39.4, lng: 47.03, climateRisk: 0.6 },
  { key: 'zangilan', lat: 39.09, lng: 46.65, climateRisk: 0.35 },
  { key: 'gubadli', lat: 39.34, lng: 46.58, climateRisk: 0.35 },
  { key: 'lachin', lat: 39.64, lng: 46.55, climateRisk: 0.3 },
  { key: 'kalbajar', lat: 40.1, lng: 46.04, climateRisk: 0.25 },
  { key: 'khojavend', lat: 39.79, lng: 47.0, climateRisk: 0.45 },
  { key: 'shusha', lat: 39.76, lng: 46.75, climateRisk: 0.25 },
  { key: 'khankendi', lat: 39.82, lng: 46.76, climateRisk: 0.3 },
  { key: 'tartar', lat: 40.34, lng: 46.93, climateRisk: 0.5 },
  { key: 'ganja', lat: 40.68, lng: 46.36, climateRisk: 0.35 },
  { key: 'shamakhi', lat: 40.63, lng: 48.64, climateRisk: 0.3 },
  { key: 'guba', lat: 41.36, lng: 48.51, climateRisk: 0.2 },
  { key: 'lankaran', lat: 38.75, lng: 48.85, climateRisk: 0.2 },
  { key: 'sheki', lat: 41.19, lng: 47.17, climateRisk: 0.2 },
  { key: 'barda', lat: 40.37, lng: 47.13, climateRisk: 0.55 },
  { key: 'sabirabad', lat: 40.01, lng: 48.47, climateRisk: 0.7 },
];

/** Areas offered for admin-entered Qarabağ investment listings. */
export const INVESTMENT_REGIONS = REGIONS.filter(r => [
  'aghdam', 'fuzuli', 'jabrayil', 'zangilan', 'gubadli', 'lachin', 'kalbajar', 'khojavend', 'shusha', 'khankendi', 'tartar',
].includes(r.key));

export const regionByKey = (key: string) => REGIONS.find(r => r.key === key);
