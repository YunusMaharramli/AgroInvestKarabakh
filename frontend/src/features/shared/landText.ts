import { useTranslation } from 'react-i18next';
import type { Land } from '../../types/agro';
import { landService } from '../../services/api';

/** Land display name in the current language (custom owner title wins). */
export function useLandName() {
  const { t } = useTranslation();
  return (land: Pick<Land, 'title' | 'fieldType' | 'region'> | undefined | null) =>
    !land ? '' : land.title?.trim() || t('land.title', { type: t(`fieldTypes.${land.fieldType}`), region: t(`regions.${land.region}`) });
}

/** Name by id (used in notifications: "{{land}}" holds a land id). */
export function useLandNameById() {
  const name = useLandName();
  return (id: string) => name(landService.get(id)) || id;
}
