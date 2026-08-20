'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  Activity,
  ActivityCategory,
  Itinerary,
  TripDay,
} from '../types/itinerary.types';

interface ItineraryTimelineProps {
  tripId: string;
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

function getErrorMessage(
  payload: unknown,
): string {
  if (
    typeof payload !== 'object' ||
    payload === null
  ) {
    return 'Unable to load itinerary.';
  }

  const record =
    payload as Record<
      string,
      unknown
    >;

  const message =
    record['message'];

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

  return 'Unable to load itinerary.';
}

function isItinerary(
  value: unknown,
): value is Itinerary {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  const record =
    value as Record<
      string,
      unknown
    >;

  return (
    typeof record['tripId'] ===
      'string' &&
    typeof record['timezone'] ===
      'string' &&
    Array.isArray(
      record['days'],
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

function ActivityCard({
  activity,
  isLast,
}: {
  activity: Activity;
  isLast: boolean;
}) {
  const category =
    CATEGORY_META[
      activity.category
    ];

  return (
    <div className="relative grid grid-cols-[82px_24px_minmax(0,1fr)] gap-3 md:grid-cols-[110px_32px_minmax(0,1fr)] md:gap-5">
      <div className="pt-1 text-right">
        <div className="font-mono text-xs font-medium text-white/75 md:text-sm">
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

      <article className="mb-7 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 transition hover:border-white/[0.14] hover:bg-white/[0.05] md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-base font-semibold tracking-[-0.01em] text-white md:text-lg">
              {activity.title}
            </h4>

            {activity.location && (
              <p className="mt-1 text-sm text-white/45">
                {activity.location}
              </p>
            )}
          </div>

          <span
            className={[
              'rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em]',
              category.badgeClassName,
            ].join(' ')}
          >
            {category.label}
          </span>
        </div>

        {activity.description && (
          <p className="mt-4 max-w-3xl text-sm leading-6 text-white/55">
            {activity.description}
          </p>
        )}

        {activity.notes && (
          <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/15 px-3.5 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">
              Notes
            </div>

            <p className="mt-1.5 text-sm leading-5 text-white/50">
              {activity.notes}
            </p>
          </div>
        )}
      </article>
    </div>
  );
}

function EmptyDay() {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-lg text-white/50">
        +
      </div>

      <h4 className="mt-4 text-base font-medium text-white/80">
        Nothing planned yet
      </h4>

      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/40">
        This day is still open.
        Activities you add later
        will appear here in order.
      </p>
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

export function ItineraryTimeline({
  tripId,
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
    return (
      <EmptyDay />
    );
  }

  if (!selectedDay) {
    return null;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
            Journey timeline
          </div>

          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white md:text-3xl">
            Your itinerary
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
            Explore each day of
            the journey and keep
            every activity in one
            clear timeline.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/40">
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
            {itinerary.days.length}{' '}
            days
          </span>

          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
            {totalActivities}{' '}
            activities
          </span>
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
                onSelect={() =>
                  setSelectedDayId(
                    day.id,
                  )
                }
              />
            ),
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0d0f13]/80 shadow-[0_30px_80px_rgba(0,0,0,0.2)]">
        <div className="border-b border-white/[0.07] bg-white/[0.025] px-5 py-5 md:px-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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

            <div className="text-sm text-white/40">
              {
                selectedDay
                  .activities
                  .length
              }{' '}
              {selectedDay.activities
                .length === 1
                ? 'planned activity'
                : 'planned activities'}
            </div>
          </div>
        </div>

        <div className="px-4 py-7 md:px-7 md:py-8">
          {selectedDay
            .activities.length >
          0 ? (
            <div>
              {selectedDay.activities.map(
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
                    isLast={
                      index ===
                      selectedDay
                        .activities
                        .length -
                        1
                    }
                  />
                ),
              )}
            </div>
          ) : (
            <EmptyDay />
          )}
        </div>
      </div>
    </section>
  );
}