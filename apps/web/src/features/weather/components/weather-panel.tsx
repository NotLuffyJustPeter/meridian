'use client';

import {
  CalendarDays,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  MapPin,
  RefreshCw,
  Snowflake,
  Sun,
  Sunrise,
  Sunset,
  ThermometerSun,
  Wind,
} from 'lucide-react';
import type {
  ReactNode,
} from 'react';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  TripWeather,
  WeatherCondition,
  WeatherDay,
} from '../types/weather.types';

type WeatherState =
  | {
      status: 'loading';
      data: null;
      error: null;
    }
  | {
      status: 'success';
      data: TripWeather;
      error: null;
    }
  | {
      status: 'error';
      data: null;
      error: string;
    };

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

function readErrorMessage(
  payload: unknown,
): string {
  if (!isRecord(payload)) {
    return 'Unable to load weather right now.';
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

  return 'Unable to load weather right now.';
}

function readWeather(
  payload: unknown,
): TripWeather | null {
  if (
    isRecord(payload) &&
    typeof payload.tripId ===
      'string' &&
    Array.isArray(
      payload.days,
    )
  ) {
    return payload as unknown as TripWeather;
  }

  if (
    isRecord(payload) &&
    isRecord(payload.data) &&
    typeof payload.data
      .tripId === 'string' &&
    Array.isArray(
      payload.data.days,
    )
  ) {
    return payload.data as unknown as TripWeather;
  }

  return null;
}

async function fetchWeatherState(
  tripId: string,
): Promise<WeatherState> {
  try {
    const response =
      await fetch(
        `/api/trips/${encodeURIComponent(
          tripId,
        )}/weather`,
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
        data: null,
        error:
          readErrorMessage(
            payload,
          ),
      };
    }

    const data =
      readWeather(
        payload,
      );

    if (!data) {
      return {
        status: 'error',
        data: null,
        error:
          'Meridian received an unexpected weather response.',
      };
    }

    return {
      status: 'success',
      data,
      error: null,
    };
  } catch {
    return {
      status: 'error',
      data: null,
      error:
        'Weather service is currently unavailable.',
    };
  }
}

function formatDate(
  value: string,
): string {
  return new Intl.DateTimeFormat(
    'en-US',
    {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    },
  ).format(
    new Date(
      `${value}T00:00:00.000Z`,
    ),
  );
}

function formatCompactDate(
  value: string,
): string {
  return new Intl.DateTimeFormat(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    },
  ).format(
    new Date(
      `${value}T00:00:00.000Z`,
    ),
  );
}

function formatTemperature(
  value: number | null,
): string {
  if (value === null) {
    return '—';
  }

  return `${Math.round(
    value,
  )}°`;
}

function formatMetric(
  value: number | null,
  unit: string,
): string {
  if (value === null) {
    return '—';
  }

  return `${Math.round(
    value,
  )}${unit}`;
}

function formatTime(
  value: string | null,
): string {
  if (!value) {
    return '—';
  }

  const parts =
    value.split('T');

  const time =
    parts[1];

  return time
    ? time.slice(
        0,
        5,
      )
    : value;
}

function conditionLabel(
  condition:
    | WeatherCondition
    | null,
): string {
  switch (condition) {
    case 'CLEAR':
      return 'Clear';

    case 'MOSTLY_CLEAR':
      return 'Mostly clear';

    case 'PARTLY_CLOUDY':
      return 'Partly cloudy';

    case 'CLOUDY':
      return 'Cloudy';

    case 'FOG':
      return 'Fog';

    case 'DRIZZLE':
      return 'Drizzle';

    case 'RAIN':
      return 'Rain';

    case 'SNOW':
      return 'Snow';

    case 'SHOWERS':
      return 'Showers';

    case 'THUNDERSTORM':
      return 'Thunderstorm';

    case 'UNKNOWN':
    case null:
      return 'Forecast';
  }
}

function ConditionIcon({
  condition,
  className =
    'h-5 w-5',
}: {
  condition:
    | WeatherCondition
    | null;
  className?: string;
}) {
  switch (condition) {
    case 'CLEAR':
      return (
        <Sun
          className={
            className
          }
        />
      );

    case 'MOSTLY_CLEAR':
    case 'PARTLY_CLOUDY':
      return (
        <CloudSun
          className={
            className
          }
        />
      );

    case 'FOG':
      return (
        <CloudFog
          className={
            className
          }
        />
      );

    case 'DRIZZLE':
    case 'RAIN':
    case 'SHOWERS':
      return (
        <CloudRain
          className={
            className
          }
        />
      );

    case 'SNOW':
      return (
        <Snowflake
          className={
            className
          }
        />
      );

    case 'THUNDERSTORM':
      return (
        <CloudLightning
          className={
            className
          }
        />
      );

    case 'CLOUDY':
    case 'UNKNOWN':
    case null:
      return (
        <Cloud
          className={
            className
          }
        />
      );
  }
}

function availabilityCopy(
  weather: TripWeather,
): {
  label: string;
  detail: string;
} {
  switch (
    weather.availability
  ) {
    case 'AVAILABLE':
      return {
        label:
          'Forecast available',
        detail:
          'Weather coverage is available across your current journey window.',
      };

    case 'PARTIAL':
      return {
        label:
          'Partial forecast',
        detail:
          'Some trip days are still outside the current forecast window.',
      };

    case 'OUT_OF_RANGE':
      return {
        label:
          'Forecast coming soon',
        detail:
          'This journey is outside the live forecast horizon. Meridian will have weather closer to departure.',
      };

    case 'LOCATION_NOT_FOUND':
      return {
        label:
          'Location unavailable',
        detail:
          'Meridian could not resolve this destination to a forecast location yet.',
      };
  }
}

function WeatherSkeleton() {
  return (
    <div className="py-9">
      <div className="h-5 w-40 animate-pulse rounded-full bg-white/[0.05]" />

      <div className="mt-6 h-64 animate-pulse rounded-[2rem] border border-white/[0.07] bg-white/[0.025]" />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map(
          (item) => (
            <div
              key={item}
              className="h-44 animate-pulse rounded-[1.5rem] border border-white/[0.07] bg-white/[0.025]"
            />
          ),
        )}
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="py-9">
      <div className="rounded-[1.75rem] border border-rose-300/10 bg-rose-300/[0.04] p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-200">
          Weather unavailable
        </p>

        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
          {message}
        </p>

        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.09]"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-4">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}

        <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">
          {label}
        </span>
      </div>

      <p className="mt-3 text-sm font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

function DayCard({
  day,
}: {
  day: WeatherDay;
}) {
  if (!day.available) {
    return (
      <article className="rounded-[1.5rem] border border-white/[0.06] bg-white/[0.02] p-5">
        <p className="text-xs font-semibold text-slate-300">
          {formatDate(
            day.date,
          )}
        </p>

        <div className="mt-8 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-slate-600">
          <CalendarDays className="h-5 w-5" />
        </div>

        <p className="mt-4 text-sm font-medium text-slate-500">
          Forecast not available yet
        </p>
      </article>
    );
  }

  return (
    <article className="group rounded-[1.5rem] border border-white/[0.07] bg-white/[0.025] p-5 transition hover:border-white/[0.13] hover:bg-white/[0.04]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-300">
            {formatDate(
              day.date,
            )}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            {conditionLabel(
              day.condition,
            )}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-300/10 bg-sky-300/[0.055] text-sky-200">
          <ConditionIcon
            condition={
              day.condition
            }
          />
        </div>
      </div>

      <div className="mt-7 flex items-end gap-2">
        <span className="text-3xl font-semibold tracking-[-0.055em] text-white">
          {formatTemperature(
            day.temperatureMaxC,
          )}
        </span>

        <span className="pb-1 text-sm text-slate-500">
          /{' '}
          {formatTemperature(
            day.temperatureMinC,
          )}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Droplets className="h-3.5 w-3.5 text-sky-300/70" />
          {formatMetric(
            day.precipitationProbabilityMax,
            '%',
          )}
        </div>

        <div className="flex items-center gap-2">
          <Wind className="h-3.5 w-3.5 text-slate-400" />
          {formatMetric(
            day.windSpeedMaxKmh,
            ' km/h',
          )}
        </div>
      </div>
    </article>
  );
}

