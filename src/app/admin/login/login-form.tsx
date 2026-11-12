'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type Step = 'loading' | 'password' | 'verify' | 'enroll';

const inputClass =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100 dark:focus:ring-neutral-100/10';
const buttonClass =
  'w-full rounded-lg bg-neutral-900 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300';

export default function LoginForm() {
  const router = useRouter();
  const [supabase] = useState(createSupabaseBrowserClient);
  const started = useRef(false);

  const [step, setStep] = useState<Step>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function goToAdmin() {
    router.replace('/admin');
    router.refresh();
  }

  // TOTP 최초 등록: 이전에 등록하다 만 미인증 factor는 정리하고 새로 발급
  async function startEnroll() {
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of list?.all ?? []) {
      if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (error) throw error;
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
    setStep('enroll');
  }

  // 현재 세션 상태를 보고 다음 단계를 결정
  async function decideNextStep() {
    const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !aal.currentLevel) {
      setStep('password');
      return;
    }
    if (aal.currentLevel === 'aal2') return goToAdmin();

    const { data: list, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) throw listError;
    const verified = list.all.find((f) => f.factor_type === 'totp' && f.status === 'verified');
    if (verified) {
      setFactorId(verified.id);
      setStep('verify');
      return;
    }
    await startEnroll();
  }

  useEffect(() => {
    // 개발 모드에서 effect가 두 번 실행되어 TOTP가 이중 발급되는 것 방지
    if (started.current) return;
    started.current = true;
    decideNextStep().catch((e) => {
      setError(e?.message ?? String(e));
      setStep('password');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onPasswordSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setPassword('');
    if (error) {
      // 어느 쪽이 틀렸는지 알려주지 않음
      setError('Incorrect email or password.');
      setBusy(false);
      return;
    }
    try {
      await decideNextStep();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  }

  async function onCodeSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) {
      setError('Invalid code. Enter the latest code shown in your app.');
      setCode('');
      setBusy(false);
      return;
    }
    goToAdmin();
  }

  async function onCancel() {
    await supabase.auth.signOut();
    setCode('');
    setQr('');
    setSecret('');
    setStep('password');
  }

  return (
    // 로그인 화면은 누구나 볼 수 있으므로 영어로 (로그인 후 관리자 화면은 한국어)
    <div lang="en" className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h1 className="mb-6 text-lg font-semibold tracking-tight">
        {step === 'enroll' ? 'Set up two-factor authentication' : step === 'verify' ? 'Two-factor authentication' : 'Admin sign in'}
      </h1>

      {step === 'loading' && <p className="text-sm text-neutral-500">Checking…</p>}

      {step === 'password' && (
        <form onSubmit={onPasswordSubmit} className="space-y-4">
          <input
            type="email" required autoComplete="username" placeholder="Email"
            value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass}
          />
          <input
            type="password" required autoComplete="current-password" placeholder="Password"
            value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass}
          />
          <button type="submit" disabled={busy} className={buttonClass}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      )}

      {(step === 'verify' || step === 'enroll') && (
        <form onSubmit={onCodeSubmit} className="space-y-4">
          {step === 'enroll' && (
            <div className="space-y-3 text-sm text-neutral-600 dark:text-neutral-400">
              <p>Scan the QR code with an authenticator app (Google Authenticator, 1Password, etc.), then enter the 6-digit code it shows.</p>
              {qr && (
                // Supabase가 SVG data URL로 QR을 내려줌
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="TOTP QR code" className="mx-auto size-44 rounded-lg bg-white p-2" />
              )}
              <details>
                <summary className="cursor-pointer">Can&apos;t scan the QR code?</summary>
                <code className="mt-2 block break-all rounded bg-neutral-100 p-2 text-xs dark:bg-neutral-800">{secret}</code>
              </details>
            </div>
          )}
          <input
            inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6}
            required placeholder="123456" value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className={`${inputClass} text-center font-mono tracking-[0.5em]`}
          />
          <button type="submit" disabled={busy} className={buttonClass}>
            {busy ? 'Verifying…' : 'Verify'}
          </button>
          <button type="button" onClick={onCancel} className="w-full text-sm text-neutral-500 hover:underline">
            Sign in with a different account
          </button>
        </form>
      )}

      {error && <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}