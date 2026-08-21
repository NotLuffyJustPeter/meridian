'use client';

import {
  Check,
  KeyRound,
  Link2,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Unlink,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import type {
  PublicUser,
  SecurityStatus,
} from '../types/auth.types';
import { getApiErrorMessage } from '../auth-client';
import { GoogleLinkButton } from './google-link-button';

type SecuritySettingsPanelProps = {
  user: PublicUser;
  googleClientId: string;
};

export function SecuritySettingsPanel({
  user,
  googleClientId,
}: SecuritySettingsPanelProps) {
  const [
    status,
    setStatus,
  ] =
    useState<SecurityStatus | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    disconnecting,
    setDisconnecting,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    success,
    setSuccess,
  ] =
    useState<string | null>(
      null,
    );

  const loadStatus =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              '/api/auth/security',
              {
                method: 'GET',
                cache: 'no-store',
              },
            );

          if (!response.ok) {
            setError(
              await getApiErrorMessage(
                response,
                'Unable to load security settings',
              ),
            );
            return;
          }

          const payload =
            (await response.json()) as {
              data?:
                SecurityStatus;
            };

          if (!payload.data) {
            setError(
              'Meridian returned an invalid security response.',
            );
            return;
          }

          setStatus(
            payload.data,
          );
        } catch {
          setError(
            'Unable to reach the security service.',
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  useEffect(
    () => {
      const timeoutId =
        window.setTimeout(
          () => {
            void loadStatus();
          },
          0,
        );

      return () => {
        window.clearTimeout(
          timeoutId,
        );
      };
    },
    [
      loadStatus,
    ],
  );

  async function handleLinked() {
    setError(null);

    setSuccess(
      'Google is now connected to your Meridian account.',
    );

    await loadStatus();
  }

  async function disconnectGoogle() {
    if (
      !status?.google.connected ||
      !status.google.canDisconnect
    ) {
      return;
    }

    setDisconnecting(true);
    setError(null);
    setSuccess(null);

    try {
      const response =
        await fetch(
          '/api/auth/google/link',
          {
            method: 'DELETE',
          },
        );

      if (!response.ok) {
        setError(
          await getApiErrorMessage(
            response,
            'Unable to disconnect Google',
          ),
        );
        return;
      }

      setSuccess(
        'Google has been disconnected. Your password sign-in remains active.',
      );

      await loadStatus();
    } catch {
      setError(
        'Unable to disconnect Google right now.',
      );
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#08131d]/78 shadow-[0_28px_90px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <div className="border-b border-white/[0.065] px-6 py-5 sm:px-7">
          <div className="flex items-start justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200/70">
                <ShieldCheck className="h-3.5 w-3.5" />
                Sign-in methods
              </div>

              <h2 className="mt-2 text-xl font-medium tracking-[-0.025em] text-white">
                Protect access to your journey.
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Manage the trusted ways you can sign in to Meridian.
              </p>
            </div>

            <span className="hidden rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-[10px] font-medium text-slate-500 sm:inline-flex">
              {user.email}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading security settings…
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            <div className="grid gap-5 px-6 py-6 sm:px-7 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.035]">
                  <KeyRound className="h-[18px] w-[18px] text-slate-300" />
                </span>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-slate-100">
                      Password
                    </h3>

                    <span
                      className={[
                        'rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]',
                        status?.password.enabled
                          ? 'bg-emerald-300/[0.08] text-emerald-200'
                          : 'bg-amber-300/[0.08] text-amber-200',
                      ].join(' ')}
                    >
                      {status?.password.enabled
                        ? 'Active'
                        : 'Not set'}
                    </span>
                  </div>

                  <p className="mt-1.5 text-xs leading-5 text-slate-500">
                    {status?.password.enabled
                      ? 'Your Meridian password can be used to sign in.'
                      : 'This account currently relies on an external sign-in method.'}
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-600">
                {status?.password.enabled
                  ? 'Available'
                  : 'Password setup comes next'}
              </div>
            </div>

            <div className="grid gap-5 px-6 py-6 sm:px-7 lg:grid-cols-[1fr_minmax(220px,360px)] lg:items-center">
              <div className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.035]">
                  {status?.google.connected ? (
                    <Check className="h-[18px] w-[18px] text-emerald-300" />
                  ) : (
                    <Link2 className="h-[18px] w-[18px] text-slate-300" />
                  )}
                </span>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-slate-100">
                      Google
                    </h3>

                    <span
                      className={[
                        'rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]',
                        status?.google.connected
                          ? 'bg-emerald-300/[0.08] text-emerald-200'
                          : 'bg-white/[0.045] text-slate-500',
                      ].join(' ')}
                    >
                      {status?.google.connected
                        ? 'Connected'
                        : 'Not connected'}
                    </span>
                  </div>

                  <p className="mt-1.5 max-w-xl text-xs leading-5 text-slate-500">
                    {status?.google.connected
                      ? 'You can use this Google account to sign in to the same Meridian profile.'
                      : 'Connect the Google account with the same email as this Meridian profile.'}
                  </p>

                  {status?.google.connected &&
                    !status.google.canDisconnect && (
                      <p className="mt-2 text-[11px] leading-5 text-amber-200/75">
                        Google is your only sign-in method, so Meridian will not let you disconnect it yet.
                      </p>
                    )}
                </div>
              </div>

              <div>
                {status?.google.connected ? (
                  <button
                    type="button"
                    disabled={
                      !status.google.canDisconnect ||
                      disconnecting
                    }
                    onClick={() => {
                      void disconnectGoogle();
                    }}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-4 text-sm font-medium text-slate-300 transition hover:border-rose-300/15 hover:bg-rose-300/[0.05] hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {disconnecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Unlink className="h-4 w-4" />
                    )}
                    Disconnect Google
                  </button>
                ) : (
                  <GoogleLinkButton
                    clientId={
                      googleClientId
                    }
                    onLinked={
                      handleLinked
                    }
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[1.75rem] border border-white/[0.07] bg-white/[0.025] px-6 py-6 sm:px-7">
        <div className="flex gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-300/10 bg-sky-300/[0.045]">
            <LockKeyhole className="h-[18px] w-[18px] text-sky-200" />
          </span>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium text-slate-100">
                Two-step verification
              </h3>
              <span className="rounded-full border border-sky-300/10 bg-sky-300/[0.045] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-sky-200/70">
                Next
              </span>
            </div>

            <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-500">
              The next security sprint adds authenticator-app codes, QR enrollment, login challenges, and recovery codes.
            </p>
          </div>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-300/15 bg-rose-300/[0.05] px-5 py-4 text-sm text-rose-200"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.05] px-5 py-4 text-sm text-emerald-200"
        >
          {success}
        </div>
      )}
    </div>
  );
}
