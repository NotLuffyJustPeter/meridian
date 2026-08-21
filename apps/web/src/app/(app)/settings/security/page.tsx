import {
  ArrowLeft,
  LockKeyhole,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { SecuritySettingsPanel } from '../../../../features/auth/components/security-settings-panel';
import { requireAuthenticatedUser } from '../../../../lib/auth/server-auth';

export const metadata: Metadata = {
  title: 'Security settings',
};

export default async function SecuritySettingsPage() {
  const user =
    await requireAuthenticatedUser();

  const googleClientId =
    process.env
      .GOOGLE_CLIENT_ID
      ?.trim() ?? '';

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050b12] px-5 py-8 text-white sm:px-8 lg:px-12 lg:py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-[-12rem] h-[34rem] w-[34rem] rounded-full bg-sky-400/[0.055] blur-[120px]" />
        <div className="absolute bottom-[-16rem] right-[-10rem] h-[34rem] w-[34rem] rounded-full bg-indigo-400/[0.045] blur-[130px]" />
      </div>

      <div className="relative mx-auto max-w-5xl">
        <div className="mb-10 flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Back to dashboard
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-slate-600">
            <LockKeyhole className="h-3 w-3" />
            Account security
          </div>
        </div>

        <div className="mb-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/65">
            Settings / Security
          </p>

          <h1 className="mt-3 text-3xl font-medium tracking-[-0.045em] text-white sm:text-4xl">
            Your sign-in, under your control.
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Connect trusted identity providers without replacing Meridian&apos;s own secure session architecture.
          </p>
        </div>

        <SecuritySettingsPanel
          user={user}
          googleClientId={
            googleClientId
          }
        />
      </div>
    </main>
  );
}
