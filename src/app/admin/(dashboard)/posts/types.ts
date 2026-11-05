import type { Locale } from '@/i18n/config';

export type PostStatus = 'draft' | 'published';

export type TranslationInput = {
  title: string;
  summary: string;
  content: string; // Markdown
};

export type PostInput = {
  id?: string;
  status: PostStatus; // 글 단위 공개 상태
  categoryId: number | null;
  translations: Record<Locale, TranslationInput>;
};

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };