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
  replyToName?: string; // 답글 대상 닉네임 ("○○ 님에게 답글")
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

export default function CommentForm({ postId, locale, dict, parentId, replyToName, onCancel, onPosted }: Props) {
  const id = useId();
  const isReply = Boolean(parentId);
  // 답글 폼은 클릭 후 브라우저에서만 그려지므로 바로 읽어도 됨. 하단 폼은 서버 렌더링이라 첫 포커스 때 채움
  const [nickname, setNickname] = useState(() => (isReply ? readSavedNickname() : ''));
  const [password, setPassword] = useState('');
  const [body, setBody] = useState('');
  const [website, setWebsite] = useState(''); // 봇 함정 (사람에게는 보이지 않음)
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  // 하단 댓글 폼은 처음 포커스될 때 Turnstile을 불러옴 → 글만 읽는 방문자는 추가 로딩 없음
  // 답글 폼은 버튼을 눌러 열었을 때이므로 바로 활성화
  const [active, setActive] = useState(isReply);

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

  const nicknameInput = (
    <input
      id={`${id}-nickname`}
      className="field h-10 min-w-0"
      value={nickname}
      onChange={(e) => setNickname(e.target.value)}
      placeholder={isReply ? dict.nickname : dict.nicknamePlaceholder}
      aria-label={dict.nickname}
      maxLength={NICKNAME_MAX}
      autoComplete="nickname"
      required
    />
  );
  const passwordInput = (
    <input
      id={`${id}-password`}
      type="password"
      className="field h-10 min-w-0"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      placeholder={isReply ? dict.password : dict.passwordPlaceholder}
      aria-label={dict.password}
      minLength={PASSWORD_MIN}
      maxLength={PASSWORD_MAX}
      // 브라우저가 이 사이트의 다른 비밀번호를 자동 입력하거나 저장 제안하지 않도록
      autoComplete="new-password"
      aria-describedby={`${id}-password-hint`}
      required
    />
  );
  const textarea = (
    <textarea
      id={`${id}-body`}
      className="area"
      value={body}
      onChange={(e) => setBody(e.target.value)}
      placeholder={isReply ? dict.replyPlaceholder : dict.bodyPlaceholder}
      aria-label={dict.body}
      maxLength={BODY_MAX}
      // 하단 폼은 처음엔 2줄로 작게, 입력을 시작하면 늘어남
      rows={isReply ? 3 : active ? 4 : 2}
      required
    />
  );
  const submitLabel = isPending ? dict.submitting : isReply ? dict.replySubmit : dict.submit;

  return (
    <form onSubmit={submit} onFocus={activate} className="flex flex-col gap-2.5">
      {isReply && replyToName && (
        <span className="text-[13px] text-fg-3">
          {/* "{name} 님에게 답글" → 이름 부분만 굵게 */}
          {dict.replyTo.split('{name}').map((part, i) => (
            <span key={i}>
              {i > 0 && <strong className="text-fg-2">{replyToName}</strong>}
              {part}
            </span>
          ))}
        </span>
      )}

      {isReply ? (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            {nicknameInput}
            {passwordInput}
          </div>
          <div className="field-box">{textarea}</div>
        </>
      ) : (
        <>
          {/* 하단 폼: 본문 → 이름·비밀번호·등록 한 줄 */}
          <div className="field-box">{textarea}</div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[1fr_1fr_auto]">
            {nicknameInput}
            {passwordInput}
            <button type="submit" disabled={isPending} className="btn btn-primary col-span-2 sm:col-span-1">
              {submitLabel}
            </button>
          </div>
          <p className="flex flex-wrap justify-between gap-2 text-[12.5px] text-fg-3">
            <span>{dict.formNote}</span>
            <span className="mono tabular-nums">
              {body.length} / {BODY_MAX}
            </span>
          </p>
        </>
      )}
      <p id={`${id}-password-hint`} className="sr-only">
        {dict.passwordHint}
      </p>

      {/* 봇 함정: 스크린 리더·키보드 이동에서도 제외 */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
      </div>

      {active && (
        <Turnstile key={widgetKey} action="comment" language={locale} onToken={onToken} unavailableText={dict.captchaUnavailable} />
      )}

      {/* 알림 영역은 항상 두어야 화면 낭독기가 바뀐 내용을 읽어 줌 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className={`text-sm ${message?.type === 'error' ? 'text-danger' : 'text-accent-fg'}`}>
          {message?.text}
        </p>
        {isReply && (
          <div className="ml-auto flex gap-2">
            {onCancel && (
              <button type="button" onClick={onCancel} className="btn btn-ghost">
                {dict.cancel}
              </button>
            )}
            <button type="submit" disabled={isPending} className="btn btn-primary">
              {submitLabel}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
