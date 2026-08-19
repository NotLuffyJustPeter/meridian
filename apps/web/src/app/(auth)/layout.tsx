import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { getAuthenticatedUser } from '../../lib/auth/server-auth';

export const metadata: Metadata = {
  title: {
    template: '%s | Meridian',
    default: 'Meridian',
  },
  description:
    'Plan your entire journey from one beautifully organized workspace.',
};

type AuthLayoutProps = {
  children: ReactNode;
};

export default async function AuthLayout({
  children,
}: AuthLayoutProps) {
  const user =
    await getAuthenticatedUser();

  if (user) {
    redirect('/dashboard');
  }
  
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07101b] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-48 -top-48 h-[520px] w-[520px] rounded-full bg-sky-500/[0.08] blur-[110px]" />

        <div className="absolute -bottom-60 right-[-100px] h-[600px] w-[600px] rounded-full bg-indigo-500/[0.08] blur-[130px]" />

        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize:
              '64px 64px',
            maskImage:
              'linear-gradient(to bottom, black, transparent 80%)',
          }}
        />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden min-h-screen overflow-hidden border-r border-white/[0.07] px-12 py-10 lg:flex lg:flex-col xl:px-16">
          <Link
            href="/"
            className="flex w-fit items-center gap-3"
          >
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.05]">
              <div className="h-2.5 w-2.5 rounded-full border-2 border-sky-300" />

              <div className="absolute h-[1px] w-5 rotate-45 bg-sky-300/70" />
            </div>

            <span className="text-sm font-semibold tracking-[0.24em] text-white">
              MERIDIAN
            </span>
          </Link>

          <div className="my-auto max-w-2xl py-12">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.24em] text-sky-300/80">
              Travel, thoughtfully
              organized
            </p>

            <h2 className="max-w-xl text-5xl font-medium leading-[1.04] tracking-[-0.05em] text-white xl:text-6xl">
              Everything your trip needs.
              <span className="block text-slate-500">
                Nothing it doesn&apos;t.
              </span>
            </h2>

            <p className="mt-7 max-w-lg text-base leading-7 text-slate-400">
              Build itineraries, remember
              places, understand your
              budget and keep the entire
              journey connected in one
              calm workspace.
            </p>

            <div className="relative mt-12 max-w-xl rounded-[28px] border border-white/[0.09] bg-white/[0.045] p-4 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <div className="rounded-[22px] border border-white/[0.07] bg-[#0a1421]/90 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-600">
                      Upcoming journey
                    </p>

                    <h3 className="mt-2 text-xl font-medium tracking-tight">
                      Northern Italy
                    </h3>
                  </div>

                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-400">
                    8 days
                  </div>
                </div>

                <div className="relative mt-8">
                  <div className="absolute bottom-3 left-[7px] top-3 w-px bg-gradient-to-b from-sky-400 via-indigo-400/50 to-white/10" />

                  <div className="space-y-6">
                    <div className="relative flex gap-5">
                      <div className="relative z-10 mt-1 h-[15px] w-[15px] rounded-full border-[4px] border-[#0a1421] bg-sky-300 ring-1 ring-sky-300/40" />

                      <div>
                        <p className="text-xs text-slate-600">
                          DAY 01
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-200">
                          Milan
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Duomo · Brera ·
                          Navigli
                        </p>
                      </div>
                    </div>

                    <div className="relative flex gap-5">
                      <div className="relative z-10 mt-1 h-[15px] w-[15px] rounded-full border-[4px] border-[#0a1421] bg-indigo-300 ring-1 ring-indigo-300/40" />

                      <div>
                        <p className="text-xs text-slate-600">
                          DAY 03
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-200">
                          Lake Como
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Bellagio · Varenna
                          · Ferry
                        </p>
                      </div>
                    </div>

                    <div className="relative flex gap-5">
                      <div className="relative z-10 mt-1 h-[15px] w-[15px] rounded-full border-[4px] border-[#0a1421] bg-slate-600 ring-1 ring-white/10" />

                      <div>
                        <p className="text-xs text-slate-600">
                          DAY 06
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-200">
                          Verona
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Historic center ·
                          Arena
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-7 grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-600">
                      Places
                    </p>
                    <p className="mt-2 text-sm font-medium">
                      18 saved
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-600">
                      Budget
                    </p>
                    <p className="mt-2 text-sm font-medium">
                      €1,840
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-600">
                      Status
                    </p>
                    <p className="mt-2 text-sm font-medium text-emerald-300">
                      On track
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              Plan less. Experience more.
            </span>

            <span>
              Meridian · 2026
            </span>
          </div>
        </section>

        <section className="relative flex min-h-screen items-center justify-center px-6 py-12 sm:px-10 lg:px-12">
          <div className="absolute left-6 top-6 lg:hidden">
            <Link
              href="/"
              className="flex items-center gap-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.05]">
                <div className="h-2 w-2 rounded-full bg-sky-300" />
              </div>

              <span className="text-xs font-semibold tracking-[0.22em]">
                MERIDIAN
              </span>
            </Link>
          </div>

          {children}
        </section>
      </div>
    </main>
  );
}