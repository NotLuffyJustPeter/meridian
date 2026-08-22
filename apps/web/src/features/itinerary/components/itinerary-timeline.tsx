'use client';

import {
  MapPin,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useModalBehavior } from '../../../hooks/use-modal-behavior';

import type {
  Activity,
  ActivityCategory,
  CreateActivityInput,
  Itinerary,
  ReorderActivitiesInput,
  TripDay,
  UpdateActivityInput,
} from '../types/itinerary.types';

import { useTripRealtime } from '../../realtime/hooks/use-trip-realtime';

interface ItineraryTimelineProps {
  tripId: string;
  canEdit: boolean;
  selectedPlaceId?: string | null;
  onSelectPlace?: (
    placeId: string,
  ) => void;
}

type TimelineState =
  | {
      status: 'loading';
    }
  | {
      status: 'success';
      itinerary: Itinerary;
    }
  | {
      status: 'error';
      message: string;
    };

type ActivityDialogState =
  | {
      mode: 'create';
      day: TripDay;
    }
  | {
      mode: 'edit';
      day: TripDay;
      activity: Activity;
    }
  | null;

interface ActivityFormState {
  title: string;
  description: string;
  category: ActivityCategory;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
}

const EMPTY_FORM: ActivityFormState = {
  title: '',
  description: '',
  category: 'OTHER',
  startTime: '',
  endTime: '',
  location: '',
  notes: '',
};

const CATEGORY_META: Record<
  ActivityCategory,
  {
    label: string;
    badgeClassName: string;
  }
> = {
  SIGHTSEEING: {
    label: 'Sightseeing',
    badgeClassName:
      'border-violet-400/20 bg-violet-400/10 text-violet-200',
  },
  FOOD: {
    label: 'Food',
    badgeClassName:
      'border-amber-400/20 bg-amber-400/10 text-amber-200',
  },
  TRANSPORT: {
    label: 'Transport',
    badgeClassName:
      'border-sky-400/20 bg-sky-400/10 text-sky-200',
  },
  LODGING: {
    label: 'Lodging',
    badgeClassName:
      'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  },
  SHOPPING: {
    label: 'Shopping',
    badgeClassName:
      'border-pink-400/20 bg-pink-400/10 text-pink-200',
  },
  ENTERTAINMENT: {
    label: 'Entertainment',
    badgeClassName:
      'border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200',
  },
  OTHER: {
    label: 'Other',
    badgeClassName:
      'border-white/10 bg-white/5 text-white/70',
  },
};

const ACTIVITY_CATEGORIES =
  Object.keys(
    CATEGORY_META,
  ) as ActivityCategory[];

function isRecord(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value === 'object' &&
    value !== null
  );
}

function getErrorMessage(
  payload: unknown,
): string {
  if (!isRecord(payload)) {
    return 'Something went wrong.';
  }

  const message =
    payload['message'];

  if (
    typeof message === 'string'
  ) {
    return message;
  }

  if (
    Array.isArray(message)
  ) {
    const messages =
      message.filter(
        (
          item,
        ): item is string =>
          typeof item ===
          'string',
      );

    if (
      messages.length > 0
    ) {
      return messages.join(
        ', ',
      );
    }
  }

  return 'Something went wrong.';
}

function isItinerary(
  value: unknown,
): value is Itinerary {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value['tripId'] ===
      'string' &&
    typeof value['timezone'] ===
      'string' &&
    Array.isArray(
      value['days'],
    )
  );
}