function HeroForecast({
  weather,
  day,
}: {
  weather: TripWeather;
  day: WeatherDay | null;
}) {
  const availability =
    availabilityCopy(
      weather,
    );

  if (!day) {
    return (
      <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[linear-gradient(135deg,#0b2534_0%,#102b3a_50%,#09131e_100%)] p-7 sm:p-9">
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full border border-sky-300/10 bg-sky-300/[0.035]" />

        <div className="relative max-w-2xl">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-sky-200">
            <CalendarDays className="h-5 w-5" />
          </div>

          <p className="mt-7 text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
            {availability.label}
          </p>

          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
            Weather will appear closer to departure.
          </h2>

          <p className="mt-4 max-w-xl text-sm leading-7 text-sky-50/50">
            {availability.detail}
          </p>

          <div className="mt-7 inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/10 px-4 py-3 text-xs text-slate-400">
            <CalendarDays className="h-4 w-4 text-sky-200/70" />

            {formatCompactDate(
              weather.forecastWindow
                .requestedStartDate,
            )}
            {' — '}
            {formatCompactDate(
              weather.forecastWindow
                .requestedEndDate,
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[linear-gradient(135deg,#0c2938_0%,#123748_52%,#0a1721_100%)] p-7 sm:p-9">
      <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full border border-sky-200/10 bg-sky-300/[0.045]" />
      <div className="pointer-events-none absolute -bottom-36 left-[34%] h-60 w-60 rounded-full border border-white/[0.05] bg-white/[0.02]" />

      <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.55fr)] xl:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex rounded-full border border-emerald-300/15 bg-emerald-300/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
              {availability.label}
            </span>

            <span className="inline-flex items-center gap-2 text-xs text-sky-100/50">
              <MapPin className="h-3.5 w-3.5" />

              {weather.location
                ? `${weather.location.name}${
                    weather.location.country
                      ? `, ${weather.location.country}`
                      : ''
                  }`
                : weather.destination}
            </span>
          </div>

          <div className="mt-10 flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] text-sky-100">
              <ConditionIcon
                condition={
                  day.condition
                }
                className="h-8 w-8"
              />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200/60">
                {formatDate(
                  day.date,
                )}
              </p>

              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.045em] text-white sm:text-3xl">
                {conditionLabel(
                  day.condition,
                )}
              </h2>
            </div>
          </div>

          <div className="mt-8 flex items-end gap-3">
            <span className="text-6xl font-semibold tracking-[-0.08em] text-white">
              {formatTemperature(
                day.temperatureMaxC,
              )}
            </span>

            <span className="pb-2 text-base text-sky-100/45">
              High ·{' '}
              {formatTemperature(
                day.temperatureMinC,
              )}{' '}
              low
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Metric
            icon={
              <Droplets className="h-4 w-4 text-sky-300/70" />
            }
            label="Rain chance"
            value={formatMetric(
              day.precipitationProbabilityMax,
              '%',
            )}
          />

          <Metric
            icon={
              <Wind className="h-4 w-4 text-slate-400" />
            }
            label="Max wind"
            value={formatMetric(
              day.windSpeedMaxKmh,
              ' km/h',
            )}
          />

          <Metric
            icon={
              <Sunrise className="h-4 w-4 text-amber-200/70" />
            }
            label="Sunrise"
            value={formatTime(
              day.sunrise,
            )}
          />

          <Metric
            icon={
              <Sunset className="h-4 w-4 text-orange-200/70" />
            }
            label="Sunset"
            value={formatTime(
              day.sunset,
            )}
          />
        </div>
      </div>
    </section>
  );
}

function useWeather(
  tripId: string,
) {
  const [
    state,
    setState,
  ] =
    useState<WeatherState>({
      status: 'loading',
      data: null,
      error: null,
    });

  const [
    refreshKey,
    setRefreshKey,
  ] =
    useState(0);

  useEffect(() => {
    let cancelled = false;

    void fetchWeatherState(
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
  }, [
    tripId,
    refreshKey,
  ]);

  const refresh = () => {
    setState({
      status: 'loading',
      data: null,
      error: null,
    });

    setRefreshKey(
      (value) =>
        value + 1,
    );
  };

  return {
    state,
    refresh,
  };
}

export function WeatherPanel({
  tripId,
}: {
  tripId: string;
}) {
  const {
    state,
    refresh,
  } =
    useWeather(
      tripId,
    );

  const availableDays =
    useMemo(
      () =>
        state.status ===
        'success'
          ? state.data.days.filter(
              (day) =>
                day.available,
            )
          : [],
      [state],
    );

  if (
    state.status ===
    'loading'
  ) {
    return <WeatherSkeleton />;
  }

  if (
    state.status ===
    'error'
  ) {
    return (
      <ErrorState
        message={
          state.error
        }
        onRetry={
          refresh
        }
      />
    );
  }

  const weather =
    state.data;

  const heroDay =
    availableDays[0] ??
    null;

  return (
    <div className="py-9">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
            Weather
          </p>

          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
            Conditions along your journey
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Meridian uses your destination and trip timezone to line up daily forecast context with the days you are actually traveling.
          </p>
        </div>

        <button
          type="button"
          onClick={
            refresh
          }
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.07] sm:w-auto"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="mt-7">
        <HeroForecast
          weather={
            weather
          }
          day={
            heroDay
          }
        />
      </div>

      {weather.days.length >
        0 && (
        <>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Daily outlook
              </p>

              <p className="mt-2 text-sm font-medium text-white">
                Your travel window
              </p>
            </div>

            <p className="text-xs text-slate-600">
              Provider · Open-Meteo
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {weather.days.map(
              (day) => (
                <DayCard
                  key={
                    day.date
                  }
                  day={
                    day
                  }
                />
              ),
            )}
          </div>
        </>
      )}

      {heroDay && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Metric
            icon={
              <ThermometerSun className="h-4 w-4 text-sky-300/70" />
            }
            label="Temperature"
            value={`${formatTemperature(
              heroDay.temperatureMaxC,
            )} / ${formatTemperature(
              heroDay.temperatureMinC,
            )}`}
          />

          <Metric
            icon={
              <Droplets className="h-4 w-4 text-sky-300/70" />
            }
            label="Precipitation"
            value={formatMetric(
              heroDay.precipitationMm,
              ' mm',
            )}
          />

          <Metric
            icon={
              <CalendarDays className="h-4 w-4 text-slate-400" />
            }
            label="Timezone"
            value={
              weather.timezone
            }
          />
        </div>
      )}
    </div>
  );
}

export function WeatherJourneyStrip({
  tripId,
}: {
  tripId: string;
}) {
  const {
    state,
    refresh,
  } =
    useWeather(
      tripId,
    );

  if (
    state.status ===
    'loading'
  ) {
    return (
      <div className="h-28 animate-pulse rounded-[1.5rem] border border-white/[0.07] bg-white/[0.025]" />
    );
  }

  if (
    state.status ===
    'error'
  ) {
    return (
      <div className="flex flex-col gap-4 rounded-[1.5rem] border border-white/[0.07] bg-white/[0.025] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.17em] text-slate-500">
            Journey weather
          </p>

          <p className="mt-2 text-sm text-slate-400">
            Weather context is unavailable right now.
          </p>
        </div>

        <button
          type="button"
          onClick={
            refresh
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    );
  }

  const weather =
    state.data;

  const previewDays =
    weather.days.slice(
      0,
      5,
    );

  const firstAvailable =
    previewDays.find(
      (day) =>
        day.available,
    );

  if (!firstAvailable) {
    return (
      <div className="rounded-[1.5rem] border border-sky-300/10 bg-sky-300/[0.035] p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-300/10 bg-sky-300/[0.05] text-sky-200">
            <CalendarDays className="h-5 w-5" />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.17em] text-sky-200/75">
              Journey weather
            </p>

            <p className="mt-2 text-sm font-medium text-white">
              Forecast available closer to departure
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Meridian will line up live conditions with your itinerary once these dates enter the forecast window.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-white/[0.07] bg-white/[0.025]">
      <div className="flex flex-col gap-3 border-b border-white/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">
            Journey weather
          </p>

          <p className="mt-1 text-sm font-medium text-white">
            Conditions beside your itinerary
          </p>
        </div>

        <div className="inline-flex items-center gap-2 text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5" />

          {weather.location
            ? weather.location.name
            : weather.destination}
        </div>
      </div>

      <div className="grid divide-y divide-white/[0.06] sm:grid-cols-5 sm:divide-x sm:divide-y-0">
        {previewDays.map(
          (day) => (
            <div
              key={
                day.date
              }
              className="flex items-center justify-between gap-4 p-4 sm:block"
            >
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                  {formatCompactDate(
                    day.date,
                  )}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {day.available
                    ? conditionLabel(
                        day.condition,
                      )
                    : 'Pending'}
                </p>
              </div>

              <div className="flex items-center gap-3 sm:mt-4">
                <div
                  className={
                    day.available
                      ? 'text-sky-200'
                      : 'text-slate-700'
                  }
                >
                  <ConditionIcon
                    condition={
                      day.condition
                    }
                    className="h-5 w-5"
                  />
                </div>

                <p className="text-sm font-semibold text-white">
                  {day.available
                    ? formatTemperature(
                        day.temperatureMaxC,
                      )
                    : '—'}
                </p>
              </div>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
