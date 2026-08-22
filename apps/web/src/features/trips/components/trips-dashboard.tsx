'use client';

import {
  Archive,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Compass,
  MapPin,
  Plus,
  Route
} from 'lucide-react';
import {
  motion,
  useReducedMotion,
} from 'motion/react';
import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  CSSProperties,
  ReactNode,
} from 'react';

import {
  MeridianBadge,
} from '../../../components/meridian/badge';
import {
  meridianButtonClasses,
} from '../../../components/meridian/button';
import {
  SurfaceCard,
} from '../../../components/meridian/surface-card';
import {
  cn,
} from '../../../lib/cn';
import type {
  Trip,
  TripStatus,
} from '../types/trip.types';

type TripsState =
  | {
      status: 'loading';
      trips: Trip[];
      error: null;
      loadedAt: null;
    }
  | {
      status: 'success';
      trips: Trip[];
      error: null;
      loadedAt: number;
    }
  | {
      status: 'error';
      trips: Trip[];
      error: string;
      loadedAt: null;
    };

type JourneyTheme = {
  background: string;
  glow: string;
  accent: string;
};

const JOURNEY_THEMES: JourneyTheme[] =
  [
    {
      background:
        'linear-gradient(140deg, #0b2332 0%, #123b4d 48%, #101923 100%)',
      glow:
        'rgba(56, 189, 248, 0.20)',
      accent:
        '#7dd3fc',
    },
    {
      background:
        'linear-gradient(140deg, #182031 0%, #27334d 45%, #101822 100%)',
      glow:
        'rgba(129, 140, 248, 0.19)',
      accent:
        '#a5b4fc',
    },
    {
      background:
        'linear-gradient(140deg, #15251f 0%, #27453a 46%, #101b19 100%)',
      glow:
        'rgba(110, 231, 183, 0.16)',
      accent:
        '#a7f3d0',
    },
    {
      background:
        'linear-gradient(140deg, #2a2018 0%, #4b3928 45%, #181511 100%)',
      glow:
        'rgba(252, 211, 77, 0.14)',
      accent:
        '#fde68a',
    },
  ];

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null
  );
}

function readTripsPayload(
  payload: unknown,
): Trip[] | null {
  if (Array.isArray(payload)) {
    return payload as Trip[];
  }

  if (
    isRecord(payload) &&
    Array.isArray(payload.data)
  ) {
    return payload.data as Trip[];
  }

  return null;
}

function readErrorMessage(
  payload: unknown,
): string {
  if (!isRecord(payload)) {
    return 'Unable to load your journeys.';
  }

  const { message } = payload;

  if (typeof message === 'string') {
    return message;
  }

  if (
    Array.isArray(message) &&
    message.every(
      (item) =>
        typeof item === 'string',
    )
  ) {
    return message.join(', ');
  }

  return 'Unable to load your journeys.';
}

async function fetchTripsState(): Promise<TripsState> {
  try {
    const response =
      await fetch(
        '/api/trips',
        {
          method: 'GET',
          headers: {
            accept:
              'application/json',
          },
          cache: 'no-store',
        },
      );

    const payload: unknown =
      await response.json();

    if (!response.ok) {
      return {
        status: 'error',
        trips: [],
        error:
          readErrorMessage(
            payload,
          ),
        loadedAt: null,
      };
    }

    const trips =
      readTripsPayload(
        payload,
      );

    if (!trips) {
      return {
        status: 'error',
        trips: [],
        error:
          'Meridian received an unexpected journeys response.',
        loadedAt: null,
      };
    }

    return {
      status: 'success',
      trips,
      error: null,
      loadedAt:
        Date.now(),
    };
  } catch {
    return {
      status: 'error',
      trips: [],
      error:
        'Journeys are temporarily unavailable.',
      loadedAt: null,
    };
  }
}

function formatDate(
  value: string,
  includeYear = true,
): string {
  return new Intl.DateTimeFormat(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      ...(includeYear
        ? {
            year: 'numeric',
          }
        : {}),
      timeZone: 'UTC',
    },
  ).format(
    new Date(value),
  );
}

