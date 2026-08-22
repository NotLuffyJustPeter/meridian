'use client';

import {
  Map,
  Plus,
} from 'lucide-react';
import {
  motion,
  useReducedMotion,
} from 'motion/react';
import Link from 'next/link';
import {
  usePathname,
} from 'next/navigation';
import type {
  ReactNode,
} from 'react';

import {
  MeridianLogo,
} from '../../../components/meridian/meridian-logo';
import {
  AccountMenu,
} from '../../auth/components/account-menu';
import type {
  PublicUser,
} from '../../auth/types/auth.types';
import {
  PageTransition,
} from './page-transition';

type AppShellProps = {
  user: PublicUser;
  children: ReactNode;
};

type NavigationItem = {
  label: string;
  href: string;
  icon:
    typeof Map;
  isActive: (
    pathname: string,
  ) => boolean;
};

const navigation: NavigationItem[] =
  [
    {
      label: 'Journeys',
      href: '/dashboard',
      icon: Map,
      isActive: (
        pathname,
      ) =>
        pathname ===
          '/dashboard' ||
        (
          pathname.startsWith(
            '/trips/',
          ) &&
          pathname !==
            '/trips/new'
        ),
    },
    {
      label: 'Plan trip',
      href: '/trips/new',
      icon: Plus,
      isActive: (
        pathname,
      ) =>
        pathname ===
        '/trips/new',
    },
  ];

export function AppShell({
  user,
  children,
}: AppShellProps) {
  const pathname =
    usePathname();

  const reduceMotion =
    useReducedMotion();

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[var(--meridian-canvas)] text-[var(--meridian-text)]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
      >
        <div className="absolute left-[14%] top-[-20rem] h-[38rem] w-[38rem] rounded-full bg-sky-400/[0.055] blur-[125px]" />

        <div className="absolute right-[-16rem] top-[28rem] h-[34rem] w-[34rem] rounded-full bg-indigo-400/[0.035] blur-[130px]" />

        <div className="meridian-grid-mask absolute inset-0 opacity-30" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/[0.065] bg-[#050b12]/78 backdrop-blur-2xl supports-[backdrop-filter]:bg-[#050b12]/68">
        <div className="mx-auto flex h-[72px] w-full max-w-[1600px] items-center gap-5 px-5 sm:px-6 lg:px-8 xl:px-10">
          <MeridianLogo />

          <span
            aria-hidden="true"
            className="hidden h-5 w-px bg-white/[0.08] md:block"
          />

          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-1 md:flex"
          >
            {navigation.map(
              (item) => {
                const active =
                  item.isActive(
                    pathname,
                  );

                return (
                  <Link
                    key={
                      item.href
                    }
                    href={
                      item.href
                    }
                    className={[
                      'relative flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium outline-none transition',
                      active
                        ? 'text-white'
                        : 'text-slate-500 hover:text-slate-200',
                      'focus-visible:ring-2 focus-visible:ring-sky-300/25',
                    ].join(' ')}
                  >
                    {active && (
                      <motion.span
                        layoutId="meridian-primary-nav"
                        transition={{
                          duration:
                            reduceMotion
                              ? 0
                              : 0.24,
                          ease: [
                            0.22,
                            1,
                            0.36,
                            1,
                          ],
                        }}
                        className="absolute inset-0 rounded-xl border border-white/[0.065] bg-white/[0.045]"
                      />
                    )}

                    <item.icon
                      className="relative h-3.5 w-3.5"
                      strokeWidth={
                        1.7
                      }
                    />

                    <span className="relative">
                      {
                        item.label
                      }
                    </span>
                  </Link>
                );
              },
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <nav
              aria-label="Mobile navigation"
              className="flex items-center gap-1 md:hidden"
            >
              {navigation.map(
                (item) => {
                  const active =
                    item.isActive(
                      pathname,
                    );

                  return (
                    <Link
                      key={
                        item.href
                      }
                      href={
                        item.href
                      }
                      aria-label={
                        item.label
                      }
                      className={[
                        'flex h-9 w-9 items-center justify-center rounded-xl border outline-none transition',
                        active
                          ? 'border-sky-300/12 bg-sky-300/[0.055] text-sky-200'
                          : 'border-transparent text-slate-500 hover:bg-white/[0.04] hover:text-white',
                        'focus-visible:ring-2 focus-visible:ring-sky-300/25',
                      ].join(' ')}
                    >
                      <item.icon
                        className="h-4 w-4"
                        strokeWidth={
                          1.7
                        }
                      />
                    </Link>
                  );
                },
              )}
            </nav>

            <span
              aria-hidden="true"
              className="mx-1 h-6 w-px bg-white/[0.07]"
            />

            <AccountMenu
              user={user}
            />
          </div>
        </div>
      </header>

      <div className="relative z-10">
        <PageTransition>
          {children}
        </PageTransition>
      </div>
    </div>
  );
}
