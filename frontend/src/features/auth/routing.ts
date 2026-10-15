import type { AppUser } from '../../types/agro';

/** The product has one USER cabinet for rental applicants; applicant type is profile data, never a role. */
export function cabinetHome(user: AppUser): string {
  if (user.isAdmin) return '/admin';
  return '/applicant';
}
