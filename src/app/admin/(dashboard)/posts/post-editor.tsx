'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { locales, type Locale } from '@/i18n/config';
import MarkdownView from '@/components/markdown-view';
import { formatDateTime, readingMinutes } from '@/lib/format';
import { ACCEPT_ATTR, uploadPostImage } from '@/lib/images/upload-post-image';
import { hasPlaceholder, removePlaceholder, uploadPlaceholder } from '@/lib/images/placeholder';
import { describeImageDiff, diffImages, extractImages, SOURCE_LOCALE, sourceHash } from '@/lib/post-structure';
import { buildTranslationPrompt, parseTranslationResult } from '@/lib/translation-prompt';
import type { TagInput } from '@/lib/tags';
import { deletePost, savePost } from './actions';
import CoverField from './cover-field';
import TagField from './tag-field';
import type { PostInput, PostStatus, TranslationInput } from './types';

type Category = { id: number; name_ko: string; depth: 0 | 1 };
type Props = {
  initial?: PostInput & { id: string; number: number; publishedAt: string | null };
  categories: Category[];
  tagOptions: TagInput[];
};

const TABS: { code: Locale; label: string }[] = [
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '日本語' },
];

const TITLE_MAX = 200; // DB 제약과 같음
const JA_TITLE_RECOMMENDED = 30;

const emptyTranslation: TranslationInput = { title: '', summary: '', content: '', sourceHash: null };

// 번역 대상 = 원문(KO)을 뺀 모든 언어 (영어를 추가하면 자동으로 포함)
const TARGETS = locales.filter((l) => l !== SOURCE_LOCALE);

type ViewMode = 'edit' | 'split' | 'preview';
const VIEW_LABELS: Record<ViewMode, string> = { edit: '편집', split: '분할', preview: '미리보기' };

const timeFormat = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

// ---------------------------------------------------------------------
// 서식 도구: 선택 영역을 받아 새 본문과 새 선택 영역을 돌려줌
// ---------------------------------------------------------------------
type Edit = { value: string; start: number; end: number };
type EditFn = (value: string, start: number, end: number) => Edit;

const wrap =
  (before: string, after = before, placeholder = ''): EditFn =>
  (v, s, e) => {
    const sel = v.slice(s, e) || placeholder;
    return { value: v.slice(0, s) + before + sel + after + v.slice(e), start: s + before.length, end: s + before.length + sel.length };
  };

// 선택한 줄들의 맨 앞에 붙임 (제목은 기존 # 를 바꿔 끼움)
const linePrefix =
  (prefix: string, replace?: RegExp): EditFn =>
  (v, s, e) => {
    const lineStart = v.lastIndexOf('\n', s - 1) + 1;
    const lineEnd = v.indexOf('\n', e) === -1 ? v.length : v.indexOf('\n', e);
    const lines = v
      .slice(lineStart, lineEnd)
      .split('\n')
      .map((l) => prefix + (replace ? l.replace(replace, '') : l));
    const block = lines.join('\n');
    return { value: v.slice(0, lineStart) + block + v.slice(lineEnd), start: lineStart + prefix.length, end: lineStart + block.length };
  };

// 독립된 블록으로 삽입 (앞뒤 빈 줄 확보)
const block =
  (open: string, close: string, placeholder: string): EditFn =>
  (v, s, e) => {
    const sel = v.slice(s, e) || placeholder;
    const before = v.slice(0, s);
    const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    const text = `${lead}${open}\n${sel}\n${close}\n`;
    const start = s + lead.length + open.length + 1;
    return { value: before + text + v.slice(e), start, end: start + sel.length };
  };

// 커서 위치에 독립 문단으로 끼워 넣음 (앞뒤로 빈 줄을 둬서 문단과 분리)
function insertParagraph(content: string, pos: number, text: string) {
  const at = Math.min(pos, content.length);
  const before = content.slice(0, at);
  const after = content.slice(at);
  const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const tail = after.startsWith('\n') ? '\n' : '\n\n';
  return { value: before + lead + text + tail + after, cursor: at + lead.length + text.length };
}