function formatDateRange(
  startDate: string,
  endDate: string,
  includeYear = true,
): string {
  return `${formatDate(
    startDate,
    includeYear,
  )} — ${formatDate(
    endDate,
    includeYear,
  )}`;
}

function getTripDays(
  trip: Trip,
): number {
  const start =
    new Date(
      trip.startDate,
    ).getTime();

  const end =
    new Date(
      trip.endDate,
    ).getTime();

  return Math.max(
    1,
    Math.floor(
      (end - start) /
        (1000 * 60 * 60 * 24),
    ) + 1,
  );
}

function getStatusLabel(
  status: TripStatus,
): string {
  switch (status) {
    case 'DRAFT':
      return 'Draft';

    case 'PLANNED':
      return 'Planned';

    case 'ARCHIVED':
      return 'Archived';
  }
}

function getStatusTone(
  status: TripStatus,
):
  | 'neutral'
  | 'success'
  | 'warning' {
  switch (status) {
    case 'PLANNED':
      return 'success';

    case 'DRAFT':
      return 'warning';

    case 'ARCHIVED':
      return 'neutral';
  }
}

function getAccessLabel(
  trip: Trip,
): string {
  switch (trip.accessRole) {
    case 'OWNER':
      return 'Your journey';

    case 'EDITOR':
      return 'Shared · Editor';

    case 'VIEWER':
      return 'Shared · Viewer';
  }
}

function getDepartureLabel(
  trip: Trip,
  nowMs: number,
): string {
  const startMs =
    new Date(
      trip.startDate,
    ).getTime();

  const endMs =
    new Date(
      trip.endDate,
    ).getTime();

  if (
    nowMs >= startMs &&
    nowMs <= endMs
  ) {
    return 'Happening now';
  }

  const days =
    Math.ceil(
      (startMs - nowMs) /
        (1000 * 60 * 60 * 24),
    );

  if (days === 0) {
    return 'Leaves today';
  }

  if (days === 1) {
    return 'Leaves tomorrow';
  }

  if (days > 1) {
    return `Leaves in ${days} days`;
  }

  return 'Past journey';
}

function getJourneyTheme(
  destination: string,
): JourneyTheme {
  const hash =
    Array.from(
      destination,
    ).reduce(
      (
        total,
        character,
      ) =>
        total +
        character.charCodeAt(
          0,
        ),
      0,
    );

  return (
    JOURNEY_THEMES[
      hash %
        JOURNEY_THEMES.length
    ] ??
    JOURNEY_THEMES[0]
  );
}

function JourneyArtwork({
  destination,
  compact = false,
}: {
  destination: string;
  compact?: boolean;
}) {
  const theme =
    getJourneyTheme(
      destination,
    );

  const style = {
    '--journey-glow':
      theme.glow,
    '--journey-accent':
      theme.accent,
    background:
      theme.background,
  } as CSSProperties;

  const initial =
    destination
      .trim()
      .charAt(0)
      .toUpperCase() ||
    'M';

  return (
    <div
      style={style}
      className={cn(
        'relative isolate overflow-hidden',
        compact
          ? 'h-32'
          : 'min-h-[310px] lg:min-h-[360px]',
      )}
    >
      <div
        className="absolute -right-20 -top-24 h-72 w-72 rounded-full blur-3xl"
        style={{
          background:
            'var(--journey-glow)',
        }}
      />

      <div className="absolute left-[11%] top-[18%] h-24 w-24 rounded-full border border-white/[0.065] bg-white/[0.025]" />

      <div className="absolute right-[15%] top-[35%] h-40 w-40 rounded-full border border-white/[0.055] bg-black/[0.045]" />

      <svg
        viewBox="0 0 520 300"
        fill="none"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full opacity-70"
        preserveAspectRatio="xMidYMid slice"
      >
        <path
          d="M-20 235C65 190 106 226 174 164C229 113 271 140 327 91C378 47 431 73 552 16"
          stroke="rgba(255,255,255,.12)"
          strokeWidth="1.5"
          strokeDasharray="5 8"
        />

        <circle
          cx="174"
          cy="164"
          r="4"
          fill="var(--journey-accent)"
        />

        <circle
          cx="327"
          cy="91"
          r="4"
          fill="var(--journey-accent)"
        />

        <circle
          cx="174"
          cy="164"
          r="10"
          stroke="var(--journey-accent)"
          strokeOpacity=".26"
        />

        <circle
          cx="327"
          cy="91"
          r="10"
          stroke="var(--journey-accent)"
          strokeOpacity=".26"
        />
      </svg>

      <div className="absolute left-5 top-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55 sm:left-6 sm:top-6">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background:
              'var(--journey-accent)',
          }}
        />
        Meridian route
      </div>

      <div
        aria-hidden="true"
        className={cn(
          'absolute bottom-[-0.12em] right-[0.02em] select-none font-semibold leading-none tracking-[-0.11em] text-white/[0.045]',
          compact
            ? 'text-[6.5rem]'
            : 'text-[12rem] sm:text-[15rem]',
        )}
      >
        {initial}
      </div>

      {!compact && (
        <div className="absolute bottom-7 left-7 right-7 sm:bottom-9 sm:left-9 sm:right-9">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Destination
          </p>

          <p className="mt-2 max-w-[85%] text-3xl font-medium tracking-[-0.045em] text-white sm:text-4xl">
            {destination}
          </p>
        </div>
      )}
    </div>
  );
}

