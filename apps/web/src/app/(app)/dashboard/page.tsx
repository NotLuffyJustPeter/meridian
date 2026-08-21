import Link from 'next/link';

import { AccountMenu } from '../../../features/auth/components/account-menu';
import { TripsDashboard } from '../../../features/trips/components/trips-dashboard';
import { requireAuthenticatedUser } from '../../../lib/auth/server-auth';

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path
        d="M10 4v12M4 10h12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default async function DashboardPage() {
  const user =
    await requireAuthenticatedUser();

  const firstName =
    user.name
      .trim()
      .split(/\s+/)[0] ||
    user.name;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07101b] text-white">
      <div className="pointer-events-none absolute left-1/2 top-[-22rem] h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-sky-400/[0.055] blur-[120px]" />

      <div className="pointer-events-none absolute right-[-18rem] top-[22rem] h-[34rem] w-[34rem] rounded-full bg-cyan-300/[0.025] blur-[110px]" />

      <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-7 lg:px-8">
        <header className="flex items-center justify-between border-b border-white/[0.07] pb-6">
          <Link
            href="/dashboard"
            className="group flex items-center gap-3"
          >
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.045]">
              <div className="absolute h-4 w-4 rounded-full border border-sky-200/20" />

              <div className="h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_14px_rgba(125,211,252,0.7)]" />
            </div>

            <span className="text-sm font-semibold tracking-[0.24em] text-slate-100 transition group-hover:text-white">
              MERIDIAN
            </span>
          </Link>

          <AccountMenu
            user={user}
          />
        </header>

        <section className="pb-12 pt-16 sm:pt-20">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <span className="h-px w-7 bg-sky-300/50" />

                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">
                  Travel workspace
                </p>
              </div>

              <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-[-0.055em] text-white sm:text-5xl lg:text-[3.6rem] lg:leading-[1.02]">
                Welcome back,{' '}
                <span className="text-slate-300">
                  {firstName}.
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
                Keep every journey in
                one place — from the
                first idea to the last
                day of the trip.
              </p>
            </div>

            <Link
              href="/trips/new"
              className="inline-flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-slate-200"
            >
              <PlusIcon />
              Create trip
            </Link>
          </div>
        </section>

        <TripsDashboard />
      </div>
    </main>
  );
}
