export const locales = ['ja', 'ko'] as const;
export type Locale = (typeof locales)[number];

// 기본값은 일본어로
export const defaultLocale: Locale = 'ja';

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}