// 원문에 없는 이미지 줄 제거 (줄 전체가 그 이미지 하나일 때는 줄째로)
function removeImages(content: string, urls: string[]) {
  let next = content;
  for (const url of urls) {
    const esc = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`!\\[[^\\]]*\\]\\(\\s*<?${esc}>?(?:\\s+"[^"]*")?\\s*\\)`);
    const m = re.exec(next);
    if (!m) continue;
    let start = m.index;
    let end = start + m[0].length;
    const lineStart = next.lastIndexOf('\n', start - 1) + 1;
    const nl = next.indexOf('\n', end);
    const lineEnd = nl === -1 ? next.length : nl;
    if (next.slice(lineStart, start).trim() === '' && next.slice(end, lineEnd).trim() === '') {
      start = lineStart;
      end = lineEnd;
      if (next.startsWith('\n\n', end)) end += 2;
      else if (next.startsWith('\n', end)) end += 1;
    }
    next = next.slice(0, start) + next.slice(end);
  }
  return next;
}

const link: EditFn = (v, s, e) => {
  const text = v.slice(s, e) || '링크 텍스트';
  const inserted = `[${text}](https://)`;
  const urlStart = s + text.length + 3;
  return { value: v.slice(0, s) + inserted + v.slice(e), start: urlStart, end: urlStart + 'https://'.length };
};

type Tool = { label: string; aria: string; fn?: EditFn; className?: string; icon?: React.ReactNode } | 'sep';

