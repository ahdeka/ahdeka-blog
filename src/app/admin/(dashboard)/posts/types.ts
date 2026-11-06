import type { Locale } from '@/i18n/config';

export type PostStatus = 'draft' | 'published';

export type TranslationInput = {
  title: string;
  summary: string;
  content: string; // Markdown
  // 번역본: 번역 기준이 된 원문(KO)의 해시 (원문 변경 감지용). 원문·미기록은 null
  sourceHash: string | null;
};

export type PostInput = {
  id?: string;
  status: PostStatus; // 글 단위 공개 상태
  categoryId: number | null;
  translations: Record<Locale, TranslationInput>;
};

export type ActionResult = { ok: true; id: string; warning?: string } | { ok: false; error: string };