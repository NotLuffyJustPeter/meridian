
'use client';

import Image from 'next/image';
import {
  Check,
  Clipboard,
  KeyRound,
  Loader2,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import {
  useState,
} from 'react';

import type {
  MfaConfirmationData,
  MfaEnrollmentData,
  SecurityStatus,
} from '../types/auth.types';
import { getApiErrorMessage } from '../auth-client';

type MfaSecurityCardProps = {
  status:
    SecurityStatus['mfa'];
  onStatusChanged:
    () => Promise<void>;
};

type ActionMode =
  | 'idle'
  | 'enroll'
  | 'recovery'
  | 'regenerate'
  | 'disable';

export function MfaSecurityCard({
  status,
  onStatusChanged,
}: MfaSecurityCardProps) {
  const [
    mode,
    setMode,
  ] =
    useState<ActionMode>(
      'idle',
    );

  const [
    enrollment,
    setEnrollment,
  ] =
    useState<MfaEnrollmentData | null>(
      null,
    );

  const [
    recoveryCodes,
    setRecoveryCodes,
  ] =
    useState<string[]>(
      [],
    );

  const [
    code,
    setCode,
  ] =
    useState('');

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  async function startEnrollment() {
    setBusy(true);
    setError(null);

    try {
      const response =
        await fetch(
          '/api/auth/mfa/enroll',
          {
            method: 'POST',
          },
        );

      if (!response.ok) {
        setError(
          await getApiErrorMessage(
            response,
            'Unable to start two-step verification',
          ),
        );
        return;
      }

      const payload =
        (await response.json()) as {
          data?:
            MfaEnrollmentData;
        };

      if (!payload.data) {
        setError(
          'Meridian returned an invalid enrollment response.',
        );
        return;
      }

      setEnrollment(
        payload.data,
      );
      setCode('');
      setMode(
        'enroll',
      );
    } catch {
      setError(
        'Unable to start two-step verification right now.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnrollment() {
    setBusy(true);
    setError(null);

    try {
      const response =
        await fetch(
          '/api/auth/mfa/confirm',
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
            'Unable to verify authenticator code',
          ),
        );
        return;
      }

      const payload =
        (await response.json()) as {
          data?:
            MfaConfirmationData;
        };

      if (!payload.data) {
        setError(
          'Meridian returned an invalid confirmation response.',
        );
        return;
      }

      setRecoveryCodes(
        payload.data
          .recoveryCodes,
      );
      setCode('');
      setEnrollment(
        null,
      );
      setMode(
        'recovery',
      );

      await onStatusChanged();
    } catch {
      setError(
        'Unable to enable two-step verification right now.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    setBusy(true);
    setError(null);

    try {
      const response =
        await fetch(
          '/api/auth/mfa/recovery-codes',
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
            'Unable to regenerate recovery codes',
          ),
        );
        return;
      }

      const payload =
        (await response.json()) as {
          data?: {
            recoveryCodes:
              string[];
          };
        };

      if (!payload.data) {
        setError(
          'Meridian returned an invalid recovery-code response.',
        );
        return;
      }

      setRecoveryCodes(
        payload.data
          .recoveryCodes,
      );
      setCode('');
      setMode(
        'recovery',
      );

      await onStatusChanged();
    } catch {
      setError(
        'Unable to regenerate recovery codes right now.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);

    try {
      const response =
        await fetch(
          '/api/auth/mfa/disable',
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
            'Unable to disable two-step verification',
          ),
        );
        return;
      }

      setCode('');
      setMode(
        'idle',
      );

      await onStatusChanged();
    } catch {
      setError(
        'Unable to disable two-step verification right now.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyRecoveryCodes() {
    await navigator.clipboard.writeText(
      recoveryCodes.join(
        '\n',
      ),
    );
  }

  if (
    mode === 'enroll' &&
    enrollment
  ) {
    return (
      <section className="rounded-[1.75rem] border border-sky-300/10 bg-sky-300/[0.035] p-6 sm:p-7">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-300/10 bg-sky-300/[0.055]">
            <ShieldCheck className="h-5 w-5 text-sky-200" />
          </span>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200/65">
              Two-step verification
            </p>
            <h3 className="mt-2 text-lg font-medium text-white">
              Scan the QR code.
            </h3>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              Use Google Authenticator, Microsoft Authenticator, 1Password, Bitwarden, or another TOTP-compatible app.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
          <div className="w-fit rounded-2xl bg-white p-3">
            <Image
              src={
                enrollment.qrCodeDataUrl
              }
              alt="Meridian two-step verification QR code"
              width={220}
              height={220}
              unoptimized
            />
          </div>

          <div>
            <p className="text-xs text-slate-500">
              Can&apos;t scan it? Enter this setup key manually:
            </p>

            <code className="mt-2 block break-all rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3 font-mono text-xs leading-5 text-slate-300">
              {enrollment.secret}
            </code>

            <label className="mt-5 block text-xs font-medium text-slate-400">
              Enter the 6-digit code
            </label>

            <input
              value={
                code
              }
              onChange={(
                event,
              ) => {
                setCode(
                  event.target.value
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
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="mt-2 h-12 w-full max-w-xs rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 font-mono tracking-[0.18em] text-white outline-none focus:border-sky-300/25"
            />

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={
                  busy ||
                  code.length !==
                    6
                }
                onClick={() => {
                  void confirmEnrollment();
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Verify and enable
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setMode(
                    'idle',
                  );
                  setEnrollment(
                    null,
                  );
                  setCode('');
                  setError(null);
                }}
                className="h-11 rounded-xl border border-white/[0.08] px-4 text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-5 rounded-xl border border-rose-300/15 bg-rose-300/[0.05] px-4 py-3 text-xs text-rose-200">
            {error}
          </p>
        )}
      </section>
    );
  }

  if (
    mode === 'recovery'
  ) {
    return (
      <section className="rounded-[1.75rem] border border-emerald-300/10 bg-emerald-300/[0.035] p-6 sm:p-7">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.055]">
            <Check className="h-5 w-5 text-emerald-200" />
          </span>

          <div>
            <h3 className="text-lg font-medium text-white">
              Save your recovery codes.
            </h3>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              These codes are shown only now. Each one can be used once if you lose access to your authenticator.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {recoveryCodes.map(
            (
              recoveryCode,
            ) => (
              <code
                key={
                  recoveryCode
                }
                className="rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3 text-center font-mono text-xs tracking-[0.08em] text-slate-300"
              >
                {recoveryCode}
              </code>
            ),
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              void copyRecoveryCodes();
            }}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.08] px-4 text-sm text-slate-300 transition hover:bg-white/[0.04] hover:text-white"
          >
            <Clipboard className="h-4 w-4" />
            Copy all
          </button>

          <button
            type="button"
            onClick={() => {
              setRecoveryCodes(
                [],
              );
              setMode(
                'idle',
              );
            }}
            className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
          >
            I&apos;ve saved them
          </button>
        </div>
      </section>
    );
  }

  if (
    mode === 'regenerate' ||
    mode === 'disable'
  ) {
    const disabling =
      mode === 'disable';

    return (
      <section className="rounded-[1.75rem] border border-white/[0.07] bg-white/[0.025] p-6 sm:p-7">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.035]">
            {disabling ? (
              <ShieldOff className="h-5 w-5 text-rose-200" />
            ) : (
              <RotateCcw className="h-5 w-5 text-sky-200" />
            )}
          </span>

          <div>
            <h3 className="text-lg font-medium text-white">
              {disabling
                ? 'Disable two-step verification?'
                : 'Generate new recovery codes'}
            </h3>

            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              Confirm with your current authenticator code or an unused recovery code.
            </p>
          </div>
        </div>

        <input
          value={code}
          onChange={(
            event,
          ) => {
            setCode(
              event.target.value
                .toUpperCase(),
            );
          }}
          placeholder="Authenticator or recovery code"
          autoComplete="one-time-code"
          className="mt-6 h-12 w-full max-w-sm rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 font-mono text-sm text-white outline-none focus:border-sky-300/25"
        />

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={
              busy ||
              code.trim().length <
                6
            }
            onClick={() => {
              void (
                disabling
                  ? disable()
                  : regenerate()
              );
            }}
            className={[
              'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
              disabling
                ? 'bg-rose-200 text-rose-950 hover:bg-rose-100'
                : 'bg-white text-slate-950 hover:bg-slate-200',
            ].join(' ')}
          >
            {busy && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}

            {disabling
              ? 'Disable 2FA'
              : 'Regenerate codes'}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setCode('');
              setError(null);
              setMode(
                'idle',
              );
            }}
            className="h-11 rounded-xl border border-white/[0.08] px-4 text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
          >
            Cancel
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[0.05] px-4 py-3 text-xs text-rose-200">
            {error}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-white/[0.07] bg-white/[0.025] px-6 py-6 sm:px-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-300/10 bg-sky-300/[0.045]">
            <ShieldCheck className="h-[18px] w-[18px] text-sky-200" />
          </span>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium text-slate-100">
                Two-step verification
              </h3>

              <span
                className={[
                  'rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]',
                  status.enabled
                    ? 'bg-emerald-300/[0.08] text-emerald-200'
                    : 'bg-white/[0.045] text-slate-500',
                ].join(' ')}
              >
                {status.enabled
                  ? 'Enabled'
                  : 'Not enabled'}
              </span>
            </div>

            <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-500">
              {status.enabled
                ? `${status.recoveryCodesRemaining} unused recovery codes remain.`
                : 'Require an authenticator-app code after password or Google sign-in.'}
            </p>
          </div>
        </div>

        {status.enabled ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setCode('');
                setError(null);
                setMode(
                  'regenerate',
                );
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] px-3.5 text-xs font-medium text-slate-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Recovery codes
            </button>

            <button
              type="button"
              onClick={() => {
                setCode('');
                setError(null);
                setMode(
                  'disable',
                );
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-300/10 px-3.5 text-xs font-medium text-rose-200/80 transition hover:bg-rose-300/[0.05] hover:text-rose-100"
            >
              <ShieldOff className="h-3.5 w-3.5" />
              Disable
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void startEnrollment();
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}

            Enable 2FA
          </button>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[0.05] px-4 py-3 text-xs text-rose-200">
          {error}
        </p>
      )}
    </section>
  );
}
