import type { AppUser } from '../../types/agro';

/** Where a signed-in user belongs: admins → admin panel; applicants who have not finished signing up → last sign-up step. */
export function cabinetHome(user: AppUser): string {
  if (user.isAdmin) return '/admin';
  if (user.needsOnboarding) return '/signup?step=details';
  return '/investor';
}
