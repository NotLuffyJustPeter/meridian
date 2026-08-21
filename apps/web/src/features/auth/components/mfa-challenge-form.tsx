
'use client';

import {
  KeyRound,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import {
  useRouter,
} from 'next/navigation';
import {
  useState,
} from 'react';
import type {
  FormEvent,
} from 'react';

import { getApiErrorMessage } from '../auth-client';

export function MfaChallengeForm() {
  const router =
    useRouter();

  const [
    code,
    setCode,
  ] =
    useState('');

  const [
    recoveryMode,
    setRecoveryMode,
  ] =
    useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);
    setIsSubmitting(true);

    try {
      const response =
        await fetch(
          '/api/auth/mfa/verify',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body:
              JSON.stringify({
                code,
              }),
          },
        );

      if (!response.ok) {
        setError(
          await getApiErrorMessage(
            response,
            'Unable to verify the code',
          ),
        );
        return;
      }

      router.replace(
        '/dashboard',
      );

      router.refresh();
    } catch {
      setError(
        'Unable to reach Meridian. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative w-full max-w-md">
      <div className="pointer-events-none absolute -inset-x-10 -top-16 h-40 rounded-full bg-sky-400/[0.07] blur-3xl" />

      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.09] bg-[#08131d]/80 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-200/40 to-transparent" />

        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-300/10 bg-sky-300/[0.05]">
          <ShieldCheck className="h-5 w-5 text-sky-200" />
        </span>

        <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-white">
          Verify it&apos;s you.
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-400">
          {recoveryMode
            ? 'Enter one of your unused Meridian recovery codes.'
            : 'Enter the 6-digit code from your authenticator app.'}
        </p>

        <form
          onSubmit={
            submit
          }
          className="mt-7"
        >
          <label className="block text-xs font-medium text-slate-400">
            {recoveryMode
              ? 'Recovery code'
              : 'Authenticator code'}
          </label>

          <div className="relative mt-2">
            <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />

            <input
              autoFocus
              autoComplete="one-time-code"
              inputMode={
                recoveryMode
                  ? 'text'
                  : 'numeric'
              }
              value={
                code
              }
              onChange={(
                event,
              ) => {
                setCode(
                  recoveryMode
                    ? event.target.value
                        .toUpperCase()
                    : event.target.value
                        .replace(
                          /\D/g,
                          '',
                        )
                        .slice(
                          0,
                          6,
                        ),
                );
              }}
              placeholder={
                recoveryMode
                  ? 'XXXX-XXXX-XXXX-XXXX-XXXX'
                  : '000000'
              }
              className="h-14 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] pl-11 pr-4 font-mono text-lg tracking-[0.18em] text-white outline-none transition placeholder:text-slate-700 focus:border-sky-300/25 focus:bg-white/[0.05]"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[0.05] px-4 py-3 text-xs leading-5 text-rose-200"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={
              isSubmitting ||
              code.trim().length <
                6
            }
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}

            Verify and continue
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setRecoveryMode(
              (current) =>
                !current,
            );
            setCode('');
            setError(null);
          }}
          className="mt-5 text-xs font-medium text-sky-200/70 transition hover:text-sky-100"
        >
          {recoveryMode
            ? 'Use authenticator code instead'
            : 'Use a recovery code instead'}
        </button>
      </div>
    </div>
  );
}