const icon = (d: string) => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const TOOLS: Tool[] = [
  { label: 'H2', aria: '제목 2', fn: linePrefix('## ', /^#{1,6}\s*/) },
  { label: 'H3', aria: '제목 3', fn: linePrefix('### ', /^#{1,6}\s*/) },
  'sep',
  { label: 'B', aria: '굵게', fn: wrap('**', '**', '굵은 글씨'), className: 'font-sans font-extrabold' },
  { label: 'I', aria: '기울임', fn: wrap('*', '*', '기울임'), className: 'font-serif italic' },
  { label: '`c`', aria: '인라인 코드', fn: wrap('`', '`', 'code') },
  { label: '', aria: '링크', fn: link, icon: icon('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1') },
  'sep',
  { label: '', aria: '목록', fn: linePrefix('- '), icon: icon('M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01') },
  { label: '', aria: '코드 블록 (title="파일명"은 선택)', fn: block('```java title="Example.java"', '```', '// code'), icon: icon('m8 8-4 4 4 4M16 8l4 4-4 4') },
  { label: '', aria: '안내 박스 (:::info)', fn: block(':::info', ':::', '안내 내용'), icon: icon('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01') },
];

export default function PostEditor({ initial, categories, tagOptions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState<PostInput>(() =>
    initial
      ? {
          id: initial.id,
          status: initial.status,
          categoryId: initial.categoryId,
          tags: initial.tags,
          coverImagePath: initial.coverImagePath,
          translations: initial.translations,
        }
      : {
          status: 'draft',
          categoryId: null,
          tags: [],
          coverImagePath: null,
          translations: Object.fromEntries(locales.map((l) => [l, { ...emptyTranslation }])) as Record<Locale, TranslationInput>,
        },
  );
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(form));
  const isDirty = JSON.stringify(form) !== savedJson;

  const [tab, setTab] = useState<Locale>('ko');
  const [view, setView] = useState<ViewMode>('split');
  const [showSource, setShowSource] = useState(false); // JA 검수 시 미리보기 자리에 원문(KO) 표시
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [restorable, setRestorable] = useState<PostInput | null>(null);
  const [localSavedAt, setLocalSavedAt] = useState<Date | null>(null);
  const [uploading, setUploading] = useState(0); // 남은 업로드 수
  const [showPicker, setShowPicker] = useState(false); // 번역본: 원문 이미지 선택 패널
  const [pasteOpen, setPasteOpen] = useState(false); // 번역 결과 붙여넣기 패널
  const [pasteText, setPasteText] = useState('');
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 데이터 구조가 바뀌었으므로 키에 v2를 붙여, 예전 형식의 임시 저장본은 무시
  // v3: 번역본에 sourceHash가 생김 / v4: 태그·커버 이미지
  const draftKey = `post-draft:v4:${initial?.id ?? 'new'}`;

  // --- 브라우저 임시 보관 ---
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw && raw !== savedJson) setRestorable(JSON.parse(raw));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(form));
        setLocalSavedAt(new Date());
      } catch {}
    }, 1000);
    return () => clearTimeout(timer);
  }, [form, isDirty, draftKey]);

  // 저장 안 한 상태로 떠나려 하면 경고
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  function updateTranslation(locale: Locale, patch: Partial<TranslationInput>) {
    setForm((f) => ({
      ...f,
      translations: { ...f.translations, [locale]: { ...f.translations[locale], ...patch } },
    }));
  }

  // --- 서식 도구 ---
  function applyTool(fn: EditFn) {
    const el = contentRef.current;
    if (!el) return;
    const next = fn(el.value, el.selectionStart, el.selectionEnd);
    updateTranslation(tab, { content: next.value });
    // 값이 반영된 뒤 선택 영역 복원
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.start, next.end);
    });
  }

  // --- 이미지 업로드 ---
  // 1) 업로드 시작 즉시 커서 위치에 자리표시자를 넣고
  // 2) 끝나면 그 자리표시자 문자열을 실제 이미지로 교체 (실패하면 자리표시자만 제거)
  // → 업로드 중에 글을 계속 써도, 탭을 바꿔도 이미지가 원래 넣은 자리에 들어감
  function updateContent(locale: Locale, fn: (content: string) => string) {
    setForm((f) => {
      const t = f.translations[locale];
      const next = fn(t.content);
      return next === t.content
        ? f
        : { ...f, translations: { ...f.translations, [locale]: { ...t, content: next } } };
    });
  }

  // 이미지는 원문(KO)에서만 새로 올림 → 번역본에는 원문 이미지 중에서 골라 넣기만 가능
  async function addImages(files: File[]) {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    if (tab !== SOURCE_LOCALE) {
      setMessage({ type: 'error', text: '새 이미지는 한국어(원문) 탭에서 추가하세요. 여기서는 원문 이미지를 골라 넣을 수 있어요.' });
      setShowPicker(true);
      return;
    }

    const targetTab = tab;
    const el = contentRef.current;
    const pos = el ? el.selectionEnd : form.translations[targetTab].content.length;
    const jobs = images.map((file) => ({ file, token: uploadPlaceholder(crypto.randomUUID()) }));

    setMessage(null);
    setUploading((n) => n + jobs.length);
    updateContent(targetTab, (content) => insertParagraph(content, pos, jobs.map((j) => j.token).join('\n\n')).value);

    for (const { file, token } of jobs) {
      try {
        const { url } = await uploadPostImage(file);
        // alt는 비워 둠: 화면 낭독기용 설명은 직접 적는 게 좋음 (원본 파일명은 의미가 없는 경우가 많음)
        // 업로드 중에 자리표시자를 지웠다면 아무것도 넣지 않음 (지운 의도를 존중)
        updateContent(targetTab, (content) => content.replace(token, `![](${url})`));
      } catch (e) {
        updateContent(targetTab, (content) => removePlaceholder(content, token));
        setMessage({ type: 'error', text: e instanceof Error ? e.message : '업로드 실패' });
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  // 번역본: 원문 이미지를 커서 위치에 삽입
  function insertSourceImage(url: string) {
    const el = contentRef.current;
    const content = form.translations[tab].content;
    const next = insertParagraph(content, el ? el.selectionEnd : content.length, `![](${url})`);
    updateTranslation(tab, { content: next.value });
    setMessage(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.cursor, next.cursor);
    });
  }

  // --- 번역 (claude.ai 채팅에서 번역 → 결과 붙여넣기) ---
  async function copyTranslationPrompt() {
    const source = form.translations[SOURCE_LOCALE];
    if (!source.title.trim() || !source.content.trim()) {
      setMessage({ type: 'error', text: '한국어 제목과 본문을 먼저 작성하세요.' });
      return;
    }
    try {
      await navigator.clipboard.writeText(buildTranslationPrompt(source, TARGETS));
      setMessage({ type: 'ok', text: '번역 프롬프트를 복사했어요. claude.ai에 붙여넣고, 결과를 「번역 결과 붙여넣기」에 넣으세요.' });
      setPasteOpen(true);
    } catch {
      setMessage({ type: 'error', text: '클립보드에 복사하지 못했습니다. 브라우저 권한을 확인하세요.' });
    }
  }

  function applyTranslation() {
    let parsed;
    try {
      parsed = parseTranslationResult(pasteText, TARGETS);
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : '번역 결과를 읽지 못했습니다.' });
      return;
    }
    const overwrite = TARGETS.filter((l) => form.translations[l].content.trim() || form.translations[l].title.trim());
    if (overwrite.length && !confirm(`${overwrite.map((l) => l.toUpperCase()).join(', ')} 번역본을 붙여넣은 내용으로 바꿀까요?`)) return;

    // 번역 기준 = 지금 원문. 이후 원문이 바뀌면 "원문 변경됨"으로 표시됨
    const hash = sourceHash(form.translations[SOURCE_LOCALE]);
    setForm((f) => {
      const translations = { ...f.translations };
      for (const l of TARGETS) {
        const t = parsed[l];
        if (t) translations[l] = { ...t, sourceHash: hash };
      }
      return { ...f, translations };
    });

    // 이미지 구조 확인 (Claude가 이미지 줄을 빠뜨렸는지)
    const problems = TARGETS.flatMap((l) => {
      const diff = diffImages(sourceImages, extractImages(parsed[l]?.content ?? ''));
      return diff ? [`${l.toUpperCase()}: ${describeImageDiff(diff)}`] : [];
    });
    setMessage(
      problems.length
        ? { type: 'error', text: `번역을 넣었지만 이미지가 원문과 다릅니다 — ${problems.join(' / ')}` }
        : { type: 'ok', text: '번역을 넣었습니다. 검토한 뒤 저장하세요.' },
    );
    setPasteText('');
    setPasteOpen(false);
    setTab(TARGETS[0]);
  }

  // 원문 수정분을 번역본에 직접 반영한 뒤 "최신"으로 표시
  function markTranslationSynced(locale: Locale) {
    updateTranslation(locale, { sourceHash: sourceHash(form.translations[SOURCE_LOCALE]) });
  }

  function onPasteContent(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.files);
    if (files.some((f) => f.type.startsWith('image/'))) {
      e.preventDefault();
      void addImages(files);
    }
  }

  function onDropContent(e: React.DragEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    e.preventDefault();
    // 파일 드롭은 커서를 옮기지 않으므로, 드롭 전 커서 위치에 삽입됨
    void addImages(files);
  }

  // after: 'list' = 저장 후 목록으로 / 'stay' = 저장 후 계속 작성 (Ctrl+S)
  function save(after: 'list' | 'stay') {
    // 업로드가 끝나기 전에 저장하면 이미지 줄이 빠진 채 저장됨
    if (uploading > 0) {
      setMessage({ type: 'error', text: '이미지 업로드가 끝난 뒤 저장하세요.' });
      return;
    }
    // 업로드 도중 새로고침 → 임시 저장본 복원 등으로 자리표시자가 남은 경우
    if (Object.values(form.translations).some((t) => hasPlaceholder(t.content))) {
      setMessage({ type: 'error', text: '"업로드 중…" 이미지 자리표시자를 지운 뒤 저장하세요.' });
      return;
    }
    setMessage(null);
    const snapshot = form;
    startTransition(async () => {
      const res = await savePost(snapshot);
      if (!res.ok) {
        setMessage({ type: 'error', text: res.error });
        return;
      }
      try { localStorage.removeItem(draftKey); } catch {}
      setForm((f) => ({ ...f, id: res.id }));
      setSavedJson(JSON.stringify({ ...snapshot, id: res.id }));
      setLocalSavedAt(null);

      if (after === 'list') {
        if (res.warning) alert(res.warning);
        router.push('/admin');
        return;
      }
      if (!snapshot.id) {
        if (res.warning) alert(res.warning);
        router.replace(`/admin/posts/${res.id}/edit`);
        return;
      }
      setMessage(
        res.warning
          ? { type: 'error', text: res.warning }
          : { type: 'ok', text: `저장했습니다 · ${timeFormat.format(new Date())}` },
      );
      router.refresh();
    });
  }

  // Ctrl+S / Cmd+S → 저장 후 그 자리에 머무름
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveRef.current('stay');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function removePost() {
    if (!initial?.id) return;
    const ok = confirm(
      '이 글을 완전히 삭제할까요?\n\n번역·댓글·본문 이미지까지 함께 삭제되며 되돌릴 수 없습니다.\n공개만 멈추려면 「비공개」로 바꿔 저장하세요.',
    );
    if (!ok) return;
    startTransition(async () => {
      const res = await deletePost(initial.id);
      if (!res.ok) {
        setMessage({ type: 'error', text: res.error });
        return;
      }
      if (res.warning) alert(res.warning);
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      router.push('/admin');
    });
  }

  const current = form.translations[tab];
  const jaTitleLength = form.translations.ja.title.trim().length;
  const previewSource = showSource && tab !== SOURCE_LOCALE ? form.translations[SOURCE_LOCALE] : current;

  // 번역본 이미지가 원문과 같은지 (같은 이미지 · 같은 순서)
  const isSourceTab = tab === SOURCE_LOCALE;
  const sourceImages = extractImages(form.translations[SOURCE_LOCALE].content);
  const currentImages = extractImages(current.content);
  const imageDiff = isSourceTab || !current.content.trim() ? null : diffImages(sourceImages, currentImages);

  // 번역 기준이 기록된 번역본인데 지금 원문과 다르면 "원문 변경됨"
  const currentSourceHash = sourceHash(form.translations[SOURCE_LOCALE]);
  const isStale = (l: Locale) => {
    const h = form.translations[l].sourceHash;
    return l !== SOURCE_LOCALE && h !== null && h !== undefined && h !== currentSourceHash;
  };

  // 상단 상태 표시: 오류·저장 결과 > 브라우저 임시 보관 > 변경 없음
  const status: { tone: 'error' | 'ok' | 'muted'; text: string } = message
    ? { tone: message.type === 'error' ? 'error' : 'ok', text: message.text }
    : isDirty
      ? { tone: 'muted', text: localSavedAt ? `브라우저에 임시 보관됨 · ${timeFormat.format(localSavedAt)}` : '저장하지 않은 변경 사항' }
      : { tone: 'ok', text: initial ? '저장됨' : '새 글' };

  const showEditor = view !== 'preview';
  const showPreview = view !== 'edit';

  return (
    <div className="-mt-2">
      {/* 상단 바 */}
      <div className="sticky top-0 z-10 -mx-4 mb-6 border-b border-line bg-bg/90 px-4 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-4 py-3">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/admin" className="flex items-center gap-1.5 text-sm font-medium text-fg-2 hover:text-fg">
              {icon('m15 6-6 6 6 6')}
              관리자
            </Link>
            <span className="h-[18px] w-px bg-line" />
            <h1 className="text-base font-bold whitespace-nowrap">
              {initial ? <>글 수정 <span className="mono text-fg-3">#{initial.number}</span></> : '새 글 작성'}
            </h1>
            <span
              role="status"
              className={`inline-flex min-w-0 items-center gap-1.5 truncate text-[13px] ${status.tone === 'error' ? 'text-danger' : 'text-fg-3'}`}
            >
              <span className={`size-[7px] shrink-0 rounded-full ${status.tone === 'error' ? 'bg-danger' : status.tone === 'ok' ? 'bg-accent' : 'bg-warn'}`} />
              <span className="truncate">{status.text}</span>
            </span>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setView((v) => (v === 'preview' ? 'split' : 'preview'))} aria-pressed={view === 'preview'}>
              {icon('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z')}
              미리보기
            </button>
            <button
              type="button"
              onClick={() => save('list')}
              disabled={isPending || uploading > 0}
              className="btn btn-accent"
              title="Ctrl+S: 저장 후 계속 작성"
            >
              {isPending ? '저장 중…' : form.status === 'published' ? '발행하기' : '임시저장'}
            </button>
          </div>
        </div>
      </div>

      {restorable && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
          <span>저장하지 않은 작성 내용이 브라우저에 남아 있습니다.</span>
          <div className="flex gap-3 font-semibold">
            <button className="underline" onClick={() => { setForm({ ...restorable, id: initial?.id }); setRestorable(null); }}>
              복원
            </button>
            <button onClick={() => { localStorage.removeItem(draftKey); setRestorable(null); }}>버리기</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-10">
        {/* 본문 */}
        <section className="flex min-w-0 flex-[999_1_560px] flex-col">
          <div role="tablist" aria-label="작성 언어" className="flex items-end gap-1 border-b border-line">
            {TABS.map((t) => {
              const written = form.translations[t.code].title.trim() !== '';
              const on = tab === t.code;
              const tContent = form.translations[t.code].content;
              const mismatch =
                t.code !== SOURCE_LOCALE && tContent.trim() !== '' && diffImages(sourceImages, extractImages(tContent)) !== null;
              const stale = isStale(t.code);
              return (
                <button
                  key={t.code}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(t.code)}
                  className={`-mb-px flex h-10 items-center gap-2 border-b-2 px-3.5 text-[14.5px] ${on ? 'border-fg font-semibold text-fg' : 'border-transparent font-medium text-fg-3'}`}
                >
                  <span className={`size-[7px] rounded-full ${written ? 'bg-accent' : 'border-[1.5px] border-fg-3'}`} />
                  {t.label}
                  {!written && <span className="text-xs font-normal text-fg-3">미작성</span>}
                  {mismatch && <span className="text-xs font-semibold text-warn">이미지 불일치</span>}
                  {stale && <span className="text-xs font-semibold text-warn">원문 변경됨</span>}
                </button>
              );
            })}
            <span className="flex-1" />
            <div className="mb-1 flex items-center gap-1">
              <button
                type="button"
                onClick={copyTranslationPrompt}
                title={`원문(KO)을 ${TARGETS.map((l) => l.toUpperCase()).join('·')}로 번역하는 프롬프트를 복사 → claude.ai에 붙여넣기`}
                className="h-[34px] rounded-[7px] px-2.5 text-[13px] font-semibold text-accent-fg hover:bg-subtle"
              >
                번역 프롬프트 복사
              </button>
              <button
                type="button"
                onClick={() => setPasteOpen((v) => !v)}
                aria-expanded={pasteOpen}
                className={`h-[34px] rounded-[7px] px-2.5 text-[13px] font-semibold text-fg-2 hover:bg-subtle ${pasteOpen ? 'bg-subtle' : ''}`}
              >
                번역 결과 붙여넣기
              </button>
            </div>
          </div>

          {pasteOpen && (
            <div className="mt-3 flex flex-col gap-2 rounded-[14px] border border-line bg-subtle p-3">
              <label htmlFor="translation-result" className="text-[12.5px] text-fg-3">
                claude.ai의 답변 전체를 붙여넣으세요 ({TARGETS.map((l) => `===${l}===`).join(' ')} 형식). {TARGETS.map((l) => l.toUpperCase()).join('·')} 탭에 나눠서 들어가요.
              </label>
              <textarea
                id="translation-result"
                className="field mono text-[13px]"
                rows={8}
                autoFocus
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={`===${TARGETS[0]}===\ntitle: …\nsummary: …\n---\n본문…`}
              />
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-ghost" onClick={() => { setPasteOpen(false); setPasteText(''); }}>
                  닫기
                </button>
                <button type="button" className="btn btn-accent" disabled={!pasteText.trim()} onClick={applyTranslation}>
                  번역본에 넣기
                </button>
              </div>
            </div>
          )}

          {!isSourceTab && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              {isStale(tab) ? (
                <p className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-warn-soft px-3.5 py-2.5 text-[13px] text-warn">
                  <span className="flex-1">번역한 뒤에 원문(KO)이 바뀌었어요. 다시 번역하거나, 직접 고친 뒤 반영 완료로 표시하세요.</span>
                  <button type="button" className="font-semibold underline" onClick={() => markTranslationSynced(tab)}>
                    반영 완료로 표시
                  </button>
                </p>
              ) : (
                <span />
              )}
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-fg-3">
                <input type="checkbox" checked={showSource} onChange={(e) => setShowSource(e.target.checked)} className="accent-(--accent)" />
                미리보기에 원문(KO) 표시
              </label>
            </div>
          )}

          <div lang={tab} className="flex flex-col gap-2.5 pt-7 pb-[18px]">
            <label htmlFor="post-title" className="sr-only">제목</label>
            <input
              id="post-title"
              className="w-full bg-transparent p-0 text-[28px] leading-[1.35] font-bold tracking-[-0.025em] outline-none placeholder:text-fg-3 sm:text-[32px]"
              placeholder={tab === 'ja' ? 'タイトルを入力' : '제목을 입력하세요'}
              value={current.title}
              maxLength={TITLE_MAX}
              onChange={(e) => updateTranslation(tab, { title: e.target.value })}
            />
            <div className="flex flex-wrap gap-3 text-[12.5px] text-fg-3">
              <span className="mono">
                {current.title.length} / {TITLE_MAX}
              </span>
              <span>목록에서 최대 2줄까지 보여요</span>
              {jaTitleLength > JA_TITLE_RECOMMENDED && (
                <span className="inline-flex h-[22px] items-center rounded-md bg-warn-soft px-2 font-semibold text-warn">
                  日本語版 제목은 {JA_TITLE_RECOMMENDED}자 안쪽을 권장해요 (현재 {jaTitleLength}자)
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-[14px] border border-line bg-bg">
            <div role="toolbar" aria-label="서식" className="flex flex-wrap items-center gap-0.5 border-b border-line bg-subtle px-2 py-1.5">
              {TOOLS.map((t, i) =>
                t === 'sep' ? (
                  <span key={i} className="mx-1.5 h-[18px] w-px bg-line" />
                ) : (
                  <button
                    key={t.aria}
                    type="button"
                    aria-label={t.aria}
                    title={t.aria}
                    disabled={!showEditor}
                    onClick={() => t.fn && applyTool(t.fn)}
                    className={`mono grid h-[34px] min-w-[34px] place-items-center rounded-[7px] px-2 text-[13px] font-semibold text-fg-2 hover:bg-bg hover:text-fg disabled:opacity-40 ${t.className ?? ''}`}
                  >
                    {t.icon ?? t.label}
                  </button>
                ),
              )}
              <button
                type="button"
                aria-label={isSourceTab ? '이미지' : '원문 이미지 넣기'}
                title={isSourceTab ? '이미지 (붙여넣기·끌어다 놓기도 가능)' : '원문(KO) 이미지 중에서 골라 넣기'}
                aria-expanded={isSourceTab ? undefined : showPicker}
                onClick={() => (isSourceTab ? fileInputRef.current?.click() : setShowPicker((v) => !v))}
                disabled={(isSourceTab && uploading > 0) || !showEditor}
                className={`grid h-[34px] min-w-[34px] place-items-center rounded-[7px] px-2 text-fg-2 hover:bg-bg hover:text-fg disabled:opacity-40 ${!isSourceTab && showPicker ? 'bg-bg text-fg' : ''}`}
              >
                {icon('M4 5h16v14H4zM4 15l4-4 5 5M14 14l2-2 4 4M15 9h.01')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_ATTR}
                multiple
                hidden
                onChange={(e) => {
                  void addImages(Array.from(e.target.files ?? []));
                  e.target.value = ''; // 같은 파일을 다시 고를 수 있도록
                }}
              />
              <span className="flex-1" />
              <div role="group" aria-label="보기 방식" className="flex rounded-lg bg-line p-[3px]">
                {(Object.keys(VIEW_LABELS) as ViewMode[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    aria-pressed={view === v}
                    className={`h-7 rounded-md px-2.5 text-[12.5px] font-semibold ${view === v ? 'bg-bg text-fg shadow-sm' : 'text-fg-3'}`}
                  >
                    {VIEW_LABELS[v]}
                  </button>
                ))}
              </div>
            </div>

            {!isSourceTab && showPicker && showEditor && (
              <div className="border-b border-line bg-subtle px-4 py-3">
                <p className="mb-2.5 text-[12.5px] text-fg-3">
                  원문(KO) 이미지 · 클릭하면 커서 위치에 넣어요. 새 이미지는 한국어 탭에서 추가하세요.
                </p>
                {sourceImages.length === 0 ? (
                  <p className="text-[13px] text-fg-3">원문에 이미지가 없습니다.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {sourceImages.map((url, i) => {
                      // 같은 이미지를 여러 번 쓴 경우: 원문에서 몇 번째 등장인지와 번역본 개수를 비교
                      const nth = sourceImages.slice(0, i + 1).filter((u) => u === url).length;
                      const used = currentImages.filter((u) => u === url).length >= nth;
                      return (
                        <li key={`${url}#${nth}`}>
                          <button
                            type="button"
                            onClick={() => insertSourceImage(url)}
                            title={used ? '이미 넣었어요 (한 번 더 넣기)' : '넣기'}
                            className={`relative block overflow-hidden rounded-lg border-2 ${used ? 'border-transparent opacity-50' : 'border-accent'}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="h-16 w-24 object-cover" />
                            <span className="mono absolute top-1 left-1 rounded bg-bg/90 px-1 text-[11px] font-semibold">
                              {i + 1}
                              {used && ' ✓'}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            <div className={`grid ${showEditor && showPreview ? 'lg:grid-cols-2' : ''}`}>
              {showEditor && (
                <div className={`min-w-0 ${showPreview ? 'border-b border-line lg:border-r lg:border-b-0' : ''}`}>
                  <textarea
                    ref={contentRef}
                    lang={tab}
                    aria-label="본문 (Markdown)"
                    className="mono block h-[65vh] min-h-[420px] w-full resize-none bg-transparent p-6 text-[14px] leading-[1.85] break-normal outline-none placeholder:text-fg-3"
                    placeholder="Markdown"
                    value={current.content}
                    onChange={(e) => updateTranslation(tab, { content: e.target.value })}
                    onPaste={onPasteContent}
                    onDrop={onDropContent}
                  />
                </div>
              )}
              {showPreview && (
                <div lang={showSource && tab !== SOURCE_LOCALE ? 'ko' : tab} className="h-[65vh] min-h-[420px] min-w-0 overflow-auto px-7 py-6">
                  {showSource && tab !== SOURCE_LOCALE && <p className="mb-3 text-xs text-fg-3">원문 (KO) · {form.translations[SOURCE_LOCALE].title || '(제목 없음)'}</p>}
                  {previewSource.content.trim() ? (
                    <MarkdownView content={previewSource.content} compact />
                  ) : (
                    <p className="text-fg-3">내용 없음</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between gap-3 border-t border-line px-4 py-2 text-[12.5px] text-fg-3">
              {isSourceTab ? (
                <span>{uploading > 0 ? `이미지 업로드 중… (${uploading})` : 'Markdown · 이미지는 붙여넣기·끌어다 놓기'}</span>
              ) : imageDiff ? (
                <span className="flex flex-wrap items-center gap-2 text-warn">
                  <span>
                    이미지 {currentImages.length}/{sourceImages.length} · {describeImageDiff(imageDiff)}
                  </span>
                  {imageDiff.extra.length > 0 && (
                    <button
                      type="button"
                      className="font-semibold underline"
                      onClick={() => updateContent(tab, (c) => removeImages(c, imageDiff.extra))}
                    >
                      원문에 없는 이미지 제거
                    </button>
                  )}
                  {imageDiff.missing.length > 0 && !showPicker && (
                    <button type="button" className="font-semibold underline" onClick={() => setShowPicker(true)}>
                      원문 이미지 보기
                    </button>
                  )}
                </span>
              ) : (
                <span>{current.content.trim() ? `이미지 ${currentImages.length}/${sourceImages.length} · 원문과 일치` : '번역 본문'}</span>
              )}
              <span className="mono">
                {current.content.length.toLocaleString()}자 · 약 {readingMinutes(current.content)}분
              </span>
            </div>
          </div>
        </section>

        {/* 발행 설정 */}
        <aside aria-label="발행 설정" className="flex min-w-0 flex-[1_1_300px] flex-col lg:max-w-[340px]">
          <div className="flex flex-col gap-3 pt-1 pb-5">
            <span className="lbl">공개 범위</span>
            {(
              [
                ['published', '공개', '목록·검색 노출'],
                ['draft', '비공개', '초안 · 나만 보기'],
              ] as [PostStatus, string, string][]
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={`flex cursor-pointer items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-sm ${form.status === value ? 'border-accent bg-accent-soft' : 'border-line'}`}
              >
                <input
                  type="radio"
                  name="status"
                  checked={form.status === value}
                  onChange={() => setForm((f) => ({ ...f, status: value }))}
                  className="m-0 accent-(--accent)"
                />
                <span className="flex-1">{label}</span>
                <span className="text-xs text-fg-3">{hint}</span>
              </label>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-line py-5">
            <label className="flex flex-col gap-2">
              <span className="lbl">카테고리</span>
              <select
                className="field h-10 text-sm"
                value={form.categoryId ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">카테고리 없음</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.depth ? `　└ ${c.name_ko}` : c.name_ko}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-3 border-t border-line py-5">
            <TagField
              value={form.tags}
              options={tagOptions}
              onChange={(tags) => setForm((f) => ({ ...f, tags }))}
              onError={(text) => setMessage({ type: 'error', text })}
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-line py-5">
            <CoverField
              images={sourceImages}
              value={form.coverImagePath}
              onChange={(coverImagePath) => setForm((f) => ({ ...f, coverImagePath }))}
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-line py-5">
            <label className="flex flex-col gap-2">
              <span className="lbl">
                요약 <span className="mono font-normal text-fg-3">{tab.toUpperCase()}</span>
                <span className="font-normal text-fg-3"> · 목록과 OG 설명에 쓰여요</span>
              </span>
              <textarea
                lang={tab}
                className="field text-sm"
                rows={4}
                maxLength={500}
                placeholder={tab === 'ja' ? '要約(一覧・SNS共有に表示)' : '요약 (목록·SNS 공유에 표시)'}
                value={current.summary}
                onChange={(e) => updateTranslation(tab, { summary: e.target.value })}
              />
            </label>
          </div>

          {initial && (
            <div className="flex flex-col gap-2.5 border-t border-line py-5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-fg-2">발행 일시</span>
                <span className="mono text-[13px] text-fg-3">{initial.publishedAt ? formatDateTime(initial.publishedAt) : '공개 시 기록'}</span>
              </div>
              {initial.status === 'published' && (
                <div className="flex justify-between gap-3">
                  <span className="text-fg-2">공개 주소</span>
                  <span className="mono flex gap-2 text-[13px]">
                    <a href={`/ko/posts/${initial.number}`} target="_blank" className="text-accent-fg hover:underline">/ko</a>
                    <a href={`/ja/posts/${initial.number}`} target="_blank" className="text-accent-fg hover:underline">/ja</a>
                  </span>
                </div>
              )}
              <button type="button" onClick={removePost} disabled={isPending} className="mt-3 self-start text-[13px] font-semibold text-danger hover:underline">
                이 글 삭제
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
