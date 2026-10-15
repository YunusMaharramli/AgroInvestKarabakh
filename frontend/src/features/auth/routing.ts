import type { AppUser } from '../../types/agro';

/** Applicants must complete the core profile step before entering their cabinet. */
export function cabinetHome(user: AppUser): string {
  if (user.isAdmin) return '/admin';
  if (user.needsOnboarding) return '/signup?step=details';
  return '/investor';
}
