'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import MarkdownView from '@/components/markdown-view';
import { savePost, setPostDeleted } from './actions';
import type { PostInput, PostStatus, TranslationInput } from './types';

type Category = { id: number; name_ko: string };
type Props = {
  initial?: PostInput & { id: string; number: number; deletedAt: string | null };
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

  // after: 'list' = 저장 후 목록으로 / 'stay' = 저장 후 계속 작성 (Ctrl+S)
  function save(after: 'list' | 'stay') {
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

  function toggleDeleted() {
    if (!initial?.id) return;
    const willDelete = !initial.deletedAt;
    if (willDelete && !confirm('이 글을 삭제할까요? (나중에 복원할 수 있습니다)')) return;
    startTransition(async () => {
      const res = await setPostDeleted(initial.id, willDelete);
      if (!res.ok) setMessage({ type: 'error', text: res.error });
      else router.refresh();
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

      {initial?.deletedAt && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          삭제된 글입니다. 공개 페이지에 표시되지 않습니다.
        </p>
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
          {mode === 'edit' ? (
            <textarea
              className={`${field} min-h-[60vh] resize-y text-[15px] leading-7`}
              placeholder="Markdown"
              value={current.content}
              onChange={(e) => updateTranslation(tab, { content: e.target.value })}
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
              <button onClick={toggleDeleted} disabled={isPending} className="text-red-600 hover:underline dark:text-red-400">
                {initial.deletedAt ? '복원' : '삭제'}
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
              disabled={isPending}
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