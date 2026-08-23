'use client';

import { Trash2, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { useModalBehavior } from '../../../hooks/use-modal-behavior';
import { MeridianAiAssistant } from '../../ai/components/meridian-ai-assistant';
import { BudgetPanel } from '../../budget/components/budget-panel';
import { ItineraryMapWorkspace } from '../../itinerary/components/itinerary-map-workspace';
import { PlacesPanel } from '../../places/components/places-panel';
import { WeatherJourneyStrip, WeatherPanel } from '../../weather/components/weather-panel';
import { ShareJourneyDialog } from '../../collaboration/components/share-journey-dialog';
import type { Trip, TripStatus } from '../types/trip.types';

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

type WorkspaceTab = 'overview' | 'itinerary' | 'places' | 'weather' | 'budget';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readTrip(payload: unknown): Trip | null {
  if (isRecord(payload) && typeof payload.id === 'string') {
    return payload as unknown as Trip;
  }

  if (isRecord(payload) && isRecord(payload.data) && typeof payload.data.id === 'string') {
    return payload.data as unknown as Trip;
  }

  return null;
}

function readErrorMessage(payload: unknown, fallback = 'Unable to load this journey.'): string {
  if (!isRecord(payload)) {
    return fallback;
  }

  const { message } = payload;

  if (typeof message === 'string') {
    return message;
  }

  if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
    return message.join(', ');
  }

  return fallback;
}

async function fetchTripState(tripId: string): Promise<TripWorkspaceState> {
  try {
    const response = await fetch(`/api/trips/${encodeURIComponent(tripId)}`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
      cache: 'no-store',
    });

    const payload: unknown = await response.json();

    if (response.status === 404) {
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
        error: readErrorMessage(payload),
      };
    }

    const trip = readTrip(payload);

    if (!trip) {
      return {
        status: 'error',
        trip: null,
        error: 'Meridian received an unexpected journey response.',
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
      error: 'Trips service is currently unavailable.',
    };
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function getDurationDays(startDate: string, endDate: string): number {
  const start = new Date(startDate).getTime();

  const end = new Date(endDate).getTime();

  const dayMs = 1000 * 60 * 60 * 24;

  const difference = Math.round((end - start) / dayMs);

  return Math.max(difference + 1, 1);
}

function getStatusLabel(status: TripStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Draft';

    case 'PLANNED':
      return 'Planned';

    case 'ARCHIVED':
      return 'Archived';
  }
}

function getStatusClasses(status: TripStatus): string {
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
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
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

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
      <circle cx="8" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17" cy="17" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="m10.2 10.8 4.5-2.6M10.2 13.2l4.5 2.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function getAccessRoleLabel(role: Trip['accessRole']): string {
  switch (role) {
    case 'OWNER':
      return 'Owner';
    case 'EDITOR':
      return 'Editor';
    case 'VIEWER':
      return 'Viewer';
  }
}

function getAccessRoleClasses(role: Trip['accessRole']): string {
  switch (role) {
    case 'OWNER':
      return 'border-sky-300/20 bg-sky-300/[0.08] text-sky-100';
    case 'EDITOR':
      return 'border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100';
    case 'VIEWER':
      return 'border-white/10 bg-white/[0.04] text-slate-300';
  }
}

function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.5" />

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
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <rect x="4" y="6" width="16" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />

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
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <path
        d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      <circle cx="12" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <path
        d="M5 7.5A2.5 2.5 0 0 1 7.5 5H18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7a3 3 0 0 1-3-3V8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      <path d="M19 10h-4a2 2 0 1 0 0 4h4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function WeatherIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
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
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />

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
        accent ? 'border-sky-300/15 bg-sky-300/[0.045]' : 'border-white/[0.07] bg-white/[0.025]'
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

      <h3 className="mt-2 text-base font-semibold tracking-[-0.02em] text-white">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </article>
  );
}

