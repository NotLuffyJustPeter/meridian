import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { AuthVisualPanel } from '../../features/auth/components/auth-visual-panel';
import { getAuthenticatedUser } from '../../lib/auth/server-auth';

export const metadata: Metadata = {
  title: {
    template: '%s · Meridian',
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
    <main className="relative min-h-screen overflow-hidden bg-[#050b12] text-white">
      <div className="pointer-events-none absolute inset-0 lg:hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-sky-400/[0.08] blur-[100px]" />
        <div className="absolute -bottom-40 right-[-30%] h-[28rem] w-[28rem] rounded-full bg-indigo-400/[0.06] blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
            maskImage:
              'linear-gradient(to bottom, black, transparent 78%)',
          }}
        />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-[1800px] lg:grid-cols-[minmax(0,1.12fr)_minmax(460px,0.88fr)]">
        <section className="relative hidden min-h-screen border-r border-white/[0.065] lg:block">
          <AuthVisualPanel />
        </section>

        <section className="relative flex min-h-screen items-center justify-center px-5 py-24 sm:px-8 lg:px-10 lg:py-12 xl:px-14">
          <div className="absolute left-5 top-5 sm:left-8 sm:top-7 lg:hidden">
            <Link
              href="/"
              className="group flex items-center gap-3"
            >
              <span className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.045] shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
                <span className="h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_14px_rgba(125,211,252,0.45)]" />
                <span className="absolute h-px w-4 rotate-45 bg-sky-200/65 transition-transform duration-300 group-hover:rotate-[55deg]" />
              </span>

              <span className="text-[11px] font-semibold tracking-[0.24em] text-white">
                MERIDIAN
              </span>
            </Link>
          </div>

          <div className="relative z-10 flex w-full justify-center">
            {children}
          </div>

          <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between text-[9px] uppercase tracking-[0.14em] text-slate-700 sm:left-8 sm:right-8 lg:hidden">
            <span>
              Travel, thoughtfully organized
            </span>
            <span>
              Meridian · 2026
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
