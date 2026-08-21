'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useState,
} from 'react';
import {
  useForm,
} from 'react-hook-form';
import {
  z,
} from 'zod';

import type {
  Trip,
} from '../types/trip.types';

const TIMEZONES = [
  {
    value: 'America/Mexico_City',
    label: 'Mexico City',
  },
  {
    value: 'America/Cancun',
    label: 'Cancún',
  },
  {
    value: 'America/Tijuana',
    label: 'Tijuana',
  },
  {
    value: 'America/New_York',
    label: 'New York',
  },
  {
    value: 'America/Los_Angeles',
    label: 'Los Angeles',
  },
  {
    value: 'America/Chicago',
    label: 'Chicago',
  },
  {
    value: 'America/Toronto',
    label: 'Toronto',
  },
  {
    value: 'America/Sao_Paulo',
    label: 'São Paulo',
  },
  {
    value: 'Europe/London',
    label: 'London',
  },
  {
    value: 'Europe/Paris',
    label: 'Paris',
  },
  {
    value: 'Europe/Madrid',
    label: 'Madrid',
  },
  {
    value: 'Europe/Rome',
    label: 'Rome',
  },
  {
    value: 'Europe/Berlin',
    label: 'Berlin',
  },
  {
    value: 'Europe/Amsterdam',
    label: 'Amsterdam',
  },
  {
    value: 'Europe/Lisbon',
    label: 'Lisbon',
  },
  {
    value: 'Asia/Tokyo',
    label: 'Tokyo',
  },
  {
    value: 'Asia/Seoul',
    label: 'Seoul',
  },
  {
    value: 'Asia/Singapore',
    label: 'Singapore',
  },
  {
    value: 'Asia/Bangkok',
    label: 'Bangkok',
  },
  {
    value: 'Asia/Dubai',
    label: 'Dubai',
  },
  {
    value: 'Australia/Sydney',
    label: 'Sydney',
  },
] as const;

const CURRENCIES = [
  {
    value: 'MXN',
    label: 'MXN — Mexican Peso',
  },
  {
    value: 'USD',
    label: 'USD — US Dollar',
  },
  {
    value: 'EUR',
    label: 'EUR — Euro',
  },
  {
    value: 'GBP',
    label: 'GBP — British Pound',
  },
  {
    value: 'JPY',
    label: 'JPY — Japanese Yen',
  },
  {
    value: 'CAD',
    label: 'CAD — Canadian Dollar',
  },
  {
    value: 'AUD',
    label: 'AUD — Australian Dollar',
  },
  {
    value: 'CHF',
    label: 'CHF — Swiss Franc',
  },
  {
    value: 'KRW',
    label: 'KRW — South Korean Won',
  },
  {
    value: 'BRL',
    label: 'BRL — Brazilian Real',
  },
] as const;

const createTripSchema =
  z
    .object({
      name: z
        .string()
        .trim()
        .min(
          1,
          'Trip name is required.',
        )
        .max(
          120,
          'Trip name must be 120 characters or less.',
        ),

      destination: z
        .string()
        .trim()
        .min(
          1,
          'Destination is required.',
        )
        .max(
          160,
          'Destination must be 160 characters or less.',
        ),

      startDate: z
        .string()
        .min(
          1,
          'Start date is required.',
        ),

      endDate: z
        .string()
        .min(
          1,
          'End date is required.',
        ),

      timezone: z
        .string()
        .min(
          1,
          'Timezone is required.',
        ),

      currency: z
        .string()
        .regex(
          /^[A-Z]{3}$/,
          'Choose a valid currency.',
        ),
    })
    .refine(
      (values) => {
        if (
          !values.startDate ||
          !values.endDate
        ) {
          return true;
        }

        return (
          values.endDate >=
          values.startDate
        );
      },
      {
        message:
          'End date must be on or after the start date.',
        path: ['endDate'],
      },
    );

type CreateTripFormValues =
  z.infer<
    typeof createTripSchema
  >;

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