async function fetchItineraryState(
  tripId: string,
): Promise<TimelineState> {
  try {
    const response =
      await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/itinerary`,
        {
          method: 'GET',
          cache: 'no-store',
        },
      );

    const payload =
      (await response.json()) as unknown;

    if (!response.ok) {
      return {
        status: 'error',
        message:
          getErrorMessage(
            payload,
          ),
      };
    }

    if (
      !isItinerary(payload)
    ) {
      return {
        status: 'error',
        message:
          'Itinerary service returned an invalid response.',
      };
    }

    return {
      status: 'success',
      itinerary: payload,
    };
  } catch {
    return {
      status: 'error',
      message:
        'Itinerary service is currently unavailable.',
    };
  }
}

function formatDayShort(
  date: string,
): string {
  return new Intl.DateTimeFormat(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    },
  ).format(
    new Date(date),
  );
}

function formatDayLong(
  date: string,
): string {
  return new Intl.DateTimeFormat(
    'en-US',
    {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    },
  ).format(
    new Date(date),
  );
}

function getActivityTime(
  activity: Activity,
): string {
  if (
    activity.startTime &&
    activity.endTime
  ) {
    return `${activity.startTime} – ${activity.endTime}`;
  }

  if (
    activity.startTime
  ) {
    return activity.startTime;
  }

  if (
    activity.endTime
  ) {
    return `Until ${activity.endTime}`;
  }

  return 'Flexible';
}

function activityToForm(
  activity: Activity,
): ActivityFormState {
  return {
    title:
      activity.title,
    description:
      activity.description ??
      '',
    category:
      activity.category,
    startTime:
      activity.startTime ??
      '',
    endTime:
      activity.endTime ??
      '',
    location:
      activity.location ??
      '',
    notes:
      activity.notes ??
      '',
  };
}

function optionalText(
  value: string,
): string | undefined {
  const trimmed =
    value.trim();

  return trimmed.length > 0
    ? trimmed
    : undefined;
}

function compareByPosition(
  a: Activity,
  b: Activity,
): number {
  if (
    a.position !== b.position
  ) {
    return (
      a.position -
      b.position
    );
  }

  return a.createdAt.localeCompare(
    b.createdAt,
  );
}

function compareChronologically(
  a: Activity,
  b: Activity,
): number {
  if (
    a.startTime &&
    b.startTime
  ) {
    const byStartTime =
      a.startTime.localeCompare(
        b.startTime,
      );

    if (
      byStartTime !== 0
    ) {
      return byStartTime;
    }

    if (
      a.endTime &&
      b.endTime
    ) {
      const byEndTime =
        a.endTime.localeCompare(
          b.endTime,
        );

      if (
        byEndTime !== 0
      ) {
        return byEndTime;
      }
    }

    return compareByPosition(
      a,
      b,
    );
  }

  if (a.startTime) {
    return -1;
  }

  if (b.startTime) {
    return 1;
  }

  if (
    a.endTime &&
    b.endTime
  ) {
    const byEndTime =
      a.endTime.localeCompare(
        b.endTime,
      );

    if (
      byEndTime !== 0
    ) {
      return byEndTime;
    }
  }

  if (a.endTime) {
    return -1;
  }

  if (b.endTime) {
    return 1;
  }

  return compareByPosition(
    a,
    b,
  );
}

function arraysEqual(
  a: string[],
  b: string[],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (
        value,
        index,
      ) =>
        value === b[index],
    )
  );
}

function DayButton({
  day,
  active,
  onSelect,
}: {
  day: TripDay;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={[
        'group min-w-[116px] rounded-2xl border px-4 py-3 text-left transition',
        active
          ? 'border-white/20 bg-white/[0.09] shadow-[0_12px_40px_rgba(0,0,0,0.22)]'
          : 'border-white/[0.07] bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.05]',
      ].join(' ')}
    >
      <div
        className={[
          'text-[10px] font-semibold uppercase tracking-[0.18em]',
          active
            ? 'text-white/70'
            : 'text-white/35',
        ].join(' ')}
      >
        Day {day.dayNumber}
      </div>

      <div className="mt-1 text-sm font-medium text-white">
        {formatDayShort(
          day.date,
        )}
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-white/40">
        <span
          className={[
            'h-1.5 w-1.5 rounded-full',
            day.activities
              .length > 0
              ? 'bg-white/70'
              : 'bg-white/20',
          ].join(' ')}
        />

        {day.activities.length}{' '}
        {day.activities
          .length === 1
          ? 'activity'
          : 'activities'}
      </div>
    </button>
  );
}

function ReorderButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'up' | 'down';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={
        direction === 'up'
          ? 'Move activity up'
          : 'Move activity down'
      }
      title={
        direction === 'up'
          ? 'Move up'
          : 'Move down'
      }
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.025] text-xs text-white/45 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
    >
      {direction === 'up'
        ? '↑'
        : '↓'}
    </button>
  );
}

function ActivityCard({
  activity,
  isFirst,
  isLast,
  canEdit,
  reordering,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  selected,
  onSelectPlace,
}: {
  activity: Activity;
  isFirst: boolean;
  isLast: boolean;
  canEdit: boolean;
  reordering: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
  selected: boolean;
  onSelectPlace?: () => void;
}) {
  const category =
    CATEGORY_META[
      activity.category
    ];

  return (
    <div className="relative grid min-w-0 grid-cols-[52px_14px_minmax(0,1fr)] gap-2 sm:grid-cols-[70px_20px_minmax(0,1fr)] sm:gap-3 md:grid-cols-[110px_32px_minmax(0,1fr)] md:gap-5">
      <div className="min-w-0 pt-1 text-right">
        <div className="break-words font-mono text-[10px] font-medium leading-4 text-white/75 sm:text-xs md:text-sm">
          {getActivityTime(
            activity,
          )}
        </div>
      </div>

      <div className="relative flex justify-center">
        {!isLast && (
          <div className="absolute bottom-[-32px] top-4 w-px bg-gradient-to-b from-white/15 to-white/[0.03]" />
        )}

        <div className="relative z-10 mt-1.5 h-3 w-3 rounded-full border border-white/30 bg-[#111318] shadow-[0_0_0_5px_rgba(255,255,255,0.035)]" />
      </div>

      <article
        className={[
          'group mb-6 min-w-0 overflow-hidden rounded-2xl border p-3 transition sm:p-4 md:mb-7 md:p-5',
          selected
            ? 'border-sky-300/20 bg-sky-300/[0.055] shadow-[0_16px_42px_rgba(56,189,248,0.06)]'
            : 'border-white/[0.08] bg-white/[0.035] hover:border-white/[0.14] hover:bg-white/[0.05]',
        ].join(' ')}
      >
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h4 className="break-words text-sm font-semibold tracking-[-0.01em] text-white sm:text-base md:text-lg">
              {activity.title}
            </h4>

            {activity.location && (
              <p className="mt-1 break-words text-xs text-white/45 sm:text-sm">
                {activity.location}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-start gap-1.5 sm:justify-end sm:gap-2">
            <span
              className={[
                'rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em]',
                category.badgeClassName,
              ].join(' ')}
            >
              {category.label}
            </span>

            {activity.placeId &&
              onSelectPlace && (
              <button
                type="button"
                onClick={
                  onSelectPlace
                }
                className={[
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition',
                  selected
                    ? 'border-sky-300/20 bg-sky-300/[0.08] text-sky-100'
                    : 'border-white/[0.08] bg-white/[0.03] text-slate-500 hover:border-sky-300/15 hover:text-sky-200',
                ].join(' ')}
              >
                <MapPin className="h-3 w-3" />
                {selected
                  ? 'On map'
                  : 'View on map'}
              </button>
            )}

            {canEdit && (
              <>
                <div className="flex items-center gap-1">
                  <ReorderButton
                    direction="up"
                    disabled={
                      isFirst ||
                      reordering
                    }
                    onClick={
                      onMoveUp
                    }
                  />

                  <ReorderButton
                    direction="down"
                    disabled={
                      isLast ||
                      reordering
                    }
                    onClick={
                      onMoveDown
                    }
                  />
                </div>

                <button
                  type="button"
                  onClick={onEdit}
                  disabled={reordering}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.035] px-2.5 py-1.5 text-[11px] font-medium text-white/55 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
                >
                  Edit
                </button>

                <button
                  type="button"
                  onClick={onDelete}
                  disabled={reordering}
                  className="rounded-lg border border-rose-300/10 bg-rose-300/[0.035] px-2.5 py-1.5 text-[11px] font-medium text-rose-200/60 transition hover:bg-rose-300/[0.08] hover:text-rose-100 disabled:opacity-40"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        {activity.description && (
          <p className="mt-4 max-w-3xl break-words text-sm leading-6 text-white/55">
            {activity.description}
          </p>
        )}

        {activity.notes && (
          <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/15 px-3.5 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">
              Notes
            </div>

            <p className="mt-1.5 break-words text-sm leading-5 text-white/50">
              {activity.notes}
            </p>
          </div>
        )}
      </article>
    </div>
  );
}

function EmptyDay({
  canEdit,
  onAdd,
}: {
  canEdit: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center">
      {canEdit ? (
        <button
          type="button"
          onClick={onAdd}
          className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-lg text-white/50 transition hover:bg-white/[0.08] hover:text-white"
        >
          +
        </button>
      ) : (
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.025] text-sm text-white/30">
          ·
        </div>
      )}

      <h4 className="mt-4 text-base font-medium text-white/80">
        Nothing planned yet
      </h4>

      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/40">
        {canEdit
          ? 'This day is still open. Add the first activity whenever you\'re ready.'
          : 'This day is still open. An owner or editor can add the first activity.'}
      </p>

      {canEdit && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-5 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.1]"
        >
          Add activity
        </button>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-5">
      <div className="flex gap-3 overflow-hidden">
        {Array.from({
          length: 5,
        }).map(
          (_, index) => (
            <div
              key={index}
              className="h-[92px] min-w-[116px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.035]"
            />
          ),
        )}
      </div>

      <div className="h-[360px] animate-pulse rounded-3xl border border-white/[0.06] bg-white/[0.025]" />
    </div>
  );
}

function ActivityDialog({
  dialog,
  form,
  error,
  submitting,
  onChange,
  onClose,
  onSubmit,
}: {
  dialog: NonNullable<ActivityDialogState>;
  form: ActivityFormState;
  error: string | null;
  submitting: boolean;
  onChange: (
    next: ActivityFormState,
  ) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const isEditing =
    dialog.mode === 'edit';

  useModalBehavior({
    open: true,
    disabled:
      submitting,
    onClose,
  });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center overflow-hidden bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={
        isEditing
          ? 'Edit activity'
          : 'Add activity'
      }
    >
      <div className="flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden border border-white/10 bg-[#0c1118] shadow-[0_30px_120px_rgba(0,0,0,0.65)] sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-[28px]">
        <div className="z-20 flex shrink-0 items-start justify-between border-b border-white/[0.07] bg-[#0c1118]/95 px-5 py-4 backdrop-blur-xl sm:px-6 sm:py-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300/70">
              Day{' '}
              {
                dialog.day
                  .dayNumber
              }
            </p>

            <h3 className="mt-1.5 text-xl font-semibold tracking-[-0.03em] text-white">
              {isEditing
                ? 'Edit activity'
                : 'Add activity'}
            </h3>

            <p className="mt-1 text-sm text-white/35">
              {formatDayLong(
                dialog.day.date,
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-lg text-white/45 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6">
          <label className="block">
            <span className="text-xs font-medium text-white/60">
              Title
            </span>

            <input
              value={form.title}
              onChange={(
                event,
              ) =>
                onChange({
                  ...form,
                  title:
                    event.target
                      .value,
                })
              }
              maxLength={160}
              placeholder="Visit Meiji Shrine"
              className="mt-2 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-sky-300/30 focus:bg-white/[0.05]"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-white/60">
                Category
              </span>

              <select
                value={
                  form.category
                }
                onChange={(
                  event,
                ) =>
                  onChange({
                    ...form,
                    category:
                      event.target
                        .value as ActivityCategory,
                  })
                }
                className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#111720] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/30"
              >
                {ACTIVITY_CATEGORIES.map(
                  (
                    category,
                  ) => (
                    <option
                      key={
                        category
                      }
                      value={
                        category
                      }
                    >
                      {
                        CATEGORY_META[
                          category
                        ].label
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-white/60">
                Location
              </span>

              <input
                value={
                  form.location
                }
                onChange={(
                  event,
                ) =>
                  onChange({
                    ...form,
                    location:
                      event.target
                        .value,
                  })
                }
                maxLength={200}
                placeholder="Shibuya, Tokyo"
                className="mt-2 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-sky-300/30 focus:bg-white/[0.05]"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-white/60">
                Start time
              </span>

              <input
                type="time"
                value={
                  form.startTime
                }
                onChange={(
                  event,
                ) =>
                  onChange({
                    ...form,
                    startTime:
                      event.target
                        .value,
                  })
                }
                className="mt-2 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/30 focus:bg-white/[0.05]"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-white/60">
                End time
              </span>

              <input
                type="time"
                value={
                  form.endTime
                }
                onChange={(
                  event,
                ) =>
                  onChange({
                    ...form,
                    endTime:
                      event.target
                        .value,
                  })
                }
                className="mt-2 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/30 focus:bg-white/[0.05]"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-white/60">
              Description
            </span>

            <textarea
              value={
                form.description
              }
              onChange={(
                event,
              ) =>
                onChange({
                  ...form,
                  description:
                    event.target
                      .value,
                })
              }
              maxLength={1000}
              rows={3}
              placeholder="Optional details about this activity..."
              className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/20 focus:border-sky-300/30 focus:bg-white/[0.05]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-white/60">
              Notes
            </span>

            <textarea
              value={
                form.notes
              }
              onChange={(
                event,
              ) =>
                onChange({
                  ...form,
                  notes:
                    event.target
                      .value,
                })
              }
              maxLength={2000}
              rows={3}
              placeholder="Tickets, reservation details, reminders..."
              className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/20 focus:border-sky-300/30 focus:bg-white/[0.05]"
            />
          </label>

          {error && (
            <div className="rounded-xl border border-rose-300/10 bg-rose-300/[0.04] px-4 py-3 text-sm text-rose-200/80">
              {error}
            </div>
          )}
        </div>

        <div className="z-20 flex shrink-0 flex-col-reverse gap-3 border-t border-white/[0.07] bg-[#0c1118]/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl sm:flex-row sm:justify-end sm:px-6 sm:py-5">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={
              submitting ||
              form.title.trim()
                .length === 0
            }
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting
              ? 'Saving...'
              : isEditing
                ? 'Save changes'
                : 'Add activity'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteDialog({
  activity,
  deleting,
  error,
  onCancel,
  onConfirm,
}: {
  activity: Activity;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-label="Delete activity"
    >
      <div className="w-full max-w-md rounded-[26px] border border-white/10 bg-[#0c1118] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.65)]">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-300/10 bg-rose-300/[0.05] text-rose-200">
          !
        </div>

        <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-white">
          Delete activity?
        </h3>

        <p className="mt-2 text-sm leading-6 text-white/45">
          “{activity.title}”
          will be permanently
          removed from this day.
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-300/10 bg-rose-300/[0.04] px-4 py-3 text-sm text-rose-200/80">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-xl border border-rose-300/15 bg-rose-300/[0.08] px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/[0.13] disabled:opacity-40"
          >
            {deleting
              ? 'Deleting...'
              : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ItineraryTimeline({
  tripId,
  canEdit,
  selectedPlaceId = null,
  onSelectPlace,
}: ItineraryTimelineProps) {
  const [
    state,
    setState,
  ] =
    useState<TimelineState>({
      status: 'loading',
    });

  const [
    selectedDayId,
    setSelectedDayId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    activityDialog,
    setActivityDialog,
  ] =
    useState<ActivityDialogState>(
      null,
    );

  const [
    form,
    setForm,
  ] =
    useState<ActivityFormState>(
      EMPTY_FORM,
    );

  const [
    formError,
    setFormError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    deleteTarget,
    setDeleteTarget,
  ] =
    useState<{
      day: TripDay;
      activity: Activity;
    } | null>(null);

  const [
    deleteError,
    setDeleteError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    deleting,
    setDeleting,
  ] =
    useState(false);

  const [
    reordering,
    setReordering,
  ] =
    useState(false);

  const [
    reorderError,
    setReorderError,
  ] =
    useState<string | null>(
      null,
    );

  async function reloadItinerary() {
    const nextState =
      await fetchItineraryState(
        tripId,
      );

    setState(nextState);

    return nextState;
  }

  const {
    status: realtimeStatus,
    onlineUsers,
  } = useTripRealtime({
    tripId,
    onItineraryChanged: () => {
      void reloadItinerary();
    },
  });

  async function persistActivityOrder(
    dayId: string,
    activityIds: string[],
  ): Promise<string | null> {
    if (
      activityIds.length < 2
    ) {
      return null;
    }

    const payload:
      ReorderActivitiesInput = {
        activityIds,
      };

    try {
      const response =
        await fetch(
          `/api/trips/${encodeURIComponent(tripId)}/itinerary/days/${encodeURIComponent(dayId)}/activities/reorder`,
          {
            method: 'PATCH',
            headers: {
              'content-type':
                'application/json',
            },
            body: JSON.stringify(
              payload,
            ),
          },
        );

      let responsePayload:
        unknown = null;

      try {
        responsePayload =
          (await response.json()) as unknown;
      } catch {
        responsePayload =
          null;
      }

      if (!response.ok) {
        return getErrorMessage(
          responsePayload,
        );
      }

      return null;
    } catch {
      return 'Unable to reorder activities right now.';
    }
  }

  async function sortDayChronologically(
    dayId: string,
  ): Promise<string | null> {
    const freshState =
      await fetchItineraryState(
        tripId,
      );

    if (
      freshState.status !==
      'success'
    ) {
      setState(freshState);

      return freshState.status ===
        'error'
        ? freshState.message
        : 'Unable to refresh itinerary.';
    }

    const day =
      freshState.itinerary.days.find(
        (item) =>
          item.id === dayId,
      );

    if (!day) {
      setState(freshState);

      return 'Trip day could not be found.';
    }

    const currentOrder =
      [...day.activities]
        .sort(
          compareByPosition,
        )
        .map(
          (activity) =>
            activity.id,
        );

    const chronologicalOrder =
      [...day.activities]
        .sort(
          compareChronologically,
        )
        .map(
          (activity) =>
            activity.id,
        );

    if (
      chronologicalOrder.length <
        2 ||
      arraysEqual(
        currentOrder,
        chronologicalOrder,
      )
    ) {
      setState(freshState);

      return null;
    }

    const reorderResult =
      await persistActivityOrder(
        dayId,
        chronologicalOrder,
      );

    if (reorderResult) {
      setState(freshState);

      return reorderResult;
    }

    await reloadItinerary();

    return null;
  }

  useEffect(() => {
    let cancelled =
      false;

    void fetchItineraryState(
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
      cancelled =
        true;
    };
  }, [tripId]);

  const selectedDay =
    useMemo(() => {
      if (
        state.status !==
        'success'
      ) {
        return null;
      }

      return (
        state.itinerary.days.find(
          (day) =>
            day.id ===
            selectedDayId,
        ) ??
        state.itinerary
          .days[0] ??
        null
      );
    }, [
      selectedDayId,
      state,
    ]);

  const orderedActivities =
    useMemo(() => {
      if (!selectedDay) {
        return [];
      }

      return [
        ...selectedDay.activities,
      ].sort(
        compareByPosition,
      );
    }, [selectedDay]);

  const totalActivities =
    useMemo(() => {
      if (
        state.status !==
        'success'
      ) {
        return 0;
      }

      return state.itinerary.days.reduce(
        (
          total,
          day,
        ) =>
          total +
          day.activities.length,
        0,
      );
    }, [state]);

  function openCreate(
    day: TripDay,
  ) {
    setActivityDialog({
      mode: 'create',
      day,
    });

    setForm(
      EMPTY_FORM,
    );

    setFormError(null);
  }

  function openEdit(
    day: TripDay,
    activity: Activity,
  ) {
    setActivityDialog({
      mode: 'edit',
      day,
      activity,
    });

    setForm(
      activityToForm(
        activity,
      ),
    );

    setFormError(null);
  }

  function closeActivityDialog() {
    if (submitting) {
      return;
    }

    setActivityDialog(null);
    setFormError(null);
  }

  async function submitActivity() {
    if (!activityDialog) {
      return;
    }

    const title =
      form.title.trim();

    if (!title) {
      setFormError(
        'Title is required.',
      );
      return;
    }

    if (
      form.startTime &&
      form.endTime &&
      form.endTime <
        form.startTime
    ) {
      setFormError(
        'End time cannot be earlier than start time.',
      );
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setReorderError(null);

    const basePayload = {
      title,
      category:
        form.category,
      description:
        optionalText(
          form.description,
        ),
      startTime:
        form.startTime ||
        undefined,
      endTime:
        form.endTime ||
        undefined,
      location:
        optionalText(
          form.location,
        ),
      notes:
        optionalText(
          form.notes,
        ),
    };

    try {
      const url =
        activityDialog.mode ===
        'create'
          ? `/api/trips/${encodeURIComponent(tripId)}/itinerary/days/${encodeURIComponent(activityDialog.day.id)}/activities`
          : `/api/trips/${encodeURIComponent(tripId)}/itinerary/days/${encodeURIComponent(activityDialog.day.id)}/activities/${encodeURIComponent(activityDialog.activity.id)}`;

      const method =
        activityDialog.mode ===
        'create'
          ? 'POST'
          : 'PATCH';

      const payload:
        | CreateActivityInput
        | UpdateActivityInput =
        basePayload;

      const response =
        await fetch(url, {
          method,
          headers: {
            'content-type':
              'application/json',
          },
          body: JSON.stringify(
            payload,
          ),
        });

      const responsePayload =
        (await response.json()) as unknown;

      if (!response.ok) {
        setFormError(
          getErrorMessage(
            responsePayload,
          ),
        );

        return;
      }

      const currentDayId =
        activityDialog.day.id;

      const sortError =
        await sortDayChronologically(
          currentDayId,
        );

      if (sortError) {
        setReorderError(
          `Activity saved, but automatic chronological ordering failed: ${sortError}`,
        );
      }

      setSelectedDayId(
        currentDayId,
      );

      setActivityDialog(
        null,
      );

      setFormError(null);
    } catch {
      setFormError(
        'Activity service is currently unavailable.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      const response =
        await fetch(
          `/api/trips/${encodeURIComponent(tripId)}/itinerary/days/${encodeURIComponent(deleteTarget.day.id)}/activities/${encodeURIComponent(deleteTarget.activity.id)}`,
          {
            method: 'DELETE',
          },
        );

      if (!response.ok) {
        let payload:
          unknown = null;

        try {
          payload =
            (await response.json()) as unknown;
        } catch {
          payload = null;
        }

        setDeleteError(
          getErrorMessage(
            payload,
          ),
        );

        return;
      }

      const currentDayId =
        deleteTarget.day.id;

      await reloadItinerary();

      setSelectedDayId(
        currentDayId,
      );

      setDeleteTarget(null);
      setDeleteError(null);
    } catch {
      setDeleteError(
        'Activity service is currently unavailable.',
      );
    } finally {
      setDeleting(false);
    }
  }

  async function moveActivity(
    activityId: string,
    direction:
      | 'up'
      | 'down',
  ) {
    if (
      !selectedDay ||
      reordering
    ) {
      return;
    }

    const currentOrder =
      [...orderedActivities];

    const currentIndex =
      currentOrder.findIndex(
        (activity) =>
          activity.id ===
          activityId,
      );

    if (currentIndex < 0) {
      return;
    }

    const targetIndex =
      direction === 'up'
        ? currentIndex - 1
        : currentIndex + 1;

    if (
      targetIndex < 0 ||
      targetIndex >=
        currentOrder.length
    ) {
      return;
    }

    const currentActivity =
      currentOrder[currentIndex];

    const targetActivity =
      currentOrder[targetIndex];

    if (
      !currentActivity ||
      !targetActivity
    ) {
      return;
    }

    currentOrder[
      currentIndex
    ] = targetActivity;

    currentOrder[
      targetIndex
    ] = currentActivity;

    setReordering(true);
    setReorderError(null);

    try {
      const error =
        await persistActivityOrder(
          selectedDay.id,
          currentOrder.map(
            (activity) =>
              activity.id,
          ),
        );

      if (error) {
        setReorderError(
          error,
        );

        return;
      }

      await reloadItinerary();

      setSelectedDayId(
        selectedDay.id,
      );
    } finally {
      setReordering(false);
    }
  }

  async function handleSortByTime() {
    if (
      !selectedDay ||
      reordering
    ) {
      return;
    }

    setReordering(true);
    setReorderError(null);

    try {
      const chronologicalOrder =
        [...orderedActivities]
          .sort(
            compareChronologically,
          )
          .map(
            (activity) =>
              activity.id,
          );

      const currentOrder =
        orderedActivities.map(
          (activity) =>
            activity.id,
        );

      if (
        arraysEqual(
          chronologicalOrder,
          currentOrder,
        )
      ) {
        return;
      }

      const error =
        await persistActivityOrder(
          selectedDay.id,
          chronologicalOrder,
        );

      if (error) {
        setReorderError(
          error,
        );

        return;
      }

      await reloadItinerary();

      setSelectedDayId(
        selectedDay.id,
      );
    } finally {
      setReordering(false);
    }
  }

  function retry() {
    setState({
      status: 'loading',
    });

    void fetchItineraryState(
      tripId,
    ).then(
      setState,
    );
  }

  if (
    state.status ===
    'loading'
  ) {
    return (
      <LoadingState />
    );
  }

  if (
    state.status ===
    'error'
  ) {
    return (
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] px-6 py-12 text-center">
        <div className="text-sm font-medium text-white/75">
          We couldn&apos;t load
          your itinerary.
        </div>

        <p className="mt-2 text-sm text-white/40">
          {state.message}
        </p>

        <button
          type="button"
          onClick={retry}
          className="mt-5 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.1]"
        >
          Try again
        </button>
      </div>
    );
  }

  const {
    itinerary,
  } = state;

  if (
    itinerary.days.length ===
    0
  ) {
    return null;
  }

  if (!selectedDay) {
    return null;
  }

  return (
    <>
      <section className="min-w-0 space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
              Journey timeline
            </div>

            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white md:text-3xl">
              Your itinerary
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
              Shape each day while mapped activities stay connected to the places around them.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/40">
              {itinerary.days.length}{' '}
              days
            </span>

            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/40">
              {totalActivities}{' '}
              activities
            </span>

            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/45">
              <span
                className={[
                  'h-1.5 w-1.5 rounded-full',
                  realtimeStatus === 'connected'
                    ? 'bg-emerald-400'
                    : realtimeStatus === 'connecting'
                      ? 'animate-pulse bg-amber-300'
                      : 'bg-white/25',
                ].join(' ')}
              />

              {realtimeStatus === 'connected'
                ? `${onlineUsers} online`
                : realtimeStatus === 'connecting'
                  ? 'Connecting live'
                  : 'Live offline'}
            </span>

            {canEdit && (
              <button
                type="button"
                onClick={() =>
                  openCreate(
                    selectedDay,
                  )
                }
                disabled={reordering}
                className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                + Add activity
              </button>
            )}
          </div>
        </div>

        <div className="-mx-1 overflow-x-auto px-1 pb-2">
          <div className="flex min-w-max gap-2.5">
            {itinerary.days.map(
              (day) => (
                <DayButton
                  key={day.id}
                  day={day}
                  active={
                    selectedDay.id ===
                    day.id
                  }
                  onSelect={() => {
                    if (
                      !reordering
                    ) {
                      setSelectedDayId(
                        day.id,
                      );

                      setReorderError(
                        null,
                      );
                    }
                  }}
                />
              ),
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0d0f13]/80 shadow-[0_30px_80px_rgba(0,0,0,0.2)]">
          <div className="border-b border-white/[0.07] bg-white/[0.025] px-5 py-5 md:px-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
                  Day{' '}
                  {
                    selectedDay.dayNumber
                  }
                </div>

                <h3 className="mt-1.5 text-xl font-semibold tracking-[-0.02em] text-white md:text-2xl">
                  {formatDayLong(
                    selectedDay.date,
                  )}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-white/40">
                  {
                    selectedDay
                      .activities
                      .length
                  }{' '}
                  {selectedDay.activities
                    .length === 1
                    ? 'planned activity'
                    : 'planned activities'}
                </span>

                {canEdit &&
                  orderedActivities.length >
                    1 && (
                  <button
                    type="button"
                    onClick={() => {
                      void handleSortByTime();
                    }}
                    disabled={
                      reordering
                    }
                    className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/50 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-wait disabled:opacity-40"
                  >
                    {reordering
                      ? 'Ordering...'
                      : 'Sort by time'}
                  </button>
                )}
              </div>
            </div>

            {reorderError && (
              <div className="mt-4 rounded-xl border border-rose-300/10 bg-rose-300/[0.04] px-4 py-3 text-sm text-rose-200/80">
                {reorderError}
              </div>
            )}
          </div>

          <div className="min-w-0 px-3 py-6 sm:px-4 md:px-7 md:py-8">
            {orderedActivities.length >
            0 ? (
              <div>
                {orderedActivities.map(
                  (
                    activity,
                    index,
                  ) => (
                    <ActivityCard
                      key={
                        activity.id
                      }
                      activity={
                        activity
                      }
                      isFirst={
                        index === 0
                      }
                      isLast={
                        index ===
                        orderedActivities
                          .length -
                          1
                      }
                      canEdit={
                        canEdit
                      }
                      reordering={
                        reordering
                      }
                      onMoveUp={() => {
                        void moveActivity(
                          activity.id,
                          'up',
                        );
                      }}
                      onMoveDown={() => {
                        void moveActivity(
                          activity.id,
                          'down',
                        );
                      }}
                      onEdit={() =>
                        openEdit(
                          selectedDay,
                          activity,
                        )
                      }
                      onDelete={() => {
                        setDeleteTarget({
                          day:
                            selectedDay,
                          activity,
                        });

                        setDeleteError(
                          null,
                        );
                      }}
                      selected={
                        activity.placeId !==
                          null &&
                        activity.placeId ===
                          selectedPlaceId
                      }
                      onSelectPlace={
                        activity.placeId &&
                        onSelectPlace
                          ? () => {
                              onSelectPlace(
                                activity.placeId as string,
                              );
                            }
                          : undefined
                      }
                    />
                  ),
                )}
              </div>
            ) : (
              <EmptyDay
                canEdit={canEdit}
                onAdd={() =>
                  openCreate(
                    selectedDay,
                  )
                }
              />
            )}
          </div>
        </div>
      </section>

      {canEdit && activityDialog && (
        <ActivityDialog
          dialog={
            activityDialog
          }
          form={form}
          error={formError}
          submitting={
            submitting
          }
          onChange={setForm}
          onClose={
            closeActivityDialog
          }
          onSubmit={() => {
            void submitActivity();
          }}
        />
      )}

      {canEdit && deleteTarget && (
        <DeleteDialog
          activity={
            deleteTarget.activity
          }
          deleting={deleting}
          error={deleteError}
          onCancel={() => {
            if (!deleting) {
              setDeleteTarget(
                null,
              );

              setDeleteError(
                null,
              );
            }
          }}
          onConfirm={() => {
            void confirmDelete();
          }}
        />
      )}
    </>
  );
}
