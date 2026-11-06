'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import MarkdownView from '@/components/markdown-view';
import { ACCEPT_ATTR, uploadPostImage } from '@/lib/images/upload-post-image';
import { hasPlaceholder, removePlaceholder, uploadPlaceholder } from '@/lib/images/placeholder';
import { deletePost, savePost } from './actions';
import type { PostInput, PostStatus, TranslationInput } from './types';

type Category = { id: number; name_ko: string };
type Props = {
  initial?: PostInput & { id: string; number: number };
  categories: Category[];
};

const TABS: { code: Locale; label: string }[] = [
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '日本語' },
];

const emptyTranslation: TranslationInput = { title: '', summary: '', content: '' };

const field =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100 dark:focus:ring-neutral-100/10';
const segment = (active: boolean) =>
  `rounded px-3 py-1 text-xs transition ${active ? 'bg-white font-medium shadow-sm dark:bg-neutral-700' : 'text-neutral-500'}`;

export default function PostEditor({ initial, categories }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState<PostInput>(() =>
    initial
      ? { id: initial.id, status: initial.status, categoryId: initial.categoryId, translations: initial.translations }
      : { status: 'draft', categoryId: null, translations: { ko: { ...emptyTranslation }, ja: { ...emptyTranslation } } },
  );
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(form));
  const isDirty = JSON.stringify(form) !== savedJson;

  const [tab, setTab] = useState<Locale>('ko');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [showSource, setShowSource] = useState(false); // JA 검수 시 원문(KO) 옆에 띄우기 (PC 전용)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [restorable, setRestorable] = useState<PostInput | null>(null);
  const [uploading, setUploading] = useState(0); // 남은 업로드 수
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 데이터 구조가 바뀌었으므로 키에 v2를 붙여, 예전 형식의 임시 저장본은 무시
  const draftKey = `post-draft:v2:${initial?.id ?? 'new'}`;

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
      try { localStorage.setItem(draftKey, JSON.stringify(form)); } catch {}
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

  async function addImages(files: File[]) {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;

    const targetTab = tab;
    const el = contentRef.current;
    const pos = el ? el.selectionEnd : form.translations[targetTab].content.length;
    const jobs = images.map((file) => ({ file, token: uploadPlaceholder(crypto.randomUUID()) }));

    setMessage(null);
    setUploading((n) => n + jobs.length);
    updateContent(targetTab, (content) => {
      const at = Math.min(pos, content.length);
      const before = content.slice(0, at);
      const after = content.slice(at);
      // 이미지는 앞뒤로 빈 줄을 둬서 문단과 분리
      const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
      const tail = after.startsWith('\n') ? '\n' : '\n\n';
      return before + lead + jobs.map((j) => j.token).join('\n\n') + tail + after;
    });

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

      if (after === 'list') {
        router.push('/admin');
        return;
      }
      if (!snapshot.id) {
        router.replace(`/admin/posts/${res.id}/edit`);
        return;
      }
      setMessage({ type: 'ok', text: '저장했습니다.' });
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
      '이 글을 완전히 삭제할까요?\n\n번역·댓글·본문 이미지까지 함께 삭제되며 되돌릴 수 없습니다.\n공개만 멈추려면 「초안」으로 바꿔 저장하세요.',
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
  const sideBySide = showSource && tab === 'ja';

  return (
    <div className="pb-24">
      {restorable && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <span>저장하지 않은 작성 내용이 브라우저에 남아 있습니다.</span>
          <div className="flex gap-3">
            <button className="font-medium underline" onClick={() => { setForm({ ...restorable, id: initial?.id }); setRestorable(null); }}>
              복원
            </button>
            <button className="text-amber-700 dark:text-amber-400" onClick={() => { localStorage.removeItem(draftKey); setRestorable(null); }}>
              버리기
            </button>
          </div>
        </div>
      )}


      {/* 공통 정보 */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {initial && <span className="font-mono text-sm text-neutral-500">#{initial.number}</span>}
        <select
          className={`${field} w-auto text-sm`}
          value={form.categoryId ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value ? Number(e.target.value) : null }))}
        >
          <option value="">카테고리 없음</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name_ko}</option>
          ))}
        </select>
        <div className="flex rounded-md bg-neutral-100 p-0.5 dark:bg-neutral-800">
          {(['draft', 'published'] as PostStatus[]).map((s) => (
            <button key={s} onClick={() => setForm((f) => ({ ...f, status: s }))} className={segment(form.status === s)}>
              {s === 'draft' ? '초안' : '공개'}
            </button>
          ))}
        </div>
      </div>

      {/* 언어 탭 + 보기 전환 */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex gap-6">
          {TABS.map((t) => (
            <button
              key={t.code}
              onClick={() => setTab(t.code)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 pb-2 text-sm transition ${
                tab === t.code ? 'border-neutral-900 font-semibold dark:border-neutral-100' : 'border-transparent text-neutral-500'
              }`}
            >
              {t.label}
              {/* 아직 작성 안 된 언어는 점이 비어 보임 */}
              <span className={`size-1.5 rounded-full ${form.translations[t.code].title.trim() ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'}`} />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 pb-2">
          {tab === 'ja' && (
            <label className="hidden cursor-pointer items-center gap-1.5 text-xs text-neutral-500 lg:flex">
              <input type="checkbox" checked={showSource} onChange={(e) => setShowSource(e.target.checked)} />
              원문(KO) 보기
            </label>
          )}
          <div className="flex rounded-md bg-neutral-100 p-0.5 dark:bg-neutral-800">
            <button onClick={() => setMode('edit')} className={segment(mode === 'edit')}>편집</button>
            <button onClick={() => setMode('preview')} className={segment(mode === 'preview')}>미리보기</button>
          </div>
        </div>
      </div>

      <div className={sideBySide ? 'grid gap-6 lg:grid-cols-2' : 'mx-auto max-w-3xl'}>
        {sideBySide && (
          <aside lang="ko" className="hidden max-h-[75vh] overflow-y-auto rounded-xl border border-neutral-200 bg-neutral-50 p-5 lg:block dark:border-neutral-800 dark:bg-neutral-900/50">
            <p className="mb-1 text-xs text-neutral-400">원문 (KO)</p>
            <h2 className="mb-4 text-lg font-semibold">{form.translations.ko.title || '(제목 없음)'}</h2>
            <MarkdownView content={form.translations.ko.content} />
          </aside>
        )}

        <section lang={tab}>
          <input
            className={`${field} mb-2 text-lg font-semibold`}
            placeholder={tab === 'ja' ? 'タイトル' : '제목'}
            value={current.title}
            onChange={(e) => updateTranslation(tab, { title: e.target.value })}
          />
          <textarea
            className={`${field} mb-3 resize-none text-sm leading-6`}
            rows={2}
            placeholder={tab === 'ja' ? '要約(一覧・SNS共有に表示)' : '요약 (목록·SNS 공유에 표시)'}
            value={current.summary}
            onChange={(e) => updateTranslation(tab, { summary: e.target.value })}
          />
          {mode === 'edit' && (
            <div className="mb-2 flex items-center gap-3 text-xs text-neutral-500">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading > 0}
                className="rounded-md border border-neutral-300 px-2.5 py-1 transition hover:border-neutral-900 hover:text-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:hover:border-neutral-100 dark:hover:text-neutral-100"
              >
                이미지 추가
              </button>
              <span>{uploading > 0 ? `업로드 중… (${uploading})` : '붙여넣기·드래그로도 추가할 수 있습니다'}</span>
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
            </div>
          )}
          {mode === 'edit' ? (
            <textarea
              ref={contentRef}
              className={`${field} min-h-[60vh] resize-y text-[15px] leading-7`}
              placeholder="Markdown"
              value={current.content}
              onChange={(e) => updateTranslation(tab, { content: e.target.value })}
              onPaste={onPasteContent}
              onDrop={onDropContent}
            />
          ) : (
            <div className="min-h-[60vh] rounded-lg border border-dashed border-neutral-300 p-5 dark:border-neutral-700">
              {current.content.trim() ? (
                <MarkdownView content={current.content} />
              ) : (
                <p className="text-neutral-400">내용 없음</p>
              )}
            </div>
          )}
          <p className="mt-2 text-right text-xs text-neutral-400">{current.content.length.toLocaleString()}자</p>
        </section>
      </div>

      {/* 하단 고정 바 */}
      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-4 text-sm">
            <Link href="/admin" className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">← 목록</Link>
            {initial?.id && (
              <button onClick={removePost} disabled={isPending} className="text-red-600 hover:underline dark:text-red-400">
                삭제
              </button>
            )}
            <span className={`truncate ${message?.type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-neutral-500'}`}>
              {message?.text ?? (isDirty ? '저장하지 않은 변경 사항' : '')}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-xs text-neutral-400 md:inline">Ctrl+S: 저장 후 계속 작성</span>
            <button
              onClick={() => save('list')}
              disabled={isPending || uploading > 0}
              className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
            >
              {isPending ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}