function OverviewStat({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  detail: string;
}) {
  return (
    <SurfaceCard className="group p-5 transition duration-300 hover:border-white/[0.12] hover:bg-white/[0.035]">
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.065] bg-white/[0.03] text-slate-400 transition group-hover:text-sky-200">
          {icon}
        </span>

        <p className="text-right text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
          {label}
        </p>
      </div>

      <p className="mt-7 text-2xl font-medium tracking-[-0.04em] text-white">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-600">
        {detail}
      </p>
    </SurfaceCard>
  );
}

function FeaturedJourney({
  trip,
  nowMs,
}: {
  trip: Trip;
  nowMs: number;
}) {
  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group block overflow-hidden rounded-[2rem] border border-white/[0.085] bg-[var(--meridian-surface-raised)] shadow-[var(--meridian-shadow-lg)] outline-none transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.15] focus-visible:ring-2 focus-visible:ring-sky-300/25"
    >
      <div className="grid lg:grid-cols-[1.18fr_0.82fr]">
        <JourneyArtwork
          destination={
            trip.destination
          }
        />

        <div className="flex min-h-full flex-col p-7 sm:p-8 lg:p-9">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/70">
                Next journey
              </p>

              <h3 className="mt-3 text-2xl font-medium tracking-[-0.04em] text-white sm:text-3xl">
                {trip.name}
              </h3>
            </div>

            <MeridianBadge
              tone={
                getStatusTone(
                  trip.status,
                )
              }
            >
              {getStatusLabel(
                trip.status,
              )}
            </MeridianBadge>
          </div>

          <div className="mt-8 space-y-4">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />

              <div>
                <p className="text-sm text-slate-300">
                  {formatDateRange(
                    trip.startDate,
                    trip.endDate,
                  )}
                </p>

                <p className="mt-1 text-xs text-slate-600">
                  {getTripDays(
                    trip,
                  )}{' '}
                  days
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />

              <div>
                <p className="text-sm text-slate-300">
                  {trip.destination}
                </p>

                <p className="mt-1 text-xs text-slate-600">
                  {trip.timezone}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-10">
            <div className="border-t border-white/[0.065] pt-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-sky-200/75">
                    {getDepartureLabel(
                      trip,
                      nowMs,
                    )}
                  </p>

                  <p className="mt-1 text-[11px] text-slate-600">
                    {getAccessLabel(
                      trip,
                    )}
                  </p>
                </div>

                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-slate-300 transition duration-300 group-hover:border-sky-300/15 group-hover:bg-sky-300/[0.055] group-hover:text-sky-100">
                  <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function JourneyCard({
  trip,
  nowMs,
}: {
  trip: Trip;
  nowMs: number;
}) {
  return (
    <motion.article
      layout
      className="group overflow-hidden rounded-[1.75rem] border border-white/[0.075] bg-white/[0.028] transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-white/[0.04]"
    >
      <Link
        href={`/trips/${trip.id}`}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300/25"
      >
        <JourneyArtwork
          compact
          destination={
            trip.destination
          }
        />

        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-medium tracking-[-0.03em] text-white">
                {trip.name}
              </p>

              <p className="mt-1.5 truncate text-sm text-slate-500">
                {trip.destination}
              </p>
            </div>

            <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-slate-600 transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-sky-200" />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.06] pt-5 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDateRange(
                trip.startDate,
                trip.endDate,
                false,
              )}
            </span>

            <span className="flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              {getTripDays(
                trip,
              )}{' '}
              days
            </span>

            <MeridianBadge
              tone={
                getStatusTone(
                  trip.status,
                )
              }
              className="ml-auto"
            >
              {getStatusLabel(
                trip.status,
              )}
            </MeridianBadge>
          </div>

          <p className="mt-4 text-[11px] font-medium text-sky-200/65">
            {getDepartureLabel(
              trip,
              nowMs,
            )}
          </p>
        </div>
      </Link>
    </motion.article>
  );
}

