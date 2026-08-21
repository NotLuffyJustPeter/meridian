'use client';

import {
  ChevronDown,
  LogOut,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import {
  useRouter,
} from 'next/navigation';
import {
  useState,
} from 'react';

import type {
  PublicUser,
} from '../types/auth.types';

type AccountMenuProps = {
  user: PublicUser;
};

export function AccountMenu({
  user,
}: AccountMenuProps) {
  const router =
    useRouter();

  const [
    isLoggingOut,
    setIsLoggingOut,
  ] =
    useState(false);

  const initials =
    user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(
        (part) =>
          part.charAt(0),
      )
      .join('')
      .toUpperCase() ||
    'M';

  async function logout() {
    setIsLoggingOut(
      true,
    );

    try {
      await fetch(
        '/api/auth/logout',
        {
          method:
            'POST',
        },
      );
    } finally {
      router.replace(
        '/login',
      );
      router.refresh();
    }
  }

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl border border-transparent px-2 py-1.5 transition hover:border-white/[0.07] hover:bg-white/[0.035] [&::-webkit-details-marker]:hidden">
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-sky-200/10 bg-sky-300/[0.055] text-[11px] font-semibold tracking-[0.08em] text-sky-100">
          {initials}
        </span>

        <span className="hidden min-w-0 text-right sm:block">
          <span className="block truncate text-sm font-medium text-slate-200">
            {user.name}
          </span>

          <span className="mt-0.5 block max-w-52 truncate text-xs text-slate-500">
            {user.email}
          </span>
        </span>

        <ChevronDown className="hidden h-3.5 w-3.5 text-slate-600 transition-transform group-open:rotate-180 sm:block" />
      </summary>

      <div className="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-64 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#08131d]/95 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="border-b border-white/[0.06] px-3 pb-3 pt-2">
          <p className="truncate text-sm font-medium text-slate-200">
            {user.name}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {user.email}
          </p>
        </div>

        <nav className="py-1">
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition hover:bg-white/[0.045] hover:text-white"
          >
            <UserRound className="h-4 w-4" />
            Profile & security
          </Link>
        </nav>

        <div className="border-t border-white/[0.06] pt-1">
          <button
            type="button"
            disabled={
              isLoggingOut
            }
            onClick={() => {
              void logout();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-400 transition hover:bg-rose-300/[0.05] hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />

            {isLoggingOut
              ? 'Signing out…'
              : 'Sign out'}
          </button>
        </div>
      </div>
    </details>
  );
}
