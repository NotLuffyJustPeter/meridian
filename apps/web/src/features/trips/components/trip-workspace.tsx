'use client';

import Link from 'next/link';
import type {
  ReactNode,
} from 'react';
import {
  useEffect,
  useState,
} from 'react';

import { BudgetPanel } from '../../budget/components/budget-panel';
import { ItineraryTimeline } from '../../itinerary/components/itinerary-timeline';
import { PlacesPanel } from '../../places/components/places-panel';
import {
  WeatherJourneyStrip,
  WeatherPanel,
} from '../../weather/components/weather-panel';
import type {
  Trip,
  TripStatus,
} from '../types/trip.types';

type TripWorkspaceState =
  | {
      status: 'loading';
      trip: null;
      error: null;
    }
  | {
      status: 'success';
      trip: Trip;
      error: null;
    }
  | {
      status: 'not-found';
      trip: null;
      error: null;
    }
  | {
      status: 'error';
      trip: null;
      error: string;
    };

type WorkspaceTab =
  | 'overview'
  | 'itinerary'
  | 'places'
  | 'weather'
  | 'budget';

function isRecord(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      'object' &&
    value !== null
  );
}

function readTrip(
  payload: unknown,
): Trip | null {
  if (
    isRecord(payload) &&
    typeof payload.id ===
      'string'
  ) {
    return payload as unknown as Trip;
  }

  if (
    isRecord(payload) &&
    isRecord(payload.data) &&
    typeof payload.data.id ===
      'string'
  ) {
    return payload.data as unknown as Trip;
  }

  return null;
}

function readErrorMessage(
  payload: unknown,
): string {
  if (!isRecord(payload)) {
    return 'Unable to load this journey.';
  }

  const { message } =
    payload;

  if (
    typeof message ===
    'string'
  ) {
    return message;
  }

  if (
    Array.isArray(message) &&
    message.every(
      (item) =>
        typeof item ===
        'string',
    )
  ) {
    return message.join(', ');
  }

  return 'Unable to load this journey.';
}

