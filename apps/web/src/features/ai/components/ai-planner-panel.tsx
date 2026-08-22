'use client';

import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  CloudRain,
  DollarSign,
  Loader2,
  MapPin,
  RefreshCw,
  Send,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import {
  useMemo,
  useState,
} from 'react';

import type {
  Itinerary,
} from '../../itinerary/types/itinerary.types';
import type {
  AiBudgetPreference,
  AiInterest,
  AiPace,
  AiRecommendation,
  AiRecommendationsResponse,
  GenerateAiRecommendationsInput,
} from '../types/ai.types';

interface AiPlannerPanelProps {
  tripId: string;
  destination: string;
  currency: string;
  onOpenItinerary: () => void;
}

type GenerationState =
  | {
      status: 'idle';
      data: null;
      error: null;
    }
  | {
      status: 'loading';
      data: null;
      error: null;
    }
  | {
      status: 'success';
      data:
        AiRecommendationsResponse;
      error: null;
    }
  | {
      status: 'error';
      data: null;
      error: string;
    };

type ApplyState =
  | {
      status: 'idle';
      message: null;
    }
  | {
      status: 'applying';
      message: null;
    }
  | {
      status: 'success';
      message: string;
    }
  | {
      status: 'error';
      message: string;
    };


type PlaceCategory =
  | 'LANDMARK'
  | 'FOOD'
  | 'LODGING'
  | 'SHOPPING'
  | 'TRANSPORT'
  | 'ENTERTAINMENT'
  | 'NATURE'
  | 'OTHER';

interface ExistingPlace {
  id: string;
  name: string;
  sourceProvider:
    | string
    | null;
  sourcePlaceId:
    | string
    | null;
}

interface GeocodingResult {
  provider: string;
  providerPlaceId: string;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  website: string | null;
}

function readArrayPayload(
  payload: unknown,
): unknown[] | null {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (
    isRecord(payload) &&
    Array.isArray(
      payload.data,
    )
  ) {
    return payload.data;
  }

  return null;
}

function readPlaces(
  payload: unknown,
): ExistingPlace[] | null {
  const items =
    readArrayPayload(
      payload,
    );

  if (!items) {
    return null;
  }

  const places:
    ExistingPlace[] =
    [];

  for (
    const item
    of items
  ) {
    if (
      !isRecord(item) ||
      typeof item.id !==
        'string' ||
      typeof item.name !==
        'string'
    ) {
      continue;
    }

    places.push({
      id: item.id,
      name: item.name,
      sourceProvider:
        typeof item.sourceProvider ===
        'string'
          ? item.sourceProvider
          : null,
      sourcePlaceId:
        typeof item.sourcePlaceId ===
        'string'
          ? item.sourcePlaceId
          : null,
    });
  }

  return places;
}

function readCreatedResourceId(
  payload: unknown,
): string | null {
  if (
    isRecord(payload) &&
    typeof payload.id ===
      'string'
  ) {
    return payload.id;
  }

  if (
    isRecord(payload) &&
    isRecord(payload.data) &&
    typeof payload.data.id ===
      'string'
  ) {
    return payload.data.id;
  }

  return null;
}

function readGeocodingResults(
  payload: unknown,
): GeocodingResult[] | null {
  const container =
    isRecord(payload) &&
    isRecord(payload.data)
      ? payload.data
      : payload;

  if (
    !isRecord(container) ||
    !Array.isArray(
      container.results,
    )
  ) {
    return null;
  }

  const results:
    GeocodingResult[] =
    [];

  for (
    const item
    of container.results
  ) {
    if (
      !isRecord(item) ||
      typeof item.provider !==
        'string' ||
      typeof item.providerPlaceId !==
        'string' ||
      typeof item.name !==
        'string' ||
      typeof item.displayName !==
        'string' ||
      typeof item.latitude !==
        'number' ||
      typeof item.longitude !==
        'number'
    ) {
      continue;
    }

    results.push({
      provider:
        item.provider,
      providerPlaceId:
        item.providerPlaceId,
      name:
        item.name,
      displayName:
        item.displayName,
      latitude:
        item.latitude,
      longitude:
        item.longitude,
      website:
        typeof item.website ===
        'string'
          ? item.website
          : null,
    });
  }

  return results;
}