function HistoryRow({
  trip,
}: {
  trip: Trip;
}) {
  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group grid gap-4 rounded-2xl border border-transparent px-3 py-4 outline-none transition hover:border-white/[0.065] hover:bg-white/[0.025] focus-visible:border-sky-300/15 focus-visible:bg-white/[0.025] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-4"
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/[0.065]">
          <JourneyArtwork
            compact
            destination={
              trip.destination
            }
          />
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-200 transition group-hover:text-white">
            {trip.name}
          </p>

          <p className="mt-1 truncate text-xs text-slate-600">
            {trip.destination}
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        {formatDateRange(
          trip.startDate,
          trip.endDate,
          false,
        )}
      </p>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <MeridianBadge
          tone={
            getStatusTone(
              trip.status,
            )
          }
        >
          {getStatusLabel(
            trip.status,
          )}
        </MeridianBadge>

        <ArrowUpRight className="h-4 w-4 text-slate-700 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-sky-200" />
      </div>
    </Link>
  );
}

function LoadingState() {
  return (
    <div className="space-y-8">
      <div className="h-28 animate-pulse rounded-[1.75rem] border border-white/[0.06] bg-white/[0.025]" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map(
          (item) => (
            <div
              key={item}
              className="h-36 animate-pulse rounded-[1.75rem] border border-white/[0.06] bg-white/[0.025]"
            />
          ),
        )}
      </div>

      <div className="grid overflow-hidden rounded-[2rem] border border-white/[0.06] bg-white/[0.025] lg:grid-cols-2">
        <div className="min-h-[330px] animate-pulse bg-white/[0.025]" />
        <div className="p-8">
          <div className="h-3 w-24 animate-pulse rounded-full bg-white/[0.05]" />
          <div className="mt-4 h-9 w-56 animate-pulse rounded-xl bg-white/[0.06]" />
          <div className="mt-8 h-4 w-full animate-pulse rounded-full bg-white/[0.04]" />
          <div className="mt-3 h-4 w-3/4 animate-pulse rounded-full bg-white/[0.04]" />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <SurfaceCard
      elevated
      className="relative overflow-hidden px-6 py-16 text-center sm:px-12 sm:py-20"
    >
      <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300/[0.08] blur-3xl" />

      <div className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-sky-200">
        <Compass className="h-5 w-5" />
      </div>

      <p className="relative mt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/70">
        Your atlas is waiting
      </p>

      <h2 className="relative mx-auto mt-3 max-w-xl text-3xl font-medium tracking-[-0.045em] text-white">
        Start somewhere worth remembering.
      </h2>

      <p className="relative mx-auto mt-4 max-w-lg text-sm leading-7 text-slate-500">
        Create your first journey and Meridian will keep its itinerary, places, weather, budget and travel context together.
      </p>

      <Link
        href="/trips/new"
        className={cn(
          meridianButtonClasses(
            'primary',
          ),
          'relative mt-8',
        )}
      >
        <Plus className="h-4 w-4" />
        Plan your first trip
      </Link>
    </SurfaceCard>
  );
}