async function fetchTripState(
  tripId: string,
): Promise<TripWorkspaceState> {
  try {
    const response =
      await fetch(
        `/api/trips/${encodeURIComponent(
          tripId,
        )}`,
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

    if (
      response.status ===
      404
    ) {
      return {
        status: 'not-found',
        trip: null,
        error: null,
      };
    }

    if (!response.ok) {
      return {
        status: 'error',
        trip: null,
        error:
          readErrorMessage(
            payload,
          ),
      };
    }

    const trip =
      readTrip(payload);

    if (!trip) {
      return {
        status: 'error',
        trip: null,
        error:
          'Meridian received an unexpected journey response.',
      };
    }

    return {
      status: 'success',
      trip,
      error: null,
    };
  } catch {
    return {
      status: 'error',
      trip: null,
      error:
        'Trips service is currently unavailable.',
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
  ).format(
    new Date(value),
  );
}

function formatLongDate(
  value: string,
): string {
  return new Intl.DateTimeFormat(
    'en-US',
    {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    },
  ).format(
    new Date(value),
  );
}

function getDurationDays(
  startDate: string,
  endDate: string,
): number {
  const start =
    new Date(
      startDate,
    ).getTime();

  const end =
    new Date(
      endDate,
    ).getTime();

  const dayMs =
    1000 * 60 * 60 * 24;

  const difference =
    Math.round(
      (end - start) /
        dayMs,
    );

  return Math.max(
    difference + 1,
    1,
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

function ArrowLeftIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path
        d="M16 10H4M8 6l-4 4 4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
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

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <rect
        x="4"
        y="6"
        width="16"
        height="14"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <path
        d="M8 4v4M16 4v4M4 10h16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path
        d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      <circle
        cx="12"
        cy="10"
        r="2.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path
        d="M5 7.5A2.5 2.5 0 0 1 7.5 5H18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7a3 3 0 0 1-3-3V8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      <path
        d="M19 10h-4a2 2 0 1 0 0 4h4"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}


function WeatherIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path
        d="M7.5 18.5h9.2a4.3 4.3 0 0 0 .7-8.5A5.8 5.8 0 0 0 6.3 8.7 4.9 4.9 0 0 0 7.5 18.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 6.5 6.7 5.2M12 5V3M16 6.5l1.3-1.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GlobeIcon() {
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
        r="8"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <path
        d="M4.5 12h15M12 4c2 2.2 3 4.9 3 8s-1 5.8-3 8c-2-2.2-3-4.9-3-8s1-5.8 3-8Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function WorkspaceCard({
  eyebrow,
  title,
  description,
  icon,
  accent = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <article
      className={`rounded-[1.6rem] border p-6 ${
        accent
          ? 'border-sky-300/15 bg-sky-300/[0.045]'
          : 'border-white/[0.07] bg-white/[0.025]'
      }`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
          accent
            ? 'border-sky-300/15 bg-sky-300/[0.07] text-sky-200'
            : 'border-white/[0.08] bg-white/[0.035] text-slate-400'
        }`}
      >
        {icon}
      </div>

      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {eyebrow}
      </p>

      <h3 className="mt-2 text-base font-semibold tracking-[-0.02em] text-white">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </article>
  );
}

function WorkspaceLoading() {
  return (
    <div>
      <div className="h-4 w-32 animate-pulse rounded-full bg-white/[0.05]" />

      <div className="mt-8 h-52 animate-pulse rounded-[2rem] border border-white/[0.07] bg-white/[0.025]" />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map(
          (item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.025]"
            />
          ),
        )}
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="mx-auto max-w-2xl py-24 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-400">
        <CompassIcon />
      </div>

      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
        Journey not found
      </p>

      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white">
        This trip isn&apos;t available.
      </h1>

      <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-slate-500">
        It may have been deleted, or
        it may belong to another
        Meridian account.
      </p>

      <Link
        href="/dashboard"
        className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
      >
        <ArrowLeftIcon />
        Back to dashboard
      </Link>
    </div>
  );
}

function OverviewContent({
  trip,
}: {
  trip: Trip;
}) {
  return (
    <section className="grid gap-6 py-9 lg:grid-cols-[minmax(0,1.4fr)_minmax(19rem,0.6fr)]">
      <div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
            Overview
          </p>

          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
            Journey foundation
          </h2>

          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
            The core travel details
            are ready. Your itinerary
            is now connected to this
            workspace and the next
            planning layers can build
            on top of it.
          </p>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceCard
            eyebrow="Ready"
            title="Plan itinerary"
            description="Organize the journey into real days and activities."
            icon={
              <CalendarIcon />
            }
            accent
          />

          <WorkspaceCard
            eyebrow="Next"
            title="Save places"
            description="Collect restaurants, landmarks and places worth visiting."
            icon={
              <PinIcon />
            }
          />

          <WorkspaceCard
            eyebrow="Live"
            title="Check weather"
            description="See forecast context aligned with the days of your journey."
            icon={
              <WeatherIcon />
            }
          />

          <WorkspaceCard
            eyebrow="Ready"
            title="Track budget"
            description="Keep travel spending and the trip budget in one place."
            icon={
              <WalletIcon />
            }
          />
        </div>

        <div className="mt-8 overflow-hidden rounded-[1.75rem] border border-white/[0.07] bg-white/[0.025]">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Travel window
              </p>

              <p className="mt-1 text-sm font-medium text-white">
                Journey dates
              </p>
            </div>

            <CalendarIcon />
          </div>

          <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2">
            <div className="bg-[#09131e] p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Departure
              </p>

              <p className="mt-3 text-sm font-medium text-slate-200">
                {formatLongDate(
                  trip.startDate,
                )}
              </p>
            </div>

            <div className="bg-[#09131e] p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Return
              </p>

              <p className="mt-3 text-sm font-medium text-slate-200">
                {formatLongDate(
                  trip.endDate,
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <aside>
        <div className="sticky top-8 overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-white/[0.025]">
          <div className="relative h-44 overflow-hidden bg-[linear-gradient(145deg,#0d2a39,#11384b_55%,#09141e)]">
            <div className="absolute -right-12 -top-20 h-44 w-44 rounded-full border border-sky-200/10 bg-sky-300/[0.04]" />

            <div className="absolute left-6 top-6 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/10 text-sky-200">
              <GlobeIcon />
            </div>

            <div className="absolute bottom-6 left-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200/50">
                Destination
              </p>

              <p className="mt-1 max-w-[15rem] text-lg font-semibold tracking-[-0.025em] text-white">
                {trip.destination}
              </p>
            </div>
          </div>

          <div className="divide-y divide-white/[0.07]">
            <div className="p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Workspace
              </p>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                This journey now has
                its own permanent
                workspace. Everything
                added to the itinerary
                belongs directly to
                this trip.
              </p>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_12px_rgba(125,211,252,0.6)]" />

                <p className="text-xs font-medium text-slate-300">
                  Workspace ready
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </section>
  );
}

function WorkspaceTabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'border-b-2 px-4 pb-4 pt-2 text-sm transition',
        active
          ? 'border-sky-300 font-semibold text-white'
          : 'border-transparent text-slate-500 hover:text-slate-200',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function TripWorkspace({
  tripId,
}: {
  tripId: string;
}) {
  const [
    state,
    setState,
  ] =
    useState<TripWorkspaceState>({
      status: 'loading',
      trip: null,
      error: null,
    });

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<WorkspaceTab>(
      'overview',
    );

  useEffect(() => {
    let cancelled = false;

    void fetchTripState(
      tripId,
    ).then(
      (nextState) => {
        if (!cancelled) {
          setState(
            nextState,
          );
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [tripId]);

  if (
    state.status ===
    'loading'
  ) {
    return <WorkspaceLoading />;
  }

  if (
    state.status ===
    'not-found'
  ) {
    return <NotFoundState />;
  }

  if (
    state.status ===
    'error'
  ) {
    return (
      <div className="rounded-[1.75rem] border border-rose-300/10 bg-rose-300/[0.04] p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-200">
          Couldn&apos;t load journey
        </p>

        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
          {state.error}
        </p>

        <button
          type="button"
          onClick={() => {
            setState({
              status: 'loading',
              trip: null,
              error: null,
            });

            void fetchTripState(
              tripId,
            ).then(
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

  const trip =
    state.trip;

  const duration =
    getDurationDays(
      trip.startDate,
      trip.endDate,
    );

  const destinationInitial =
    trip.destination
      .trim()
      .charAt(0)
      .toUpperCase() ||
    'M';

  return (
    <div>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-white"
      >
        <ArrowLeftIcon />
        All journeys
      </Link>

      <section className="relative mt-8 overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[linear-gradient(135deg,#0b2534_0%,#103345_48%,#0a1722_100%)]">
        <div className="pointer-events-none absolute -right-20 -top-36 h-80 w-80 rounded-full border border-sky-200/10 bg-sky-300/[0.04]" />

        <div className="pointer-events-none absolute -bottom-48 left-[28%] h-72 w-72 rounded-full border border-white/[0.05] bg-white/[0.02]" />

        <div className="pointer-events-none absolute bottom-[-1.5rem] right-12 select-none text-[12rem] font-semibold leading-none tracking-[-0.12em] text-white/[0.035]">
          {destinationInitial}
        </div>

        <div className="relative p-7 sm:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${getStatusClasses(
                trip.status,
              )}`}
            >
              {getStatusLabel(
                trip.status,
              )}
            </span>

            <span className="text-xs text-sky-100/50">
              {formatDate(
                trip.startDate,
              )}{' '}
              —{' '}
              {formatDate(
                trip.endDate,
              )}
            </span>
          </div>

          <div className="mt-14 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200/70">
              {trip.name}
            </p>

            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em] text-white sm:text-5xl lg:text-6xl">
              {trip.destination}
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-7 text-sky-50/50">
              Your journey workspace
              keeps the plan, places and
              travel context together
              from departure to return.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Duration
          </p>

          <p className="mt-3 text-xl font-semibold tracking-[-0.03em] text-white">
            {duration}{' '}
            {duration === 1
              ? 'day'
              : 'days'}
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Currency
          </p>

          <p className="mt-3 text-xl font-semibold tracking-[-0.03em] text-white">
            {trip.currency}
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Timezone
          </p>

          <p className="mt-3 truncate text-sm font-semibold text-white">
            {trip.timezone}
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Journey state
          </p>

          <p className="mt-3 text-sm font-semibold text-white">
            {getStatusLabel(
              trip.status,
            )}
          </p>
        </div>
      </section>

      <nav
        aria-label="Journey workspace"
        className="mt-10 flex gap-1 overflow-x-auto border-b border-white/[0.07]"
      >
        <WorkspaceTabButton
          active={
            activeTab ===
            'overview'
          }
          onClick={() =>
            setActiveTab(
              'overview',
            )
          }
        >
          Overview
        </WorkspaceTabButton>

        <WorkspaceTabButton
          active={
            activeTab ===
            'itinerary'
          }
          onClick={() =>
            setActiveTab(
              'itinerary',
            )
          }
        >
          Itinerary
        </WorkspaceTabButton>

        <WorkspaceTabButton
          active={
            activeTab ===
            'places'
          }
          onClick={() =>
            setActiveTab(
              'places',
            )
          }
        >
          Places
        </WorkspaceTabButton>

        <WorkspaceTabButton
          active={
            activeTab ===
            'weather'
          }
          onClick={() =>
            setActiveTab(
              'weather',
            )
          }
        >
          Weather
        </WorkspaceTabButton>

        <WorkspaceTabButton
          active={
            activeTab ===
            'budget'
          }
          onClick={() =>
            setActiveTab(
              'budget',
            )
          }
        >
          Budget
        </WorkspaceTabButton>
      </nav>

      {activeTab ===
        'overview' && (
        <OverviewContent
          trip={trip}
        />
      )}

      {activeTab ===
        'itinerary' && (
        <div className="py-9">
          <WeatherJourneyStrip
            tripId={trip.id}
          />

          <div className="mt-8">
            <ItineraryTimeline
              tripId={trip.id}
            />
          </div>
        </div>
      )}

      {activeTab ===
        'places' && (
        <div className="py-9">
          <PlacesPanel
            tripId={trip.id}
          />
        </div>
      )}

      {activeTab ===
        'weather' && (
        <WeatherPanel
          tripId={trip.id}
        />
      )}

      {activeTab ===
        'budget' && (
        <BudgetPanel
          tripId={trip.id}
        />
      )}
    </div>
  );
}