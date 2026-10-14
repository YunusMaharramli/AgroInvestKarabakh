import { LandStatus, Proposal, ProposalStatus } from '../types/index.js';

export type StatusInfo = {
  /** Short plain label */
  label: string;
  /** One sentence: what this means for the investor */
  explain: string;
  /** Tailwind classes for the badge */
  badge: string;
  /** 0 = sent, 1 = waiting for the owner's decision, 2 = decided */
  step: number;
};

/** Proposal status as the investor sees it. */
export function statusInfo(p: Pick<Proposal, 'status'> | { status: ProposalStatus }): StatusInfo {
  switch (p.status) {
    case 'SELECTED':
      return { label: 'Qalib seçildi', explain: 'Təbriklər! Təklifiniz seçildi. Elan sahibi sizinlə əlaqə saxlayacaq.', badge: 'bg-brand-700 text-white', step: 2 };
    case 'NOT_SELECTED':
      return { label: 'Seçilmədi', explain: 'Bu elan üçün başqa təklif seçildi. Maraq göstərdiyiniz üçün təşəkkür edirik.', badge: 'bg-[#8E2A1F] text-white', step: 2 };
    default:
      return { label: 'Gözləyir', explain: 'Təklifiniz göndərilib. Elan sahibi qərar verəndə sizə bildiriş gələcək.', badge: 'bg-gold-100 text-gold-900', step: 1 };
  }
}

export const STATUS_STEPS = ['Göndərildi', 'Qərar gözlənilir', 'Qərar verildi'];

/** Land review status as the owner (and admin) sees it. */
export function landStatusInfo(status: LandStatus): { label: string; explain: string; badge: string } {
  switch (status) {
    case 'APPROVED':
      return { label: 'Təsdiq edildi', explain: 'Sahəniz dərc olunub, investorlar təklif göndərə bilər.', badge: 'bg-brand-700 text-white' };
    case 'DOCUMENTS_REQUESTED':
      return { label: 'Əlavə sənəd lazımdır', explain: 'İnzibatçı əlavə sənəd istəyir. Aşağıdakı qeydi oxuyun və sənədi yükləyin.', badge: 'bg-[#C0392B] text-white' };
    case 'REJECTED':
      return { label: 'Təsdiq olunmadı', explain: 'Sahə təsdiq olunmadı. Səbəb aşağıda yazılıb.', badge: 'bg-[#8E2A1F] text-white' };
    default:
      return { label: 'Yoxlanılır', explain: 'İnzibatçı sənədlərinizi yoxlayır. Nəticə barədə bildiriş gələcək.', badge: 'bg-gold-100 text-gold-900' };
  }
}

/** Azerbaijani phone check, same rules as the server: +994 + 2-digit code + 7 digits. */
const PHONE_CODES = new Set(['10', '50', '51', '55', '60', '70', '77', '99', '12', '18', '20', '21', '22', '23', '24', '25', '26', '36']);
export function normalizeAzPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!/^[+\d\s\-(). ]+$/.test(trimmed) || trimmed.indexOf('+', 1) >= 0) return null;
  const d = trimmed.replace(/\D/g, '');
  let national: string;
  if (d.startsWith('00994') && d.length === 14) national = d.slice(5);
  else if (d.startsWith('994') && d.length === 12) national = d.slice(3);
  else if (d.startsWith('0') && d.length === 10 && !trimmed.startsWith('+')) national = d.slice(1);
  else if (d.length === 9 && !trimmed.startsWith('+')) national = d;
  else return null;
  const code = national.slice(0, 2);
  const sub = national.slice(2);
  if (!PHONE_CODES.has(code) || sub[0] === '0') return null;
  return `+994 ${code} ${sub.slice(0, 3)} ${sub.slice(3, 5)} ${sub.slice(5)}`;
}

/** Read an error message from an API response. */
export async function apiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return typeof data?.error === 'string' ? data.error : fallback;
  } catch {
    return fallback;
  }
}