function WorkspaceLoading() {
  return (
    <div>
      <div className="h-4 w-32 animate-pulse rounded-full bg-white/[0.05]" />

      <div className="mt-8 h-52 animate-pulse rounded-[2rem] border border-white/[0.07] bg-white/[0.025]" />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-28 animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.025]"
          />
        ))}
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
        It may have been deleted, or it may belong to another Meridian account.
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

function DeleteJourneyDialog({
  trip,
  deleting,
  error,
  onCancel,
  onConfirm,
}: {
  trip: Trip;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [confirmation, setConfirmation] = useState('');

  const confirmed = confirmation === trip.name;

  useModalBehavior({
    open: true,
    disabled: deleting,
    onClose: onCancel,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-journey-title"
      aria-describedby="delete-journey-description"
    >
      <div className="relative w-full max-w-lg rounded-[28px] border border-white/10 bg-[#0b121b] p-6 shadow-[0_32px_140px_rgba(0,0,0,0.7)] sm:p-7">
        <button
          type="button"
          onClick={onCancel}
          disabled={deleting}
          aria-label="Close delete journey dialog"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-slate-500 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X className="h-4 w-4" strokeWidth={1.7} />
        </button>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-300/15 bg-rose-300/[0.06] text-rose-200">
          <Trash2 className="h-5 w-5" strokeWidth={1.6} />
        </div>

        <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-300/75">
          Permanent action
        </p>

        <h2
          id="delete-journey-title"
          className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white"
        >
          Delete this journey?
        </h2>

        <p id="delete-journey-description" className="mt-3 text-sm leading-6 text-slate-400">
          <span className="font-medium text-slate-200">{trip.name}</span> will be permanently
          removed together with its itinerary, places, budget, expenses and collaborators. This
          cannot be undone.
        </p>

        <label className="mt-6 block">
          <span className="text-xs font-medium text-slate-400">
            Type <span className="font-semibold text-slate-200">{trip.name}</span> to confirm
          </span>

          <input
            type="text"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={deleting}
            autoComplete="off"
            spellCheck={false}
            placeholder={trip.name}
            className="mt-2 w-full rounded-xl border border-white/[0.09] bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-rose-300/30 focus:ring-2 focus:ring-rose-300/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-300/10 bg-rose-300/[0.04] px-4 py-3 text-sm leading-6 text-rose-200">
            {error}
          </div>
        )}

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Keep journey
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting || !confirmed}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300/15 bg-rose-300/[0.09] px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/[0.14] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.7} />
            {deleting ? 'Deleting...' : 'Delete journey'}
          </button>
        </div>
      </div>
    </div>
  );
}

