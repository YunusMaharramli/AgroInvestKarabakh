import { Application } from '../types/index.js';

export type StatusInfo = {
  /** Short plain label */
  label: string;
  /** One sentence: what this means for the applicant */
  explain: string;
  /** Tailwind classes for the badge */
  badge: string;
  /** 0 = received, 1 = being reviewed, 2 = decided */
  step: number;
  needsAction: boolean;
};

export function statusInfo(app: Pick<Application, 'status' | 'decisionOutcome'>): StatusInfo {
  switch (app.status) {
    case 'DECIDED':
      return app.decisionOutcome === 'APPROVED'
        ? { label: 'Təsdiq edildi', explain: 'Təbriklər! Müraciətiniz qəbul olundu. Sizinlə əlaqə saxlanılacaq.', badge: 'bg-brand-700 text-white', step: 2, needsAction: false }
        : { label: 'Rədd edildi', explain: 'Təəssüf ki, bu dəfə müraciətiniz təsdiq olunmadı. Səbəbi aşağıda yazılıb.', badge: 'bg-[#8E2A1F] text-white', step: 2, needsAction: false };
    case 'UNDER_REVIEW':
      return { label: 'Yoxlanılır', explain: 'Komissiya müraciətinizi yoxlayır. Sizdən heç nə tələb olunmur.', badge: 'bg-gold-100 text-gold-900', step: 1, needsAction: false };
    case 'ADDITIONAL_INFORMATION_REQUIRED':
      return { label: 'Sizdən cavab gözlənilir', explain: 'Komissiya əlavə məlumat istəyir. Zəhmət olmasa cavab yazın.', badge: 'bg-[#C0392B] text-white', step: 1, needsAction: true };
    default:
      return { label: 'Qəbul edildi', explain: 'Müraciətiniz alındı və növbəyə qoyuldu.', badge: 'bg-brand-50 text-brand-900', step: 0, needsAction: false };
  }
}

export const STATUS_STEPS = ['Göndərildi', 'Yoxlanılır', 'Qərar verildi'];
