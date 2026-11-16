import { t } from '../i18n';

import { CITY_SECTIONS } from './citySectionIds';

import type { CitySectionId } from '../types';


const TITLES: Record<CitySectionId, () => string> = {
  overview: () => t('city.hourlyLink'),
  next48: () => `${t('radar.tab')} / ${t('city.next48')}`,
  next7: () => t('city.next7'),
  feels: () => t('city.feels.title'),
  sun: () => t('city.sun.title'),
  precip: () => t('city.precip.title'),
  wind: () => t('city.wind.title'),
  air: () => t('city.air.title'),
  pollen: () => t('city.pollen.title'),
  sky: () => t('city.sky.title'),
  atmosphere: () => t('city.atmosphere.title'),
  sea: () => t('city.sea.title'),
};

export function sectionTitle(id: CitySectionId): string {
  return TITLES[id]();
}

export function completeOrder(order: readonly CitySectionId[]): CitySectionId[] {
  const result = order.filter((id, i) => CITY_SECTIONS.includes(id) && order.indexOf(id) === i);
  for (const [at, id] of CITY_SECTIONS.entries()) {
    if (!result.includes(id)) { result.splice(Math.min(at, result.length), 0, id); }
  }
  return result;
}