function OverviewContent({ trip, onDelete }: { trip: Trip; onDelete: () => void }) {
  return (
    <section className="grid gap-6 py-9 lg:grid-cols-[minmax(0,1.4fr)_minmax(19rem,0.6fr)]">
      <div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Overview</p>

          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
            Journey foundation
          </h2>

          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
            The core travel details are ready. Your itinerary is now connected to this workspace and
            the next planning layers can build on top of it.
          </p>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceCard
            eyebrow="Ready"
            title="Plan itinerary"
            description="Organize the journey into real days and activities."
            icon={<CalendarIcon />}
            accent
          />

          <WorkspaceCard
            eyebrow="Next"
            title="Save places"
            description="Collect restaurants, landmarks and places worth visiting."
            icon={<PinIcon />}
          />

          <WorkspaceCard
            eyebrow="Live"
            title="Check weather"
            description="See forecast context aligned with the days of your journey."
            icon={<WeatherIcon />}
          />

          <WorkspaceCard
            eyebrow="Ready"
            title="Track budget"
            description="Keep travel spending and the trip budget in one place."
            icon={<WalletIcon />}
          />
        </div>

        <div className="mt-8 overflow-hidden rounded-[1.75rem] border border-white/[0.07] bg-white/[0.025]">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Travel window
              </p>

              <p className="mt-1 text-sm font-medium text-white">Journey dates</p>
            </div>

            <CalendarIcon />
          </div>

          <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2">
            <div className="bg-[#09131e] p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Departure
              </p>

              <p className="mt-3 text-sm font-medium text-slate-200">
                {formatLongDate(trip.startDate)}
              </p>
            </div>

            <div className="bg-[#09131e] p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Return
              </p>

              <p className="mt-3 text-sm font-medium text-slate-200">
                {formatLongDate(trip.endDate)}
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
                This journey now has its own permanent workspace. Everything added to the itinerary
                belongs directly to this trip.
              </p>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_12px_rgba(125,211,252,0.6)]" />

                <p className="text-xs font-medium text-slate-300">Workspace ready</p>
              </div>
            </div>

            {trip.accessRole === 'OWNER' && (
              <div className="p-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-300/65">
                  Danger zone
                </p>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Permanently delete this journey and all of its connected planning data.
                </p>

                <button
                  type="button"
                  onClick={onDelete}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-rose-300/15 bg-rose-300/[0.055] px-3.5 py-2.5 text-sm font-medium text-rose-100 transition hover:border-rose-300/25 hover:bg-rose-300/[0.09]"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.7} />
                  Delete journey
                </button>
              </div>
            )}
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
  const reduceMotion = useReducedMotion();

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative shrink-0 overflow-hidden rounded-xl border px-3.5 py-2.5 text-sm font-medium outline-none transition',
        active
          ? 'border-sky-300/10 text-sky-100'
          : 'border-transparent text-slate-500 hover:bg-white/[0.035] hover:text-slate-200',
        'focus-visible:ring-2 focus-visible:ring-sky-300/20',
      ].join(' ')}
    >
      {active && (
        <motion.span
          layoutId="meridian-workspace-tab"
          transition={{
            duration: reduceMotion ? 0 : 0.24,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="absolute inset-0 rounded-xl bg-sky-300/[0.06]"
        />
      )}

      <span className="relative">{children}</span>
    </button>
  );
}