function readTrip(
  payload: unknown,
): Trip | null {
  if (
    isRecord(payload) &&
    typeof payload.id === 'string'
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

function readApiError(
  payload: unknown,
): string {
  if (!isRecord(payload)) {
    return 'Unable to create your trip.';
  }

  const { message } = payload;

  if (
    typeof message === 'string'
  ) {
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

  return 'Unable to create your trip.';
}

function toApiDate(
  value: string,
): string {
  return `${value}T00:00:00.000Z`;
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

function ArrowRightIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path
        d="M4 10h12M12 6l4 4-4 4"
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

function FieldError({
  message,
}: {
  message?: string;
}) {
  if (!message) {
    return null;
  }

  return (
    <p className="mt-2 text-xs leading-5 text-rose-300">
      {message}
    </p>
  );
}

export function CreateTripForm() {
  const router =
    useRouter();

  const [
    apiError,
    setApiError,
  ] = useState<
    string | null
  >(null);

  const {
    register,
    handleSubmit,
    formState: {
      errors,
      isSubmitting,
    },
  } =
    useForm<CreateTripFormValues>(
      {
        resolver:
          zodResolver(
            createTripSchema,
          ),
        defaultValues: {
          name: '',
          destination: '',
          startDate: '',
          endDate: '',
          timezone:
            'America/Mexico_City',
          currency: 'MXN',
        },
      },
    );

  const onSubmit =
    async (
      values:
        CreateTripFormValues,
    ) => {
      setApiError(null);

      try {
        const response =
          await fetch(
            '/api/trips',
            {
              method: 'POST',
              headers: {
                'content-type':
                  'application/json',
                accept:
                  'application/json',
              },
              body: JSON.stringify({
                name:
                  values.name.trim(),
                destination:
                  values.destination.trim(),
                startDate:
                  toApiDate(
                    values.startDate,
                  ),
                endDate:
                  toApiDate(
                    values.endDate,
                  ),
                timezone:
                  values.timezone,
                currency:
                  values.currency,
              }),
            },
          );

        const payload:
          unknown =
          await response.json();

        if (!response.ok) {
          setApiError(
            readApiError(
              payload,
            ),
          );

          return;
        }

        const trip =
          readTrip(payload);

        if (!trip) {
          setApiError(
            'Meridian created the trip but returned an unexpected response.',
          );

          return;
        }

        router.push(
          '/dashboard',
        );

        router.refresh();
      } catch {
        setApiError(
          'Trips service is currently unavailable.',
        );
      }
    };

  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_23rem]">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeftIcon />
          Back to dashboard
        </Link>

        <div className="mt-10">
          <div className="flex items-center gap-3">
            <span className="h-px w-7 bg-sky-300/50" />

            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">
              New journey
            </p>
          </div>

          <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-[-0.055em] text-white sm:text-5xl">
            Where are you going next?
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
            Start with the essentials.
            You&apos;ll add itinerary
            details, places, budgets and
            everything else inside the
            journey workspace.
          </p>
        </div>

        <form
          onSubmit={handleSubmit(
            onSubmit,
          )}
          className="mt-10"
        >
          <div className="rounded-[2rem] border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8">
            <div className="grid gap-7">
              <div>
                <label
                  htmlFor="name"
                  className="text-sm font-medium text-slate-200"
                >
                  Trip name
                </label>

                <p className="mt-1 text-xs text-slate-500">
                  Give this journey a
                  memorable name.
                </p>

                <input
                  id="name"
                  type="text"
                  autoComplete="off"
                  placeholder="Northern Italy Escape"
                  {...register(
                    'name',
                  )}
                  className="mt-3 w-full rounded-xl border border-white/[0.09] bg-[#09141f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-300/40 focus:ring-4 focus:ring-sky-300/[0.05]"
                />

                <FieldError
                  message={
                    errors.name
                      ?.message
                  }
                />
              </div>

              <div>
                <label
                  htmlFor="destination"
                  className="text-sm font-medium text-slate-200"
                >
                  Destination
                </label>

                <p className="mt-1 text-xs text-slate-500">
                  City, region or
                  country you&apos;re
                  planning around.
                </p>

                <input
                  id="destination"
                  type="text"
                  autoComplete="off"
                  placeholder="Milan, Lake Como & Venice"
                  {...register(
                    'destination',
                  )}
                  className="mt-3 w-full rounded-xl border border-white/[0.09] bg-[#09141f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-300/40 focus:ring-4 focus:ring-sky-300/[0.05]"
                />

                <FieldError
                  message={
                    errors
                      .destination
                      ?.message
                  }
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="startDate"
                    className="text-sm font-medium text-slate-200"
                  >
                    Departure
                  </label>

                  <input
                    id="startDate"
                    type="date"
                    {...register(
                      'startDate',
                    )}
                    className="mt-3 w-full rounded-xl border border-white/[0.09] bg-[#09141f] px-4 py-3 text-sm text-slate-300 outline-none transition scheme-dark focus:border-sky-300/40 focus:ring-4 focus:ring-sky-300/[0.05]"
                  />

                  <FieldError
                    message={
                      errors
                        .startDate
                        ?.message
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="endDate"
                    className="text-sm font-medium text-slate-200"
                  >
                    Return
                  </label>

                  <input
                    id="endDate"
                    type="date"
                    {...register(
                      'endDate',
                    )}
                    className="mt-3 w-full rounded-xl border border-white/[0.09] bg-[#09141f] px-4 py-3 text-sm text-slate-300 outline-none transition scheme-dark focus:border-sky-300/40 focus:ring-4 focus:ring-sky-300/[0.05]"
                  />

                  <FieldError
                    message={
                      errors
                        .endDate
                        ?.message
                    }
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="timezone"
                    className="text-sm font-medium text-slate-200"
                  >
                    Timezone
                  </label>

                  <select
                    id="timezone"
                    {...register(
                      'timezone',
                    )}
                    className="mt-3 w-full rounded-xl border border-white/[0.09] bg-[#09141f] px-4 py-3 text-sm text-slate-300 outline-none transition focus:border-sky-300/40 focus:ring-4 focus:ring-sky-300/[0.05]"
                  >
                    {TIMEZONES.map(
                      (
                        timezone,
                      ) => (
                        <option
                          key={
                            timezone.value
                          }
                          value={
                            timezone.value
                          }
                        >
                          {
                            timezone.label
                          }
                        </option>
                      ),
                    )}
                  </select>

                  <FieldError
                    message={
                      errors
                        .timezone
                        ?.message
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="currency"
                    className="text-sm font-medium text-slate-200"
                  >
                    Currency
                  </label>

                  <select
                    id="currency"
                    {...register(
                      'currency',
                    )}
                    className="mt-3 w-full rounded-xl border border-white/[0.09] bg-[#09141f] px-4 py-3 text-sm text-slate-300 outline-none transition focus:border-sky-300/40 focus:ring-4 focus:ring-sky-300/[0.05]"
                  >
                    {CURRENCIES.map(
                      (
                        currency,
                      ) => (
                        <option
                          key={
                            currency.value
                          }
                          value={
                            currency.value
                          }
                        >
                          {
                            currency.label
                          }
                        </option>
                      ),
                    )}
                  </select>

                  <FieldError
                    message={
                      errors
                        .currency
                        ?.message
                    }
                  />
                </div>
              </div>
            </div>

            {apiError && (
              <div
                role="alert"
                className="mt-7 rounded-xl border border-rose-300/10 bg-rose-300/[0.05] px-4 py-3"
              >
                <p className="text-sm leading-6 text-rose-200">
                  {apiError}
                </p>
              </div>
            )}

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-white/[0.07] pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-slate-500">
                You can change these
                details later.
              </p>

              <button
                type="submit"
                disabled={
                  isSubmitting
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {isSubmitting
                  ? 'Creating journey...'
                  : 'Create journey'}

                {!isSubmitting && (
                  <ArrowRightIcon />
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      <aside className="lg:pt-[13.4rem]">
        <div className="sticky top-8 overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-white/[0.025]">
          <div className="relative h-44 overflow-hidden bg-[linear-gradient(145deg,#12384b_0%,#0c2636_50%,#09131d_100%)]">
            <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full border border-sky-200/10 bg-sky-300/[0.05]" />

            <div className="absolute -bottom-24 -left-8 h-48 w-48 rounded-full border border-white/[0.05]" />

            <div className="absolute left-6 top-6 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/10 text-sky-200">
              <CompassIcon />
            </div>

            <p className="absolute bottom-6 left-6 text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/70">
              Meridian journey
            </p>
          </div>

          <div className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              What comes next
            </p>

            <div className="mt-5 space-y-5">
              <div className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sky-300/15 bg-sky-300/[0.06] text-[11px] font-semibold text-sky-200">
                  1
                </span>

                <div>
                  <p className="text-sm font-medium text-slate-200">
                    Build the itinerary
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Organize days and
                    activities.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-semibold text-slate-400">
                  2
                </span>

                <div>
                  <p className="text-sm font-medium text-slate-200">
                    Save places
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Keep restaurants,
                    landmarks and ideas
                    together.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-semibold text-slate-400">
                  3
                </span>

                <div>
                  <p className="text-sm font-medium text-slate-200">
                    Track the budget
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Understand the trip
                    before spending.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}