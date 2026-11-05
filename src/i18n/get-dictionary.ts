import 'server-only';
import type { Locale } from './config';

const dictionaries = {
  ja: () => import('./dictionaries/ja.json').then((m) => m.default),
  ko: () => import('./dictionaries/ko.json').then((m) => m.default),
};

export const getDictionary = (locale: Locale) => dictionaries[locale]();
export type Dictionary = Awaited<ReturnType<typeof getDictionary>>;