import type { Locale } from '@/i18n/config';
import type { TagInput } from '@/lib/tags';

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
  tags: TagInput[]; // 넣은 순서대로. 기존 태그는 이름으로 찾고, 없으면 저장할 때 slug와 함께 새로 만듦
  coverImagePath: string | null; // Storage 경로. 원문(KO) 본문에 있는 이미지 중 하나
  translations: Record<Locale, TranslationInput>;
};

export type ActionResult = { ok: true; id: string; warning?: string } | { ok: false; error: string };