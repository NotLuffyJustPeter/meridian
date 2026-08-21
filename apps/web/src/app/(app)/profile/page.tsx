import {
  ArrowLeft,
  UserRound,
} from 'lucide-react';
import type {
  Metadata,
} from 'next';
import Link from 'next/link';

import {
  ProfileEditor,
} from '../../../features/auth/components/profile-editor';
import {
  SecuritySettingsPanel,
} from '../../../features/auth/components/security-settings-panel';
import {
  requireAuthenticatedUser,
} from '../../../lib/auth/server-auth';

export const metadata: Metadata = {
  title:
    'Profile & security',
};

export default async function ProfilePage() {
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
            <UserRound className="h-3 w-3" />
            Account
          </div>
        </div>

        <div className="mb-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/65">
            Meridian account
          </p>

          <h1 className="mt-3 text-3xl font-medium tracking-[-0.045em] text-white sm:text-4xl">
            Profile & security.
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Keep your identity, sign-in methods and two-step verification together in one place.
          </p>
        </div>

        <div className="space-y-8">
          <ProfileEditor
            user={
              user
            }
          />

          <div
            id="security"
            className="scroll-mt-8"
          >
            <div className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                Sign-in & security
              </p>
            </div>

            <SecuritySettingsPanel
              user={
                user
              }
              googleClientId={
                googleClientId
              }
            />
          </div>
        </div>
      </div>
    </main>
  );
}
