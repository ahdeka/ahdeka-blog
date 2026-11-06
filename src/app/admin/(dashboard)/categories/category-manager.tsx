'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createCategory, deleteCategory, moveCategory, updateCategory, type CategoryInput } from './actions';

export type CategoryRow = {
  id: number;
  slug: string;
  nameKo: string;
  nameJa: string;
  parentId: number | null;
  depth: 0 | 1;
  postCount: number; // 초안 포함
  childCount: number;
  isFirst: boolean; // 같은 상위 안에서 첫 번째
  isLast: boolean;
};

type Result = { ok: true } | { ok: false; error: string };

export default function CategoryManager({ rows }: { rows: CategoryRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roots = rows.filter((r) => r.depth === 0);

  function run(action: () => Promise<Result>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onOk?.();
      router.refresh();
    });
  }

  function remove(row: CategoryRow) {
    if (!confirm(`「${row.nameKo}」 카테고리를 삭제할까요?`)) return;
    run(() => deleteCategory(row.id));
  }

  return (
    <section className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">카테고리</h2>
        {editing !== 'new' && (
          <button type="button" className="btn btn-accent" onClick={() => { setEditing('new'); setError(null); }}>
            새 카테고리
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {editing === 'new' && (
        <div className="mb-4 rounded-[14px] border border-line p-4">
          <CategoryForm
            roots={roots}
            pending={isPending}
            onCancel={() => setEditing(null)}
            onSubmit={(input) => run(() => createCategory(input), () => setEditing(null))}
          />
        </div>
      )}

      <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line">
        {rows.map((row) =>
          editing === row.id ? (
            <li key={row.id} className="bg-subtle p-4">
              <CategoryForm
                initial={row}
                roots={roots}
                pending={isPending}
                onCancel={() => setEditing(null)}
                onSubmit={(input) => run(() => updateCategory(row.id, input), () => setEditing(null))}
              />
            </li>
          ) : (
            <li key={row.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${row.depth ? 'pl-10' : ''}`}>
              <div className="flex min-w-0 flex-1 items-baseline gap-2">
                {row.depth === 1 && <span aria-hidden="true" className="text-fg-3">└</span>}
                <span className={row.depth ? 'font-medium' : 'font-semibold'}>{row.nameKo}</span>
                <span className="truncate text-sm text-fg-3">{row.nameJa}</span>
                <span className="mono truncate text-xs text-fg-3">/{row.slug}</span>
              </div>
              <span className="mono text-xs text-fg-3">
                글 {row.postCount}
                {row.childCount > 0 && ` · 하위 ${row.childCount}`}
              </span>
              <div className="flex items-center gap-1 text-[13px]">
                <IconButton label="위로" disabled={isPending || row.isFirst} onClick={() => run(() => moveCategory(row.id, 'up'))}>
                  ↑
                </IconButton>
                <IconButton label="아래로" disabled={isPending || row.isLast} onClick={() => run(() => moveCategory(row.id, 'down'))}>
                  ↓
                </IconButton>
                <button type="button" className="px-2 py-1 font-semibold text-fg-2 hover:text-fg" onClick={() => { setEditing(row.id); setError(null); }}>
                  수정
                </button>
                <button
                  type="button"
                  className="px-2 py-1 font-semibold text-danger hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
                  disabled={isPending || row.postCount > 0 || row.childCount > 0}
                  title={
                    row.childCount > 0
                      ? '하위 카테고리를 먼저 옮기거나 삭제하세요'
                      : row.postCount > 0
                        ? '글이 남아 있어 삭제할 수 없어요 (초안 포함)'
                        : undefined
                  }
                  onClick={() => remove(row)}
                >
                  삭제
                </button>
              </div>
            </li>
          ),
        )}
        {rows.length === 0 && <li className="px-4 py-6 text-sm text-fg-3">카테고리가 없습니다.</li>}
      </ul>
      <p className="mt-3 text-[12.5px] text-fg-3">
        2단계(상위/하위)까지 만들 수 있어요. 상위 카테고리 화면에는 하위 카테고리의 글도 함께 보여요. 글이나 하위 카테고리가 남아 있으면 삭제할 수 없어요.
      </p>
    </section>
  );
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="mono grid size-8 place-items-center rounded-[7px] text-fg-2 hover:bg-subtle hover:text-fg disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function CategoryForm({
  initial,
  roots,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: CategoryRow;
  roots: CategoryRow[];
  pending: boolean;
  onSubmit: (input: CategoryInput) => void;
  onCancel: () => void;
}) {
  const [nameKo, setNameKo] = useState(initial?.nameKo ?? '');
  const [nameJa, setNameJa] = useState(initial?.nameJa ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [parentId, setParentId] = useState<number | null>(initial?.parentId ?? null);

  // 하위를 가진 카테고리는 다른 카테고리 아래로 갈 수 없음 (2단계 제한)
  const parentLocked = (initial?.childCount ?? 0) > 0;
  const parentOptions = roots.filter((r) => r.id !== initial?.id);
  const slugChanged = initial && slug.trim().toLowerCase() !== initial.slug;

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ nameKo, nameJa, slug, parentId });
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="lbl">한국어 이름</span>
        <input className="field h-10 text-sm" value={nameKo} maxLength={50} required autoFocus onChange={(e) => setNameKo(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="lbl">日本語 이름</span>
        <input lang="ja" className="field h-10 text-sm" value={nameJa} maxLength={50} required onChange={(e) => setNameJa(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="lbl">
          주소 (slug) <span className="font-normal text-fg-3">· 영어 소문자·숫자·하이픈</span>
        </span>
        <input
          className="field mono h-10 text-sm"
          value={slug}
          maxLength={50}
          required
          pattern="[a-z0-9\-]+"
          placeholder="spring-boot"
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
        />
        {slugChanged && <span className="text-xs text-warn">주소가 바뀌면 기존 /category/{initial.slug} 링크는 열리지 않아요.</span>}
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="lbl">상위 카테고리</span>
        <select
          className="field h-10 text-sm"
          value={parentId ?? ''}
          disabled={parentLocked}
          onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">없음 (최상위)</option>
          {parentOptions.map((r) => (
            <option key={r.id} value={r.id}>{r.nameKo}</option>
          ))}
        </select>
        {parentLocked && <span className="text-xs text-fg-3">하위 카테고리가 있어서 최상위로만 둘 수 있어요.</span>}
      </label>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          취소
        </button>
        <button type="submit" className="btn btn-accent" disabled={pending}>
          {pending ? '저장 중…' : initial ? '저장' : '추가'}
        </button>
      </div>
    </form>
  );
}
