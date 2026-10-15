import type { AppUser } from '../../types/agro';
import { authService } from '../../services/api';

/**
 * Where to send a user after login (Part 2, 1.3):
 * both cabinets -> chooser (unless a choice was remembered), one cabinet -> that cabinet, none -> role selection.
 */
export function cabinetHome(user: AppUser): string {
  if (user.isAdmin) return '/admin';
  const roles = user.roles;
  if (roles.length === 0) return '/signup?step=role';
  if (roles.length === 1) return roles[0] === 'landowner' ? '/owner' : '/investor';
  const remembered = authService.rememberedCabinet();
  if (remembered && roles.includes(remembered)) return remembered === 'landowner' ? '/owner' : '/investor';
  return '/choose-cabinet';
}