function toPlaceCategory(
  category:
    AiRecommendation['category'],
): PlaceCategory {
  switch (category) {
    case 'SIGHTSEEING':
      return 'LANDMARK';
    case 'FOOD':
      return 'FOOD';
    case 'TRANSPORT':
      return 'TRANSPORT';
    case 'LODGING':
      return 'LODGING';
    case 'SHOPPING':
      return 'SHOPPING';
    case 'ENTERTAINMENT':
      return 'ENTERTAINMENT';
    case 'OTHER':
      return 'OTHER';
  }
}

function normalizePlaceName(
  value: string,
): string {
  return value
    .trim()
    .toLocaleLowerCase();
}

const INTERESTS: Array<{
  value: AiInterest;
  label: string;
}> = [
  {
    value: 'CULTURE',
    label: 'Culture',
  },
  {
    value: 'FOOD',
    label: 'Food',
  },
  {
    value:
      'ARCHITECTURE',
    label: 'Architecture',
  },
  {
    value: 'HISTORY',
    label: 'History',
  },
  {
    value: 'NATURE',
    label: 'Nature',
  },
  {
    value: 'SHOPPING',
    label: 'Shopping',
  },
  {
    value: 'NIGHTLIFE',
    label: 'Nightlife',
  },
  {
    value:
      'LOCAL_EXPERIENCES',
    label:
      'Local experiences',
  },
];

const PACE_OPTIONS: Array<{
  value: AiPace;
  label: string;
  description: string;
}> = [
  {
    value: 'RELAXED',
    label: 'Relaxed',
    description:
      'More breathing room and fewer stops.',
  },
  {
    value: 'BALANCED',
    label: 'Balanced',
    description:
      'A comfortable mix of activity and flexibility.',
  },
  {
    value: 'FULL',
    label: 'Full',
    description:
      'Make the most of each travel day.',
  },
];

const BUDGET_OPTIONS: Array<{
  value:
    AiBudgetPreference;
  label: string;
}> = [
  {
    value: 'ECONOMY',
    label: 'Economy',
  },
  {
    value: 'BALANCED',
    label: 'Balanced',
  },
  {
    value: 'COMFORT',
    label: 'Comfort',
  },
];

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

