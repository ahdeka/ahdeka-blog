import type { Locale } from '@/i18n/config';

// 날짜는 모두 일본 시간 기준 "2026.11.04" 형식 (시안 그대로, 언어와 무관)
// Vercel 서버는 UTC라서 시간대를 명시하지 않으면 하루 어긋날 수 있음
const dateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function parts(iso: string) {
  const p = Object.fromEntries(dateParts.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return p as Record<'year' | 'month' | 'day' | 'hour' | 'minute', string>;
}

export function formatDate(iso: string): string {
  const p = parts(iso);
  return `${p.year}.${p.month}.${p.day}`;
}

export function formatDateTime(iso: string): string {
  const p = parts(iso);
  return `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}`;
}

// 읽는 시간: 코드 블록·이미지·마크다운 기호를 빼고 글자 수로 계산 (한·일 모두 분당 약 500자)
export function readingMinutes(markdown: string): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[#>*_`~\-|[\]()]/g, '')
    .replace(/\s+/g, '');
  return Math.max(1, Math.round(text.length / 500));
}

// 사전 문구의 {n}, {name} 등을 치환
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));
}

export const otherLocale = (locale: Locale): Locale => (locale === 'ja' ? 'ko' : 'ja');