export function TripsDashboard() {
  const reduceMotion =
    useReducedMotion();

  const [
    state,
    setState,
  ] =
    useState<TripsState>({
      status: 'loading',
      trips: [],
      error: null,
      loadedAt: null,
    });

  useEffect(() => {
    let cancelled =
      false;

    void fetchTripsState().then(
      (nextState) => {
        if (!cancelled) {
          setState(
            nextState,
          );
        }
      },
    );

    return () => {
      cancelled =
        true;
    };
  }, []);

  const categorized =
    useMemo(() => {
      const sorted =
        [...state.trips].sort(
          (a, b) =>
            new Date(
              a.startDate,
            ).getTime() -
            new Date(
              b.startDate,
            ).getTime(),
        );

      const now =
        state.loadedAt ??
        0;

      const upcoming =
        sorted.filter(
          (trip) =>
            trip.status ===
              'PLANNED' &&
            new Date(
              trip.endDate,
            ).getTime() >=
              now,
        );

      const drafts =
        sorted.filter(
          (trip) =>
            trip.status ===
            'DRAFT',
        );

      const past =
        sorted
          .filter(
            (trip) =>
              trip.status ===
                'PLANNED' &&
              new Date(
                trip.endDate,
              ).getTime() <
                now,
          )
          .reverse();

      const archived =
        sorted
          .filter(
            (trip) =>
              trip.status ===
              'ARCHIVED',
          )
          .reverse();

      return {
        upcoming,
        drafts,
        past,
        archived,
      };
    }, [
      state.trips,
      state.loadedAt,
    ]);

  const overview =
    useMemo(() => {
      const plannedDays =
        state.trips
          .filter(
            (trip) =>
              trip.status ===
              'PLANNED',
          )
          .reduce(
            (
              total,
              trip,
            ) =>
              total +
              getTripDays(
                trip,
              ),
            0,
          );

      return {
        plannedDays,
      };
    }, [
      state.trips,
    ]);

  if (
    state.status ===
    'loading'
  ) {
    return <LoadingState />;
  }

  if (
    state.status ===
    'error'
  ) {
    return (
      <SurfaceCard className="border-rose-300/10 bg-rose-300/[0.035] p-7">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-200">
          Couldn&apos;t load journeys
        </p>

        <p className="mt-3 max-w-lg text-sm leading-6 text-slate-400">
          {state.error}
        </p>

        <button
          type="button"
          onClick={() => {
            setState({
              status:
                'loading',
              trips: [],
              error: null,
              loadedAt: null,
            });

            void fetchTripsState().then(
              setState,
            );
          }}
          className={cn(
            meridianButtonClasses(
              'secondary',
            ),
            'mt-6',
          )}
        >
          Try again
        </button>
      </SurfaceCard>
    );
  }

  if (
    state.trips.length === 0
  ) {
    return <EmptyState />;
  }

  const nowMs =
    state.loadedAt;

  const nextTrip =
    categorized.upcoming[0];

  const remainingUpcoming =
    categorized.upcoming.slice(
      1,
    );

  const history = [
    ...categorized.past,
    ...categorized.archived,
  ];

  return (
    <motion.div
      initial={
        reduceMotion
          ? false
          : {
              opacity: 0,
            }
      }
      animate={{
        opacity: 1,
      }}
      transition={{
        duration:
          reduceMotion
            ? 0
            : 0.28,
      }}
      className="space-y-12"
    >
      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.19em] text-slate-600">
              Travel overview
            </p>

            <h2 className="mt-2 text-xl font-medium tracking-[-0.035em] text-white">
              Your Meridian at a glance.
            </h2>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <OverviewStat
            icon={
              <Route className="h-4 w-4" />
            }
            label="Planned"
            value={
              categorized
                .upcoming
                .length
            }
            detail="ready to travel"
          />

          <OverviewStat
            icon={
              <MapPin className="h-4 w-4" />
            }
            label="In planning"
            value={
              categorized
                .drafts
                .length
            }
            detail="draft journeys"
          />

          <OverviewStat
            icon={
              <CalendarDays className="h-4 w-4" />
            }
            label="Travel days"
            value={
              overview
                .plannedDays
            }
            detail="planned across active trips"
          />

          <OverviewStat
            icon={
              <Archive className="h-4 w-4" />
            }
            label="History"
            value={
              history.length
            }
            detail="past & archived journeys"
          />
        </div>
      </section>

      <section>
        <div className="mb-6 flex items-end justify-between gap-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.19em] text-sky-200/70">
              Upcoming journeys
            </p>

            <h2 className="mt-2 text-2xl font-medium tracking-[-0.04em] text-white">
              The road ahead.
            </h2>
          </div>

          <p className="hidden text-xs text-slate-600 sm:block">
            {
              categorized
                .upcoming
                .length
            }{' '}
            active
          </p>
        </div>

        {nextTrip ? (
          <div className="space-y-5">
            <FeaturedJourney
              trip={nextTrip}
              nowMs={nowMs}
            />

            {remainingUpcoming.length >
              0 && (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {remainingUpcoming.map(
                  (
                    trip,
                    index,
                  ) => (
                    <motion.div
                      key={
                        trip.id
                      }
                      initial={
                        reduceMotion
                          ? false
                          : {
                              opacity: 0,
                              y: 10,
                            }
                      }
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      transition={{
                        delay:
                          reduceMotion
                            ? 0
                            : Math.min(
                                index *
                                  0.045,
                                0.18,
                              ),
                        duration:
                          reduceMotion
                            ? 0
                            : 0.32,
                      }}
                    >
                      <JourneyCard
                        trip={
                          trip
                        }
                        nowMs={
                          nowMs
                        }
                      />
                    </motion.div>
                  ),
                )}
              </div>
            )}
          </div>
        ) : (
          <SurfaceCard className="border-dashed px-6 py-10">
            <p className="text-sm text-slate-500">
              Nothing scheduled yet.
            </p>

            <Link
              href="/trips/new"
              className={cn(
                meridianButtonClasses(
                  'secondary',
                ),
                'mt-5',
              )}
            >
              <Plus className="h-4 w-4" />
              Plan a journey
            </Link>
          </SurfaceCard>
        )}
      </section>

      {categorized.drafts.length >
        0 && (
        <section className="border-t border-white/[0.065] pt-10">
          <div className="mb-6 flex items-end justify-between gap-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.19em] text-amber-200/65">
                In planning
              </p>

              <h2 className="mt-2 text-xl font-medium tracking-[-0.035em] text-white">
                Journeys you&apos;re still shaping.
              </h2>

              <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-600">
                Drafts stay here until the owner marks the journey as planned inside its workspace.
              </p>
            </div>

            <span className="hidden text-xs text-slate-600 sm:block">
              {categorized.drafts.length}{' '}
              drafts
            </span>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {categorized.drafts.map(
              (
                trip,
                index,
              ) => (
                <motion.div
                  key={trip.id}
                  initial={
                    reduceMotion
                      ? false
                      : {
                          opacity: 0,
                          y: 8,
                        }
                  }
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    delay:
                      reduceMotion
                        ? 0
                        : Math.min(
                            index *
                              0.04,
                            0.14,
                          ),
                    duration:
                      reduceMotion
                        ? 0
                        : 0.28,
                  }}
                >
                  <JourneyCard
                    trip={trip}
                    nowMs={nowMs}
                  />
                </motion.div>
              ),
            )}
          </div>
        </section>
      )}

      {history.length >
        0 && (
        <section className="border-t border-white/[0.065] pt-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.19em] text-slate-600">
                Journey history
              </p>

              <h2 className="mt-2 text-xl font-medium tracking-[-0.035em] text-white">
                Places you&apos;ve carried with you.
              </h2>
            </div>

            <span className="hidden text-xs text-slate-600 sm:block">
              {history.length}{' '}
              journeys
            </span>
          </div>

          <SurfaceCard className="divide-y divide-white/[0.055] overflow-hidden p-2">
            {history.map(
              (trip) => (
                <HistoryRow
                  key={
                    trip.id
                  }
                  trip={trip}
                />
              ),
            )}
          </SurfaceCard>
        </section>
      )}
    </motion.div>
  );
}