function getErrorMessage(
  payload: unknown,
): string {
  if (!isRecord(payload)) {
    return 'Meridian AI could not complete this request.';
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

  return 'Meridian AI could not complete this request.';
}

function readAiResponse(
  payload: unknown,
): AiRecommendationsResponse | null {
  if (
    isRecord(payload) &&
    typeof payload.tripId ===
      'string' &&
    Array.isArray(
      payload.recommendations,
    )
  ) {
    return payload as unknown as
      AiRecommendationsResponse;
  }

  if (
    isRecord(payload) &&
    isRecord(payload.data) &&
    typeof payload.data.tripId ===
      'string' &&
    Array.isArray(
      payload.data
        .recommendations,
    )
  ) {
    return payload.data as unknown as
      AiRecommendationsResponse;
  }

  return null;
}

function readItinerary(
  payload: unknown,
): Itinerary | null {
  if (
    isRecord(payload) &&
    typeof payload.tripId ===
      'string' &&
    Array.isArray(
      payload.days,
    )
  ) {
    return payload as unknown as
      Itinerary;
  }

  if (
    isRecord(payload) &&
    isRecord(payload.data) &&
    typeof payload.data.tripId ===
      'string' &&
    Array.isArray(
      payload.data.days,
    )
  ) {
    return payload.data as unknown as
      Itinerary;
  }

  return null;
}

function formatDay(
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

function formatMoney(
  amount: string,
  currency: string,
): string {
  const numeric =
    Number(amount);

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return `${amount} ${currency}`;
  }

  try {
    return new Intl.NumberFormat(
      'en-US',
      {
        style: 'currency',
        currency,
        maximumFractionDigits:
          2,
      },
    ).format(
      numeric,
    );
  } catch {
    return `${numeric.toFixed(2)} ${currency}`;
  }
}

function timeRange(
  recommendation:
    AiRecommendation,
): string {
  const {
    suggestedStartTime,
    suggestedEndTime,
  } =
    recommendation;

  if (
    suggestedStartTime &&
    suggestedEndTime
  ) {
    return `${suggestedStartTime} — ${suggestedEndTime}`;
  }

  if (
    suggestedStartTime
  ) {
    return `From ${suggestedStartTime}`;
  }

  if (
    suggestedEndTime
  ) {
    return `Until ${suggestedEndTime}`;
  }

  return 'Flexible time';
}

function categoryLabel(
  category:
    AiRecommendation['category'],
): string {
  switch (category) {
    case 'SIGHTSEEING':
      return 'Sightseeing';
    case 'FOOD':
      return 'Food';
    case 'TRANSPORT':
      return 'Transport';
    case 'LODGING':
      return 'Lodging';
    case 'SHOPPING':
      return 'Shopping';
    case 'ENTERTAINMENT':
      return 'Entertainment';
    case 'OTHER':
      return 'Other';
  }
}

function SelectionMark({
  selected,
}: {
  selected: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={[
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition',
        selected
          ? 'border-sky-300/40 bg-sky-300 text-slate-950'
          : 'border-white/15 bg-white/[0.03] text-transparent',
      ].join(' ')}
    >
      <Check className="h-3.5 w-3.5" />
    </span>
  );
}

function RecommendationCard({
  recommendation,
  selected,
  applied,
  onToggle,
}: {
  recommendation:
    AiRecommendation;
  selected: boolean;
  applied: boolean;
  onToggle: () => void;
}) {
  return (
    <article
      className={[
        'rounded-[1.5rem] border p-5 transition',
        selected
          ? 'border-sky-300/20 bg-sky-300/[0.045]'
          : 'border-white/[0.07] bg-white/[0.025]',
        applied
          ? 'opacity-60'
          : '',
      ].join(' ')}
    >
      <button
        type="button"
        disabled={applied}
        onClick={
          onToggle
        }
        className="flex w-full items-start gap-4 text-left disabled:cursor-default"
      >
        <SelectionMark
          selected={
            selected ||
            applied
          }
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {categoryLabel(
                recommendation.category,
              )}
            </span>

            {recommendation.weatherAware && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/10 bg-sky-300/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-200/80">
                <CloudRain className="h-3 w-3" />
                Weather aware
              </span>
            )}

            {applied && (
              <span className="rounded-full border border-emerald-300/10 bg-emerald-300/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                Added
              </span>
            )}
          </div>

          <h3 className="mt-4 text-base font-semibold tracking-[-0.025em] text-white">
            {recommendation.title}
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {recommendation.reason}
          </p>
        </div>
      </button>

      <div className="mt-5 grid gap-2 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <CalendarDays className="h-3.5 w-3.5 text-sky-200/60" />
          {formatDay(
            recommendation.day,
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          {timeRange(
            recommendation,
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
          <span className="truncate">
            {recommendation.location ??
              'Flexible location'}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <DollarSign className="h-3.5 w-3.5 text-emerald-200/60" />
          {formatMoney(
            recommendation.estimatedCost,
            recommendation.currency,
          )}
        </div>
      </div>
    </article>
  );
}

export function AiPlannerPanel({
  tripId,
  destination,
  currency,
  onOpenItinerary,
}: AiPlannerPanelProps) {
  const [
    pace,
    setPace,
  ] =
    useState<AiPace>(
      'BALANCED',
    );

  const [
    budgetPreference,
    setBudgetPreference,
  ] =
    useState<AiBudgetPreference>(
      'BALANCED',
    );

  const [
    interests,
    setInterests,
  ] =
    useState<
      AiInterest[]
    >([
      'CULTURE',
      'FOOD',
    ]);

  const [
    notes,
    setNotes,
  ] =
    useState('');

  const [
    lastPrompt,
    setLastPrompt,
  ] =
    useState<string | null>(
      null,
    );

  const [
    generation,
    setGeneration,
  ] =
    useState<GenerationState>({
      status: 'idle',
      data: null,
      error: null,
    });

  const [
    selectedIds,
    setSelectedIds,
  ] =
    useState<
      Set<string>
    >(
      new Set(),
    );

  const [
    appliedIds,
    setAppliedIds,
  ] =
    useState<
      Set<string>
    >(
      new Set(),
    );

  const [
    applyState,
    setApplyState,
  ] =
    useState<ApplyState>({
      status: 'idle',
      message: null,
    });


  const [
    saveMappableLocations,
    setSaveMappableLocations,
  ] =
    useState(true);

const recommendations =
  useMemo(
    () =>
      generation.status ===
      'success'
        ? generation.data
            .recommendations
        : [],
    [generation],
  );

  const selectedRecommendations =
    useMemo(
      () =>
        recommendations.filter(
          (item) =>
            selectedIds.has(
              item.id,
            ) &&
            !appliedIds.has(
              item.id,
            ),
        ),
      [
        recommendations,
        selectedIds,
        appliedIds,
      ],
    );

  const selectedTotal =
    useMemo(
      () =>
        selectedRecommendations.reduce(
          (
            total,
            item,
          ) => {
            const amount =
              Number(
                item.estimatedCost,
              );

            return Number.isFinite(
              amount,
            )
              ? total +
                  amount
              : total;
          },
          0,
        ),
      [
        selectedRecommendations,
      ],
    );

  function toggleInterest(
    interest:
      AiInterest,
  ) {
    setInterests(
      (current) =>
        current.includes(
          interest,
        )
          ? current.filter(
              (item) =>
                item !==
                interest,
            )
          : [
              ...current,
              interest,
            ],
    );
  }

  function toggleRecommendation(
    id: string,
  ) {
    setSelectedIds(
      (current) => {
        const next =
          new Set(
            current,
          );

        if (
          next.has(id)
        ) {
          next.delete(
            id,
          );
        } else {
          next.add(id);
        }

        return next;
      },
    );
  }

  async function generateProposal(
    promptOverride?: string,
  ) {
    if (
      interests.length ===
      0
    ) {
      setGeneration({
        status: 'error',
        data: null,
        error:
          'Choose at least one interest before generating a proposal.',
      });

      return;
    }

    setGeneration({
      status: 'loading',
      data: null,
      error: null,
    });

    setApplyState({
      status: 'idle',
      message: null,
    });

    setAppliedIds(
      new Set(),
    );

    const prompt =
      (
        promptOverride ??
        notes
      ).trim();

    setLastPrompt(
      prompt ||
        `Help me improve my ${destination} itinerary.`,
    );

    const input:
      GenerateAiRecommendationsInput =
      {
        pace,
        interests,
        budgetPreference,
        ...(prompt
          ? {
              notes:
                prompt,
            }
          : {}),
      };

    try {
      const response =
        await fetch(
          `/api/trips/${encodeURIComponent(tripId)}/ai/recommendations`,
          {
            method: 'POST',
            headers: {
              'content-type':
                'application/json',
              accept:
                'application/json',
            },
            body:
              JSON.stringify(
                input,
              ),
          },
        );

      const payload: unknown =
        await response.json();

      if (
        !response.ok
      ) {
        setGeneration({
          status: 'error',
          data: null,
          error:
            getErrorMessage(
              payload,
            ),
        });

        return;
      }

      const data =
        readAiResponse(
          payload,
        );

      if (!data) {
        setGeneration({
          status: 'error',
          data: null,
          error:
            'Meridian received an unexpected AI response.',
        });

        return;
      }

      setGeneration({
        status: 'success',
        data,
        error: null,
      });

      setSelectedIds(
        new Set(
          data.recommendations.map(
            (item) =>
              item.id,
          ),
        ),
      );
    } catch {
      setGeneration({
        status: 'error',
        data: null,
        error:
          'Meridian AI is currently unavailable.',
      });
    }
  }

  async function applySelected() {
    if (
      selectedRecommendations.length ===
        0 ||
      applyState.status ===
        'applying'
    ) {
      return;
    }

    setApplyState({
      status:
        'applying',
      message: null,
    });

    try {
      const itineraryResponse =
        await fetch(
          `/api/trips/${encodeURIComponent(tripId)}/itinerary`,
          {
            method: 'GET',
            headers: {
              accept:
                'application/json',
            },
            cache:
              'no-store',
          },
        );

      const itineraryPayload: unknown =
        await itineraryResponse.json();

      if (
        !itineraryResponse.ok
      ) {
        setApplyState({
          status: 'error',
          message:
            getErrorMessage(
              itineraryPayload,
            ),
        });

        return;
      }

      const itinerary =
        readItinerary(
          itineraryPayload,
        );

      if (!itinerary) {
        setApplyState({
          status: 'error',
          message:
            'Meridian could not read the itinerary before applying this proposal.',
        });

        return;
      }

      const dayByDate =
        new Map(
          itinerary.days.map(
            (day) => [
              day.date.slice(
                0,
                10,
              ),
              day,
            ],
          ),
        );

      let existingPlaces:
        ExistingPlace[] =
        [];

      let placesReady =
        !saveMappableLocations;

      if (
        saveMappableLocations
      ) {
        try {
          const placesResponse =
            await fetch(
              `/api/trips/${encodeURIComponent(tripId)}/places`,
              {
                method:
                  'GET',
                headers: {
                  accept:
                    'application/json',
                },
                cache:
                  'no-store',
              },
            );

          const placesPayload:
            unknown =
            await placesResponse.json();

          const places =
            placesResponse.ok
              ? readPlaces(
                  placesPayload,
                )
              : null;

          if (places) {
            existingPlaces =
              places;
            placesReady =
              true;
          }
        } catch {
          placesReady =
            false;
        }
      }

      const appliedNow:
        string[] =
        [];

      const failures:
        string[] =
        [];

      let linkedLocations =
        0;

      let createdPlaces =
        0;

      let unresolvedLocations =
        0;

      for (
        const recommendation
        of selectedRecommendations
      ) {
        const day =
          dayByDate.get(
            recommendation.day,
          );

        if (!day) {
          failures.push(
            `${recommendation.title}: travel day not found`,
          );

          continue;
        }

        const notesParts = [
          'Added from Meridian AI.',
          `Estimated cost: ${formatMoney(
            recommendation.estimatedCost,
            recommendation.currency,
          )}.`,
          ...(recommendation.weatherAware
            ? [
                'Weather-aware recommendation.',
              ]
            : []),
        ];

        const activityPayload = {
          title:
            recommendation.title,
          description:
            recommendation.reason,
          category:
            recommendation.category,
          ...(recommendation.suggestedStartTime
            ? {
                startTime:
                  recommendation.suggestedStartTime,
              }
            : {}),
          ...(recommendation.suggestedEndTime
            ? {
                endTime:
                  recommendation.suggestedEndTime,
              }
            : {}),
          ...(recommendation.location
            ? {
                location:
                  recommendation.location,
              }
            : {}),
          notes:
            notesParts.join(
              ' ',
            ),
        };

        try {
          const response =
            await fetch(
              `/api/trips/${encodeURIComponent(tripId)}/itinerary/days/${encodeURIComponent(day.id)}/activities`,
              {
                method: 'POST',
                headers: {
                  'content-type':
                    'application/json',
                  accept:
                    'application/json',
                },
                body:
                  JSON.stringify(
                    activityPayload,
                  ),
              },
            );

          let activityResponsePayload:
            unknown =
            null;

          try {
            activityResponsePayload =
              (await response.json()) as unknown;
          } catch {
            activityResponsePayload =
              null;
          }

          if (
            !response.ok
          ) {
            failures.push(
              `${recommendation.title}: ${getErrorMessage(activityResponsePayload)}`,
            );

            continue;
          }

          const activityId =
            readCreatedResourceId(
              activityResponsePayload,
            );

          appliedNow.push(
            recommendation.id,
          );

          if (
            !saveMappableLocations ||
            !recommendation.location
          ) {
            continue;
          }

          if (
            !placesReady ||
            !activityId
          ) {
            unresolvedLocations +=
              1;

            continue;
          }

          try {
            const query =
              `${recommendation.location}, ${destination}`;

            const geocodingResponse =
              await fetch(
                `/api/geocoding/search?q=${encodeURIComponent(query)}`,
                {
                  method:
                    'GET',
                  headers: {
                    accept:
                      'application/json',
                  },
                  cache:
                    'no-store',
                },
              );

            const geocodingPayload:
              unknown =
              await geocodingResponse.json();

            const geocodingResults =
              geocodingResponse.ok
                ? readGeocodingResults(
                    geocodingPayload,
                  )
                : null;

            const resolved =
              geocodingResults?.[0];

            if (!resolved) {
              unresolvedLocations +=
                1;

              continue;
            }

            let place =
              existingPlaces.find(
                (candidate) =>
                  candidate.sourceProvider ===
                    resolved.provider &&
                  candidate.sourcePlaceId ===
                    resolved.providerPlaceId,
              );

            if (!place) {
              const normalizedResolvedName =
                normalizePlaceName(
                  resolved.name,
                );

              const normalizedRequestedLocation =
                normalizePlaceName(
                  recommendation.location,
                );

              place =
                existingPlaces.find(
                  (candidate) => {
                    const candidateName =
                      normalizePlaceName(
                        candidate.name,
                      );

                    return (
                      candidateName ===
                        normalizedResolvedName ||
                      candidateName ===
                        normalizedRequestedLocation
                    );
                  },
                );
            }

            if (!place) {
              const createPlaceResponse =
                await fetch(
                  `/api/trips/${encodeURIComponent(tripId)}/places`,
                  {
                    method:
                      'POST',
                    headers: {
                      'content-type':
                        'application/json',
                      accept:
                        'application/json',
                    },
                    body:
                      JSON.stringify({
                        name:
                          resolved.name,
                        category:
                          toPlaceCategory(
                            recommendation.category,
                          ),
                        address:
                          resolved.displayName,
                        latitude:
                          resolved.latitude,
                        longitude:
                          resolved.longitude,
                        ...(resolved.website
                          ? {
                              website:
                                resolved.website,
                            }
                          : {}),
                        notes:
                          `Saved from Meridian AI: ${recommendation.title}`,
                        sourceProvider:
                          resolved.provider,
                        sourcePlaceId:
                          resolved.providerPlaceId,
                      }),
                  },
                );

              let createPlacePayload:
                unknown =
                null;

              try {
                createPlacePayload =
                  (await createPlaceResponse.json()) as unknown;
              } catch {
                createPlacePayload =
                  null;
              }

              if (
                !createPlaceResponse.ok
              ) {
                unresolvedLocations +=
                  1;

                continue;
              }

              const placeId =
                readCreatedResourceId(
                  createPlacePayload,
                );

              if (!placeId) {
                unresolvedLocations +=
                  1;

                continue;
              }

              place = {
                id:
                  placeId,
                name:
                  resolved.name,
                sourceProvider:
                  resolved.provider,
                sourcePlaceId:
                  resolved.providerPlaceId,
              };

              existingPlaces.push(
                place,
              );

              createdPlaces +=
                1;
            }

            const linkResponse =
              await fetch(
                `/api/trips/${encodeURIComponent(tripId)}/itinerary/days/${encodeURIComponent(day.id)}/activities/${encodeURIComponent(activityId)}`,
                {
                  method:
                    'PATCH',
                  headers: {
                    'content-type':
                      'application/json',
                    accept:
                      'application/json',
                  },
                  body:
                    JSON.stringify({
                      placeId:
                        place.id,
                    }),
                },
              );

            if (
              linkResponse.ok
            ) {
              linkedLocations +=
                1;
            } else {
              unresolvedLocations +=
                1;
            }
          } catch {
            unresolvedLocations +=
              1;
          }
        } catch {
          failures.push(
            `${recommendation.title}: activity service unavailable`,
          );
        }
      }

      if (
        appliedNow.length >
        0
      ) {
        setAppliedIds(
          (current) =>
            new Set([
              ...current,
              ...appliedNow,
            ]),
        );

        setSelectedIds(
          (current) => {
            const next =
              new Set(
                current,
              );

            for (
              const id
              of appliedNow
            ) {
              next.delete(
                id,
              );
            }

            return next;
          },
        );
      }

      if (
        failures.length >
        0
      ) {
        const mapSummary =
          saveMappableLocations
            ? ` ${linkedLocations} mapped location${linkedLocations === 1 ? '' : 's'} linked.`
            : '';

        setApplyState({
          status: 'error',
          message:
            appliedNow.length >
            0
              ? `${appliedNow.length} recommendation${appliedNow.length === 1 ? '' : 's'} added, but ${failures.length} could not be applied.${mapSummary}`
              : failures[0] ??
                'The selected recommendations could not be applied.',
        });

        return;
      }

      const mappingSummary =
        !saveMappableLocations
          ? ''
          : ` ${linkedLocations} location${linkedLocations === 1 ? '' : 's'} linked to the map${createdPlaces > 0 ? ` · ${createdPlaces} new place${createdPlaces === 1 ? '' : 's'} saved` : ''}${unresolvedLocations > 0 ? ` · ${unresolvedLocations} location${unresolvedLocations === 1 ? '' : 's'} could not be resolved` : ''}.`;

      setApplyState({
        status: 'success',
        message:
          `${appliedNow.length} recommendation${appliedNow.length === 1 ? '' : 's'} added to your itinerary.${mappingSummary}`,
      });
    } catch {
      setApplyState({
        status: 'error',
        message:
          'Meridian could not apply this proposal right now.',
      });
    }
  }

  function submitComposer():
    void {
    if (
      generation.status ===
        'loading'
    ) {
      return;
    }

    const prompt =
      notes.trim();

    if (!prompt) {
      return;
    }

    setNotes('');

    void generateProposal(
      prompt,
    );
  }

  const proposal =
    generation.status ===
    'success'
      ? generation.data
      : null;


  const quickPrompts = [
    'Build a balanced itinerary using my current trip context.',
    'Make this trip feel more relaxed and reduce unnecessary travel.',
    'Suggest food, culture and local experiences that fit naturally into the itinerary.',
    'Find weather-aware alternatives without overloading the schedule.',
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-300/10 bg-sky-300/[0.055] text-sky-200">
              <Sparkles className="h-3.5 w-3.5" />
            </span>

            <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-white/[0.07] bg-white/[0.035] px-4 py-3">
              <p className="text-sm leading-6 text-slate-300">
                Tell me what you want to improve about {destination}. I can turn the result into real itinerary activities and map-linked places after you approve it.
              </p>
            </div>
          </div>

          {generation.status ===
            'idle' && (
            <div className="pl-11">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                Try asking
              </p>

              <div className="flex flex-wrap gap-2">
                {quickPrompts.map(
                  (
                    prompt,
                    index,
                  ) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        void generateProposal(
                          prompt,
                        );
                      }}
                      className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-left text-[11px] leading-5 text-slate-500 outline-none transition hover:border-sky-300/15 hover:bg-sky-300/[0.04] hover:text-sky-100 focus-visible:ring-2 focus-visible:ring-sky-300/20"
                    >
                      {index === 0
                        ? 'Plan the trip'
                        : index === 1
                          ? 'Make it relaxed'
                          : index === 2
                            ? 'Food & culture'
                            : 'Weather-safe ideas'}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}

          {lastPrompt && (
            <div className="flex justify-end">
              <div className="max-w-[88%] rounded-2xl rounded-tr-md border border-sky-300/12 bg-sky-300/[0.07] px-4 py-3">
                <p className="text-sm leading-6 text-sky-50/90">
                  {lastPrompt}
                </p>
              </div>
            </div>
          )}

          {generation.status ===
            'loading' && (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-300/10 bg-sky-300/[0.055] text-sky-200">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </span>

              <div className="rounded-2xl rounded-tl-md border border-white/[0.07] bg-white/[0.035] px-4 py-3">
                <p className="text-sm text-slate-400">
                  I&apos;m reviewing the journey and building a proposal…
                </p>
              </div>
            </div>
          )}

          {generation.status ===
            'error' && (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-rose-300/10 bg-rose-300/[0.05] text-rose-200">
                <Sparkles className="h-3.5 w-3.5" />
              </span>

              <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-rose-300/10 bg-rose-300/[0.035] px-4 py-3">
                <p className="text-sm leading-6 text-rose-100/80">
                  {generation.error}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    void generateProposal(
                      lastPrompt ??
                        undefined,
                    );
                  }}
                  className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-rose-100"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try again
                </button>
              </div>
            </div>
          )}

          {proposal && (
            <>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-300/10 bg-sky-300/[0.055] text-sky-200">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>

                <div className="max-w-[92%] rounded-2xl rounded-tl-md border border-white/[0.07] bg-white/[0.035] px-4 py-3">
                  <p className="text-sm font-semibold leading-6 text-white">
                    {proposal.summary}
                  </p>

                  {proposal.insights.length >
                    0 && (
                    <div className="mt-3 space-y-2">
                      {proposal.insights.map(
                        (
                          insight,
                          index,
                        ) => (
                          <p
                            key={`${insight}-${index}`}
                            className="text-xs leading-5 text-slate-500"
                          >
                            • {insight}
                          </p>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="pl-0 sm:pl-11">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                      Suggested changes
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {selectedRecommendations.length} selected ·{' '}
                      {formatMoney(
                        selectedTotal.toFixed(
                          2,
                        ),
                        currency,
                      )}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedIds(
                          new Set(),
                        )
                      }
                      className="rounded-lg border border-white/[0.07] px-2.5 py-1.5 text-[10px] font-medium text-slate-500 transition hover:text-white"
                    >
                      Clear
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedIds(
                          new Set(
                            recommendations
                              .filter(
                                (item) =>
                                  !appliedIds.has(
                                    item.id,
                                  ),
                              )
                              .map(
                                (item) =>
                                  item.id,
                              ),
                          ),
                        )
                      }
                      className="rounded-lg border border-white/[0.07] px-2.5 py-1.5 text-[10px] font-medium text-slate-400 transition hover:bg-white/[0.04]"
                    >
                      Select all
                    </button>
                  </div>
                </div>

                <div className="grid gap-3">
                  {recommendations.map(
                    (
                      recommendation,
                    ) => (
                      <RecommendationCard
                        key={
                          recommendation.id
                        }
                        recommendation={
                          recommendation
                        }
                        selected={
                          selectedIds.has(
                            recommendation.id,
                          )
                        }
                        applied={
                          appliedIds.has(
                            recommendation.id,
                          )
                        }
                        onToggle={() =>
                          toggleRecommendation(
                            recommendation.id,
                          )
                        }
                      />
                    ),
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={
                        saveMappableLocations
                      }
                      onChange={(event) =>
                        setSaveMappableLocations(
                          event.target.checked,
                        )
                      }
                      className="mt-0.5 h-4 w-4 accent-sky-300"
                    />

                    <span>
                      <span className="flex items-center gap-2 text-xs font-medium text-white">
                        <MapPin className="h-3.5 w-3.5 text-sky-200" />
                        Add locations to Places & Map
                      </span>

                      <span className="mt-1 block text-[11px] leading-5 text-slate-600">
                        When possible, Meridian geocodes the selected location, saves/reuses the Place, and links its marker to the new activity.
                      </span>
                    </span>
                  </label>

                  <button
                    type="button"
                    disabled={
                      selectedRecommendations.length ===
                        0 ||
                      applyState.status ===
                        'applying'
                    }
                    onClick={() => {
                      void applySelected();
                    }}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-200 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {applyState.status ===
                    'applying' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Adding to journey…
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Add selected to itinerary
                      </>
                    )}
                  </button>

                  {applyState.status ===
                    'success' && (
                    <div className="mt-3 flex flex-col gap-2 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.04] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[11px] leading-5 text-emerald-100/80">
                        {applyState.message}
                      </p>

                      <button
                        type="button"
                        onClick={
                          onOpenItinerary
                        }
                        className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-emerald-100"
                      >
                        Open itinerary
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {applyState.status ===
                    'error' && (
                    <p className="mt-3 rounded-xl border border-rose-300/10 bg-rose-300/[0.04] px-3 py-3 text-[11px] leading-5 text-rose-100/80">
                      {applyState.message}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-white/[0.07] bg-[#07111b]/96 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:px-5 sm:pb-4">
        <details className="mb-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[11px] font-medium text-slate-500 [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Planning preferences
          </summary>

          <div className="grid gap-4 border-t border-white/[0.055] p-3">
            <label>
              <span className="text-[10px] font-medium text-slate-500">
                Pace
              </span>

              <select
                value={pace}
                onChange={(event) =>
                  setPace(
                    event.target.value as
                      AiPace,
                  )
                }
                className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-[#09131e] px-3 py-2.5 text-xs text-white outline-none focus:border-sky-300/30"
              >
                {PACE_OPTIONS.map(
                  (option) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {option.label} — {option.description}
                    </option>
                  ),
                )}
              </select>
            </label>

            <div>
              <p className="text-[10px] font-medium text-slate-500">
                Interests
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                {INTERESTS.map(
                  (interest) => {
                    const selected =
                      interests.includes(
                        interest.value,
                      );

                    return (
                      <button
                        key={
                          interest.value
                        }
                        type="button"
                        aria-pressed={
                          selected
                        }
                        onClick={() =>
                          toggleInterest(
                            interest.value,
                          )
                        }
                        className={[
                          'rounded-full border px-2.5 py-1.5 text-[10px] font-medium transition',
                          selected
                            ? 'border-sky-300/15 bg-sky-300/[0.07] text-sky-100'
                            : 'border-white/[0.07] bg-white/[0.02] text-slate-600 hover:text-slate-300',
                        ].join(' ')}
                      >
                        {
                          interest.label
                        }
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            <label>
              <span className="text-[10px] font-medium text-slate-500">
                Spending style
              </span>

              <select
                value={
                  budgetPreference
                }
                onChange={(event) =>
                  setBudgetPreference(
                    event.target.value as
                      AiBudgetPreference,
                  )
                }
                className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-[#09131e] px-3 py-2.5 text-xs text-white outline-none focus:border-sky-300/30"
              >
                {BUDGET_OPTIONS.map(
                  (option) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {
                        option.label
                      }
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
        </details>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitComposer();
          }}
          className="flex items-end gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-2 focus-within:border-sky-300/20"
        >
          <textarea
            value={notes}
            onChange={(event) =>
              setNotes(
                event.target.value,
              )
            }
            onKeyDown={(event) => {
              if (
                event.key ===
                  'Enter' &&
                !event.shiftKey
              ) {
                event.preventDefault();
                submitComposer();
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder={`Ask Meridian about ${destination}…`}
            className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-white outline-none placeholder:text-slate-600"
          />

          <button
            type="submit"
            disabled={
              generation.status ===
                'loading' ||
              notes.trim().length ===
                0
            }
            aria-label="Send to Meridian"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-200 text-slate-950 transition hover:bg-sky-100 disabled:cursor-wait disabled:opacity-50"
          >
            {generation.status ===
            'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
