'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

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
    return 'Unable to load your trips.';
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

  return 'Unable to load your trips.';
}

async function fetchTripsState(): Promise<TripsState> {
  try {
    const response = await fetch(
      '/api/trips',
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
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
          readErrorMessage(payload),
        loadedAt: null,
      };
    }

    const trips =
      readTripsPayload(payload);

    if (!trips) {
      return {
        status: 'error',
        trips: [],
        error:
          'Meridian received an unexpected trips response.',
        loadedAt: null,
      };
    }

    return {
      status: 'success',
      trips,
      error: null,
      loadedAt: Date.now(),
    };
  } catch {
    return {
      status: 'error',
      trips: [],
      error:
        'Trips service is currently unavailable.',
      loadedAt: null,
    };
  }
}

function formatDate(
  value: string,
): string {
  return new Intl.DateTimeFormat(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    },
  ).format(new Date(value));
}

function formatDateRange(
  startDate: string,
  endDate: string,
): string {
  return `${formatDate(startDate)} — ${formatDate(endDate)}`;
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

function getStatusClasses(
  status: TripStatus,
): string {
  switch (status) {
    case 'PLANNED':
      return 'border-emerald-300/15 bg-emerald-300/[0.08] text-emerald-200';

    case 'ARCHIVED':
      return 'border-white/10 bg-white/[0.05] text-slate-400';

    case 'DRAFT':
      return 'border-amber-300/15 bg-amber-300/[0.08] text-amber-200';
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
    return 'In progress';
  }

  const difference =
    startMs - nowMs;

  const days =
    Math.ceil(
      difference /
        (1000 * 60 * 60 * 24),
    );

  if (days === 0) {
    return 'Today';
  }

  if (days === 1) {
    return 'Tomorrow';
  }

  if (days > 1) {
    return `In ${days} days`;
  }

  return 'Past journey';
}

function TripStatusPill({
  status,
}: {
  status: TripStatus;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getStatusClasses(status)}`}
    >
      {getStatusLabel(status)}
    </span>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path
        d="M4 10h11M11 6l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

function CompassIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <circle
        cx="12"
        cy="12"
        r="8.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <path
        d="m15.4 8.6-2.1 4.7-4.7 2.1 2.1-4.7 4.7-2.1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TripCard({
  trip,
  nowMs,
}: {
  trip: Trip;
  nowMs: number;
}) {
  const initial =
    trip.destination
      .trim()
      .charAt(0)
      .toUpperCase() || 'M';

  return (
    <article className="group overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-white/[0.035] transition duration-300 hover:-translate-y-1 hover:border-white/[0.16] hover:bg-white/[0.05]">
      <div className="relative h-44 overflow-hidden border-b border-white/[0.07] bg-[linear-gradient(135deg,#0c2636_0%,#12384b_48%,#101924_100%)]">
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full border border-sky-200/10 bg-sky-300/[0.06]" />

        <div className="absolute -bottom-24 left-8 h-48 w-48 rounded-full border border-white/[0.05] bg-white/[0.025]" />

        <div className="absolute left-7 top-7 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-sky-100/60">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
          Journey
        </div>

        <div className="absolute bottom-5 right-7 select-none text-[6.5rem] font-semibold leading-none tracking-[-0.09em] text-white/[0.055]">
          {initial}
        </div>

        <div className="absolute bottom-6 left-7 right-7">
          <p className="max-w-[80%] text-xl font-semibold tracking-[-0.025em] text-white">
            {trip.destination}
          </p>
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold tracking-[-0.025em] text-white">
              {trip.name}
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              {formatDateRange(
                trip.startDate,
                trip.endDate,
              )}
            </p>
          </div>

          <TripStatusPill
            status={trip.status}
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/[0.07] bg-black/10 px-3 py-1.5 text-xs text-slate-400">
            {trip.currency}
          </span>

          <span className="rounded-full border border-white/[0.07] bg-black/10 px-3 py-1.5 text-xs text-slate-400">
            {trip.timezone}
          </span>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-white/[0.07] pt-5">
          <span className="text-xs font-medium text-sky-200/70">
            {getDepartureLabel(
              trip,
              nowMs,
            )}
          </span>

          <Link
            href={`/trips/${trip.id}`}
            className="flex items-center gap-2 text-sm font-medium text-slate-300 transition group-hover:text-white"
          >
            Open journey
            <ArrowIcon />
          </Link>
        </div>
      </div>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {[0, 1].map((item) => (
        <div
          key={item}
          className="overflow-hidden rounded-[1.75rem] border border-white/[0.07] bg-white/[0.025]"
        >
          <div className="h-44 animate-pulse bg-white/[0.04]" />

          <div className="p-6">
            <div className="h-5 w-40 animate-pulse rounded-full bg-white/[0.06]" />

            <div className="mt-3 h-4 w-56 animate-pulse rounded-full bg-white/[0.04]" />

            <div className="mt-8 h-10 animate-pulse rounded-xl bg-white/[0.035]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.09] bg-white/[0.03] px-7 py-14 text-center sm:px-12">
      <div className="absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300/[0.08] blur-3xl" />

      <div className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-sky-200">
        <CompassIcon />
      </div>

      <p className="relative mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
        Your map is empty
      </p>

      <h2 className="relative mt-3 text-2xl font-semibold tracking-[-0.035em] text-white">
        Start somewhere worth
        remembering.
      </h2>

      <p className="relative mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-400">
        Create your first journey and
        Meridian will keep its itinerary,
        places, budget and travel context
        together.
      </p>

      <Link
        href="/trips/new"
        className="relative mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
      >
        <PlusIcon />
        Plan your first trip
      </Link>
    </div>
  );
}

export function TripsDashboard() {
  const [
    state,
    setState,
  ] = useState<TripsState>({
    status: 'loading',
    trips: [],
    error: null,
    loadedAt: null,
  });

  useEffect(() => {
    let cancelled = false;

    void fetchTripsState().then(
      (nextState) => {
        if (!cancelled) {
          setState(nextState);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const categorized =
    useMemo(() => {
      const sorted = [
        ...state.trips,
      ].sort(
        (a, b) =>
          new Date(
            a.startDate,
          ).getTime() -
          new Date(
            b.startDate,
          ).getTime(),
      );

      const now =
        state.loadedAt ?? 0;

      const upcoming =
        sorted.filter(
          (trip) =>
            trip.status !==
              'ARCHIVED' &&
            new Date(
              trip.endDate,
            ).getTime() >= now,
        );

      const past =
        sorted.filter(
          (trip) =>
            trip.status !==
              'ARCHIVED' &&
            new Date(
              trip.endDate,
            ).getTime() < now,
        );

      const archived =
        sorted.filter(
          (trip) =>
            trip.status ===
            'ARCHIVED',
        );

      return {
        upcoming,
        past,
        archived,
      };
    }, [
      state.trips,
      state.loadedAt,
    ]);

  const nextTrip =
    categorized.upcoming[0];

  if (
    state.status === 'loading'
  ) {
    return <LoadingState />;
  }

  if (
    state.status === 'error'
  ) {
    return (
      <div className="rounded-[1.75rem] border border-rose-300/10 bg-rose-300/[0.035] p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-200">
          Couldn&apos;t load journeys
        </p>

        <p className="mt-3 max-w-lg text-sm leading-6 text-slate-400">
          {state.error}
        </p>

        <button
          type="button"
          onClick={() => {
            setState({
              status: 'loading',
              trips: [],
              error: null,
              loadedAt: null,
            });

            void fetchTripsState().then(
              setState,
            );
          }}
          className="mt-6 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.09]"
        >
          Try again
        </button>
      </div>
    );
  }

  if (
    state.trips.length === 0
  ) {
    return <EmptyState />;
  }

  const nowMs =
    state.loadedAt;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Active journeys
          </p>

          <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
            {
              categorized.upcoming
                .length
            }
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Next departure
          </p>

          <p className="mt-3 truncate text-sm font-semibold text-white">
            {nextTrip
              ? getDepartureLabel(
                  nextTrip,
                  nowMs,
                )
              : 'Nothing scheduled'}
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Archived
          </p>

          <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
            {
              categorized.archived
                .length
            }
          </p>
        </div>
      </div>

      <section className="mt-10">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
              Upcoming
            </p>

            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
              Your journeys
            </h2>
          </div>

          <span className="text-xs text-slate-500">
            {
              categorized.upcoming
                .length
            }{' '}
            active
          </span>
        </div>

        {categorized.upcoming
          .length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2">
            {categorized.upcoming.map(
              (trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  nowMs={nowMs}
                />
              ),
            )}
          </div>
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-white/10 px-6 py-10 text-sm text-slate-500">
            No upcoming journeys.
          </div>
        )}
      </section>

      {(categorized.past.length >
        0 ||
        categorized.archived.length >
          0) && (
        <section className="mt-12 border-t border-white/[0.07] pt-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              History
            </p>

            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">
              Past & archived
            </h2>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {[
              ...categorized.past,
              ...categorized.archived,
            ].map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                nowMs={nowMs}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}