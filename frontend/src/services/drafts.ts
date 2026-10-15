import { useCallback, useRef, useSyncExternalStore } from 'react';

/**
 * Add-land drafts, kept in this browser and scoped to ONE account (the key contains the user id),
 * so another account signed in on the same computer never sees them.
 * Photos are not stored (browser file links do not survive a reload); the owner adds them again.
 */
export interface LandDraftRecord<T> {
  id: string;
  savedAt: string;
  step: number;
  data: T;
}

const LEGACY_KEY = 'agroinvest_add_land_draft'; // old global key shared by all accounts: removed
const keyFor = (userId: string) => `agroinvest_land_drafts:${userId}`;
const listeners = new Set<() => void>();

try { localStorage.removeItem(LEGACY_KEY); } catch { /* storage unavailable */ }

function read<T>(userId: string): LandDraftRecord<T>[] {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function write<T>(userId: string, drafts: LandDraftRecord<T>[]) {
  try { localStorage.setItem(keyFor(userId), JSON.stringify(drafts)); } catch { /* storage full or blocked */ }
  listeners.forEach(l => l());
}

export const draftStore = {
  list<T>(userId: string): LandDraftRecord<T>[] {
    return read<T>(userId).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  },
  get<T>(userId: string, id: string): LandDraftRecord<T> | undefined {
    return read<T>(userId).find(d => d.id === id);
  },
  /** Saves (creates or replaces) a draft and returns its id. */
  save<T>(userId: string, draft: { id?: string | null; step: number; data: T }): string {
    const id = draft.id || `D-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const rest = read<T>(userId).filter(d => d.id !== id);
    write(userId, [{ id, step: draft.step, data: draft.data, savedAt: new Date().toISOString() }, ...rest].slice(0, 20));
    return id;
  },
  remove(userId: string, id: string) {
    write(userId, read(userId).filter(d => d.id !== id));
  },
};

/** React hook: the signed-in user's drafts (re-renders when they change). */
export function useLandDrafts<T>(userId: string | undefined): LandDraftRecord<T>[] {
  const sub = useCallback((cb: () => void) => {
    listeners.add(cb);
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key.startsWith('agroinvest_land_drafts:')) cb(); };
    window.addEventListener('storage', onStorage);
    return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
  }, []);
  const last = useRef<{ key: string; value: LandDraftRecord<T>[] }>({ key: '', value: [] });
  return useSyncExternalStore(sub, () => {
    if (!userId) return last.current.value;
    const value = draftStore.list<T>(userId);
    const key = JSON.stringify(value);
    if (key !== last.current.key) last.current = { key, value };
    return last.current.value;
  });
}
