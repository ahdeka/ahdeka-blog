'use client';

import { useCallback, useId, useState, useTransition } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';
import { createComment } from '@/lib/comments/actions';
import { BODY_MAX, NICKNAME_MAX, PASSWORD_MAX, PASSWORD_MIN } from '@/lib/comments/rules';
import Turnstile from './turnstile';

type Props = {
  postId: string;
  locale: Locale;
  dict: Dictionary['comments'];
  parentId?: string; // 있으면 답글 폼
  onCancel?: () => void;
  onPosted?: () => void;
};

const NICKNAME_KEY = 'comment-nickname';

// 닉네임만 브라우저에 기억 (비밀번호는 절대 저장하지 않음)
function readSavedNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export const inputClass =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[15px] outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-900 dark:placeholder:text-neutral-500 dark:focus:border-neutral-100 dark:focus:ring-neutral-100/10';

export default function CommentForm({ postId, locale, dict, parentId, onCancel, onPosted }: Props) {
  const id = useId();
  // 답글 폼은 클릭 후 브라우저에서만 그려지므로 바로 읽어도 됨. 하단 폼은 서버 렌더링이라 첫 포커스 때 채움
  const [nickname, setNickname] = useState(() => (parentId ? readSavedNickname() : ''));
  const [password, setPassword] = useState('');
  const [body, setBody] = useState('');
  const [website, setWebsite] = useState(''); // 봇 함정 (사람에게는 보이지 않음)
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  // 하단 댓글 폼은 처음 포커스될 때 Turnstile을 불러옴 → 글만 읽는 방문자는 추가 로딩 없음
  // 답글 폼은 버튼을 눌러 열었을 때이므로 바로 활성화
  const [active, setActive] = useState(Boolean(parentId));

  function activate() {
    if (active) return;
    setActive(true);
    if (!nickname) setNickname(readSavedNickname());
  }

  const onToken = useCallback((t: string | null) => setToken(t), []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setMessage({ type: 'error', text: dict.captchaRequired });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const res = await createComment({ postId, parentId, nickname, body, password, website, turnstileToken: token });
      // 토큰은 1회용이므로 성공·실패와 관계없이 위젯을 새로 만듦
      setToken(null);
      setWidgetKey((k) => k + 1);

      if (!res.ok) {
        setMessage({ type: 'error', text: dict.errors[res.code] });
        return;
      }
      try {
        localStorage.setItem(NICKNAME_KEY, nickname.trim());
      } catch {}
      setBody('');
      setPassword('');
      setMessage({ type: 'ok', text: dict.posted });
      onPosted?.();
    });
  }

  return (
    <form onSubmit={submit} onFocus={activate} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-nickname`} className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            {dict.nickname}
          </label>
          <input
            id={`${id}-nickname`}
            className={inputClass}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={NICKNAME_MAX}
            autoComplete="nickname"
            required
          />
        </div>
        <div>
          <label htmlFor={`${id}-password`} className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            {dict.password}
          </label>
          <input
            id={`${id}-password`}
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
            // 브라우저가 이 사이트의 다른 비밀번호를 자동 입력하거나 저장 제안하지 않도록
            autoComplete="new-password"
            aria-describedby={`${id}-password-hint`}
            required
          />
          <p id={`${id}-password-hint`} className="mt-1 text-xs text-neutral-500">{dict.passwordHint}</p>
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-body`} className="sr-only">{dict.body}</label>
        <textarea
          id={`${id}-body`}
          className={`${inputClass} min-h-28 resize-y leading-[1.8]`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={dict.bodyPlaceholder}
          maxLength={BODY_MAX}
          rows={parentId ? 3 : 4}
          required
        />
        <p className="mt-1 text-right text-xs tabular-nums text-neutral-400">
          {body.length} / {BODY_MAX}
        </p>
      </div>

      {/* 봇 함정: 스크린 리더·키보드 이동에서도 제외 */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
      </div>

      {active && (
        <Turnstile key={widgetKey} action="comment" language={locale} onToken={onToken} unavailableText={dict.captchaUnavailable} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          role="status"
          className={`text-sm ${message?.type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}
        >
          {message?.text}
        </p>
        <div className="ml-auto flex items-center gap-3">
          {onCancel && (
            <button type="button" onClick={onCancel} className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
              {dict.cancel}
            </button>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            {isPending ? dict.submitting : parentId ? dict.replySubmit : dict.submit}
          </button>
        </div>
      </div>
    </form>
  );
}
