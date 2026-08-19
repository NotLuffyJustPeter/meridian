'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();

  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  const handleLogout =
    async (): Promise<void> => {
      setIsLoggingOut(true);

      try {
        await fetch(
          '/api/auth/logout',
          {
            method: 'POST',
          },
        );
      } finally {
        router.replace('/login');
        router.refresh();
      }
    };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isLoggingOut
        ? 'Signing out...'
        : 'Sign out'}
    </button>
  );
}