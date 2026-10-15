import type { AppNotification, AppUser, InvestmentRequest, Land } from '../types/agro';
import { SEED_LANDS, SEED_NOTIFICATIONS, SEED_REQUESTS, SEED_USERS } from '../mocks/seed';

/**
 * Tiny mock database kept in localStorage so actions survive a page refresh
 * (a request sent by an investor shows up in the landowner's cabinet).
 * Replace the services in this folder with real API calls later; components only use the services.
 */
export interface MockDb {
  version: number;
  users: AppUser[];
  lands: Land[];
  requests: InvestmentRequest[];
  notifications: AppNotification[];
  saved: Record<string, string[]>; // userId -> landIds
}

const KEY = 'agroinvest_mock_db';
const VERSION = 3;

function seed(): MockDb {
  return {
    version: VERSION,
    users: structuredClone(SEED_USERS),
    lands: structuredClone(SEED_LANDS),
    requests: structuredClone(SEED_REQUESTS),
    notifications: structuredClone(SEED_NOTIFICATIONS),
    saved: { 'u-investor': ['L-102', 'L-113'], 'u-both': ['L-109'] },
  };
}

let cache: MockDb | null = null;
const listeners = new Set<() => void>();

export function db(): MockDb {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MockDb;
      if (parsed.version === VERSION) { cache = parsed; return cache; }
    }
  } catch { /* storage unavailable: fall back to memory */ }
  cache = seed();
  persist();
  return cache;
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* ignore */ }
}

/** Apply a change, save it and notify subscribers (React components re-read data). */
export function mutate(fn: (d: MockDb) => void) {
  fn(db());
  persist();
  listeners.forEach(l => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function resetMockDb() {
  cache = seed();
  persist();
  listeners.forEach(l => l());
}

/** Simulated network delay so loading (skeleton) states are visible. */
export const delay = <T,>(value: T, ms = 350) => new Promise<T>(resolve => setTimeout(() => resolve(value), ms));

export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