export function TripWorkspace({ tripId }: { tripId: string }) {
  const router = useRouter();

  const [state, setState] = useState<TripWorkspaceState>({
    status: 'loading',
    trip: null,
    error: null,
  });

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');

  const [shareOpen, setShareOpen] = useState(false);

  const [statusSaving, setStatusSaving] = useState(false);

  const [statusError, setStatusError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);

  const [deletingJourney, setDeletingJourney] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchTripState(tripId).then((nextState) => {
      if (!cancelled) {
        setState(nextState);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [tripId]);

  async function updateJourneyStatus(nextStatus: TripStatus) {
    if (state.status !== 'success' || state.trip.accessRole !== 'OWNER') {
      return;
    }

    setStatusSaving(true);
    setStatusError(null);

    try {
      const response = await fetch(`/api/trips/${encodeURIComponent(state.trip.id)}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          status: nextStatus,
        }),
      });

      const payload: unknown = await response.json();

      if (!response.ok) {
        setStatusError(readErrorMessage(payload));
        return;
      }

      const updatedTrip = readTrip(payload);

      if (!updatedTrip) {
        setStatusError('Meridian updated the journey but returned an unexpected response.');
        return;
      }

      setState({
        status: 'success',
        trip: updatedTrip,
        error: null,
      });
    } catch {
      setStatusError('Journey status could not be updated right now.');
    } finally {
      setStatusSaving(false);
    }
  }

  async function deleteJourney() {
    if (state.status !== 'success' || state.trip.accessRole !== 'OWNER') {
      return;
    }

    setDeletingJourney(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/trips/${encodeURIComponent(state.trip.id)}`, {
        method: 'DELETE',
        headers: {
          accept: 'application/json',
        },
      });

      if (!response.ok) {
        let payload: unknown = null;

        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        setDeleteError(readErrorMessage(payload, 'Unable to delete this journey.'));
        return;
      }

      setDeleteOpen(false);

      router.replace('/dashboard');
      router.refresh();
    } catch {
      setDeleteError('Trips service is currently unavailable. Your journey was not deleted.');
    } finally {
      setDeletingJourney(false);
    }
  }

  if (state.status === 'loading') {
    return <WorkspaceLoading />;
  }

  if (state.status === 'not-found') {
    return <NotFoundState />;
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-[1.75rem] border border-rose-300/10 bg-rose-300/[0.04] p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-200">
          Couldn&apos;t load journey
        </p>

        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">{state.error}</p>

        <button
          type="button"
          onClick={() => {
            setState({
              status: 'loading',
              trip: null,
              error: null,
            });

            void fetchTripState(tripId).then(setState);
          }}
          className="mt-6 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.09]"
        >
          Try again
        </button>
      </div>
    );
  }

  const trip = state.trip;

  const duration = getDurationDays(trip.startDate, trip.endDate);

  const destinationInitial = trip.destination.trim().charAt(0).toUpperCase() || 'M';

  const canEdit = trip.accessRole !== 'VIEWER';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-white"
        >
          <ArrowLeftIcon />
          All journeys
        </Link>

        {trip.accessRole === 'OWNER' && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {trip.status !== 'ARCHIVED' && (
              <button
                type="button"
                disabled={statusSaving}
                onClick={() => {
                  void updateJourneyStatus(trip.status === 'DRAFT' ? 'PLANNED' : 'DRAFT');
                }}
                className={[
                  'inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium outline-none transition disabled:cursor-wait disabled:opacity-50',
                  trip.status === 'DRAFT'
                    ? 'border-emerald-300/15 bg-emerald-300/[0.055] text-emerald-100 hover:border-emerald-300/25 hover:bg-emerald-300/[0.08]'
                    : 'border-white/[0.08] bg-white/[0.025] text-slate-400 hover:bg-white/[0.05] hover:text-white',
                ].join(' ')}
              >
                {statusSaving
                  ? 'Updating…'
                  : trip.status === 'DRAFT'
                    ? 'Mark as planned'
                    : 'Reopen as draft'}
              </button>
            )}

            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-3.5 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-300/20 hover:bg-sky-300/[0.06] hover:text-white"
            >
              <ShareIcon />
              Share journey
            </button>
          </div>
        )}
      </div>

      {statusError && (
        <div className="mt-4 rounded-xl border border-rose-300/10 bg-rose-300/[0.04] px-4 py-3 text-xs text-rose-200">
          {statusError}
        </div>
      )}

      <section className="relative mt-6 overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(11,37,52,0.88)_0%,rgba(12,31,44,0.92)_48%,rgba(7,17,27,0.96)_100%)] shadow-[0_30px_90px_rgba(0,0,0,0.22)]">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-sky-200/10 bg-sky-300/[0.035]" />

        <div className="pointer-events-none absolute bottom-[-3.5rem] right-8 select-none text-[9rem] font-semibold leading-none tracking-[-0.12em] text-white/[0.03] sm:text-[11rem]">
          {destinationInitial}
        </div>

        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.17em] ${getStatusClasses(
                    trip.status,
                  )}`}
                >
                  {getStatusLabel(trip.status)}
                </span>

                <span
                  className={[
                    'inline-flex rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.15em]',
                    getAccessRoleClasses(trip.accessRole),
                  ].join(' ')}
                >
                  {getAccessRoleLabel(trip.accessRole)}
                </span>

                <span className="text-[11px] text-sky-100/45">
                  {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
                </span>
              </div>

              <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/65">
                {trip.name}
              </p>

              <h1 className="mt-2 truncate text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl lg:text-5xl">
                {trip.destination}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-sky-50/45">
                One workspace for the itinerary, map, places, weather, spending and live
                collaboration around this journey.
              </p>
            </div>

            <div className="grid shrink-0 grid-cols-3 gap-2 lg:min-w-[25rem]">
              <div className="rounded-2xl border border-white/[0.07] bg-black/10 px-4 py-3.5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Duration
                </p>

                <p className="mt-2 text-sm font-semibold text-white">
                  {duration} {duration === 1 ? 'day' : 'days'}
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-black/10 px-4 py-3.5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Currency
                </p>

                <p className="mt-2 text-sm font-semibold text-white">{trip.currency}</p>
              </div>

              <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-black/10 px-4 py-3.5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Timezone
                </p>

                <p className="mt-2 truncate text-xs font-semibold text-white">{trip.timezone}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {trip.accessRole === 'VIEWER' && (
        <div className="mt-6 flex flex-col gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-200">Read-only journey access</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              You can explore this workspace and follow live changes, but editing is reserved for
              owners and editors.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
            Viewer
          </span>
        </div>
      )}

      <div className="sticky top-[72px] z-30 -mx-2 mt-7 border-y border-transparent bg-[#050b12]/86 px-2 py-2 backdrop-blur-xl supports-[backdrop-filter]:bg-[#050b12]/74">
        <nav
          aria-label="Journey workspace"
          className="flex w-full gap-1 overflow-x-auto rounded-2xl border border-white/[0.07] bg-[#08131d]/88 p-1.5 shadow-[0_14px_42px_rgba(0,0,0,0.16)]"
        >
          <WorkspaceTabButton
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </WorkspaceTabButton>

          <WorkspaceTabButton
            active={activeTab === 'itinerary'}
            onClick={() => setActiveTab('itinerary')}
          >
            Itinerary
          </WorkspaceTabButton>

          <WorkspaceTabButton
            active={activeTab === 'places'}
            onClick={() => setActiveTab('places')}
          >
            Places
          </WorkspaceTabButton>

          <WorkspaceTabButton
            active={activeTab === 'weather'}
            onClick={() => setActiveTab('weather')}
          >
            Weather
          </WorkspaceTabButton>

          <WorkspaceTabButton
            active={activeTab === 'budget'}
            onClick={() => setActiveTab('budget')}
          >
            Budget
          </WorkspaceTabButton>
        </nav>
      </div>

      <motion.div
        key={activeTab}
        initial={{
          opacity: 0,
          y: 5,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.22,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {activeTab === 'overview' && (
          <OverviewContent
            trip={trip}
            onDelete={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
          />
        )}

        {activeTab === 'itinerary' && (
          <div className="py-9">
            <WeatherJourneyStrip tripId={trip.id} />

            <div className="mt-5">
              <ItineraryMapWorkspace tripId={trip.id} canEdit={canEdit} />
            </div>
          </div>
        )}

        {activeTab === 'places' && (
          <div className="py-9">
            <PlacesPanel tripId={trip.id} canEdit={canEdit} />
          </div>
        )}

        {activeTab === 'weather' && <WeatherPanel tripId={trip.id} />}

        {activeTab === 'budget' && <BudgetPanel tripId={trip.id} canEdit={canEdit} />}
      </motion.div>

      {canEdit && (
        <MeridianAiAssistant
          tripId={trip.id}
          destination={trip.destination}
          currency={trip.currency}
          onOpenItinerary={() => setActiveTab('itinerary')}
        />
      )}

      {shareOpen && (
        <ShareJourneyDialog
          tripId={trip.id}
          tripName={trip.name}
          onClose={() => setShareOpen(false)}
        />
      )}

      {deleteOpen && trip.accessRole === 'OWNER' && (
        <DeleteJourneyDialog
          trip={trip}
          deleting={deletingJourney}
          error={deleteError}
          onCancel={() => {
            if (deletingJourney) {
              return;
            }

            setDeleteOpen(false);
            setDeleteError(null);
          }}
          onConfirm={() => {
            void deleteJourney();
          }}
        />
      )}
    </div>
  );
}
