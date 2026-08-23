'use client';

import {
  BadgeCheck,
  CalendarDays,
  Loader2,
  Mail,
  Save,
  UserRound,
} from 'lucide-react';
import {
  useRouter,
} from 'next/navigation';
import {
  useState,
} from 'react';

import {
  getApiErrorMessage,
} from '../auth-client';
import type {
  PublicUser,
} from '../types/auth.types';

type ProfileEditorProps = {
  user: PublicUser;
};

export function ProfileEditor({
  user,
}: ProfileEditorProps) {
  const router =
    useRouter();

  const [
    name,
    setName,
  ] =
    useState(
      user.name,
    );

  const [
    savedName,
    setSavedName,
  ] =
    useState(
      user.name,
    );

  const [
    saving,
    setSaving,
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

  const initials =
    savedName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(
        (part) =>
          part
            .charAt(0)
            .toUpperCase(),
      )
      .join('') ||
    'M';

  const memberSince =
    new Intl.DateTimeFormat(
      'en',
      {
        month: 'short',
        year: 'numeric',
      },
    ).format(
      new Date(
        user.createdAt,
      ),
    );

  const normalizedName =
    name.trim();

  const changed =
    normalizedName !==
      savedName &&
    normalizedName.length >=
      2;

  async function saveProfile() {
    if (!changed) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response =
        await fetch(
          '/api/auth/profile',
          {
            method:
              'PATCH',
            headers: {
              'Content-Type':
                'application/json',
            },
            body:
              JSON.stringify({
                name:
                  normalizedName,
              }),
          },
        );

      if (!response.ok) {
        setError(
          await getApiErrorMessage(
            response,
            'Unable to update profile',
          ),
        );
        return;
      }

      setSavedName(
        normalizedName,
      );

      setName(
        normalizedName,
      );

      setSuccess(
        'Profile updated.',
      );

      router.refresh();
    } catch {
      setError(
        'Unable to update your profile right now.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      id="profile"
      className="overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#08131d]/78 shadow-[0_28px_90px_rgba(0,0,0,0.24)] backdrop-blur-xl"
    >
      <div className="border-b border-white/[0.065] px-6 py-6 sm:px-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-sky-300/10 bg-sky-300/[0.055] text-lg font-semibold tracking-[0.08em] text-sky-100">
            {initials}
          </span>

          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200/65">
              Profile
            </p>

            <h2 className="mt-2 truncate text-2xl font-medium tracking-[-0.035em] text-white">
              {savedName}
            </h2>

            <p className="mt-1 truncate text-sm text-slate-500">
              {user.email}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-7 px-6 py-7 sm:px-7 lg:grid-cols-[1fr_0.78fr]">
        <div>
          <label
            htmlFor="profile-name"
            className="flex items-center gap-2 text-sm font-medium text-slate-200"
          >
            <UserRound className="h-4 w-4 text-slate-500" />
            Display name
          </label>

          <input
            id="profile-name"
            value={
              name
            }
            onChange={(
              event,
            ) => {
              setName(
                event.target.value.slice(
                  0,
                  80,
                ),
              );
            }}
            autoComplete="name"
            className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition hover:border-white/20 focus:border-sky-300/40 focus:ring-4 focus:ring-sky-300/[0.06]"
          />

          <p className="mt-2 text-xs leading-5 text-slate-600">
            This is how collaborators see you inside Meridian.
          </p>

          <button
            type="button"
            disabled={
              saving ||
              !changed
            }
            onClick={() => {
              void saveProfile();
            }}
            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save profile
          </button>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[0.05] px-4 py-3 text-xs text-rose-200"
            >
              {error}
            </p>
          )}

          {success && (
            <p
              role="status"
              className="mt-4 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05] px-4 py-3 text-xs text-emerald-200"
            >
              {success}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 text-slate-500" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-300">
                  Email
                </p>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {user.email}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <BadgeCheck className="h-4 w-4" />
                Account role
              </div>
              <p className="mt-2 text-sm font-medium text-slate-200">
                {user.role ===
                'ADMIN'
                  ? 'Administrator'
                  : 'Traveler'}
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <CalendarDays className="h-4 w-4" />
                Member since
              </div>
              <p className="mt-2 text-sm font-medium text-slate-200">
                {memberSince}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
