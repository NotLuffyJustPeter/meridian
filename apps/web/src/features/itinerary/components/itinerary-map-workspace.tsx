
'use client';

import {
  Compass,
  LocateFixed,
  Map as MapIcon,
  RefreshCw,
  Route,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  MeridianMap,
} from '../../map/components/meridian-map';
import type {
  Place,
} from '../../places/types/place.types';
import {
  ItineraryTimeline,
} from './itinerary-timeline';

type ItineraryMapWorkspaceProps = {
  tripId: string;
  canEdit: boolean;
};

type PlacesState =
  | {
      status: 'loading';
      places: Place[];
      error: null;
    }
  | {
      status: 'success';
      places: Place[];
      error: null;
    }
  | {
      status: 'error';
      places: Place[];
      error: string;
    };

type MobileView =
  | 'timeline'
  | 'map';

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

function readPlaces(
  payload: unknown,
): Place[] | null {
  if (
    Array.isArray(
      payload,
    )
  ) {
    return payload as Place[];
  }

  if (
    isRecord(payload) &&
    Array.isArray(
      payload.data,
    )
  ) {
    return payload.data as Place[];
  }

  return null;
}

function readError(
  payload: unknown,
): string {
  if (!isRecord(payload)) {
    return 'Unable to load journey places.';
  }

  const {
    message,
  } = payload;

  if (
    typeof message ===
    'string'
  ) {
    return message;
  }

  if (
    Array.isArray(
      message,
    ) &&
    message.every(
      (item) =>
        typeof item ===
        'string',
    )
  ) {
    return message.join(
      ', ',
    );
  }

  return 'Unable to load journey places.';
}

async function fetchPlaces(
  tripId: string,
): Promise<PlacesState> {
  try {
    const response =
      await fetch(
        `/api/trips/${encodeURIComponent(
          tripId,
        )}/places`,
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

    const payload: unknown =
      await response.json();

    if (!response.ok) {
      return {
        status:
          'error',
        places: [],
        error:
          readError(
            payload,
          ),
      };
    }

    const places =
      readPlaces(
        payload,
      );

    if (!places) {
      return {
        status:
          'error',
        places: [],
        error:
          'Meridian received an unexpected places response.',
      };
    }

    return {
      status:
        'success',
      places,
      error: null,
    };
  } catch {
    return {
      status:
        'error',
      places: [],
      error:
        'Places service is temporarily unavailable.',
    };
  }
}

export function ItineraryMapWorkspace({
  tripId,
  canEdit,
}: ItineraryMapWorkspaceProps) {
  const [
    placesState,
    setPlacesState,
  ] =
    useState<PlacesState>({
      status:
        'loading',
      places: [],
      error: null,
    });

  const [
    selectedPlaceId,
    setSelectedPlaceId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    mobileView,
    setMobileView,
  ] =
    useState<MobileView>(
      'timeline',
    );

  async function reloadPlaces() {
    const next =
      await fetchPlaces(
        tripId,
      );

    setPlacesState(
      next,
    );
  }

  useEffect(() => {
    let cancelled =
      false;

    void fetchPlaces(
      tripId,
    ).then(
      (next) => {
        if (!cancelled) {
          setPlacesState(
            next,
          );
        }
      },
    );

    return () => {
      cancelled =
        true;
    };
  }, [
    tripId,
  ]);

  const mappedPlaces =
    useMemo(
      () =>
        placesState.places.filter(
          (place) =>
            place.latitude !==
              null &&
            place.longitude !==
              null,
        ),
      [
        placesState.places,
      ],
    );

  const selectedPlace =
    useMemo(
      () =>
        selectedPlaceId
          ? placesState.places.find(
              (place) =>
                place.id ===
                selectedPlaceId,
            ) ??
            null
          : null,
      [
        placesState.places,
        selectedPlaceId,
      ],
    );

  function focusPlace(
    placeId: string,
  ) {
    setSelectedPlaceId(
      placeId,
    );

    setMobileView(
      'map',
    );
  }

  return (
    <section className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-4 xl:hidden">
        <div className="inline-flex rounded-2xl border border-white/[0.07] bg-white/[0.025] p-1">
          <button
            type="button"
            aria-pressed={
              mobileView ===
              'timeline'
            }
            onClick={() => {
              setMobileView(
                'timeline',
              );
            }}
            className={[
              'inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-xs font-semibold outline-none transition',
              mobileView ===
              'timeline'
                ? 'bg-white/[0.07] text-white'
                : 'text-slate-500 hover:text-slate-200',
              'focus-visible:ring-2 focus-visible:ring-sky-300/20',
            ].join(
              ' ',
            )}
          >
            <Route className="h-3.5 w-3.5" />
            Timeline
          </button>

          <button
            type="button"
            aria-pressed={
              mobileView ===
              'map'
            }
            onClick={() => {
              setMobileView(
                'map',
              );
            }}
            className={[
              'inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-xs font-semibold outline-none transition',
              mobileView ===
              'map'
                ? 'bg-sky-300/[0.075] text-sky-100'
                : 'text-slate-500 hover:text-slate-200',
              'focus-visible:ring-2 focus-visible:ring-sky-300/20',
            ].join(
              ' ',
            )}
          >
            <MapIcon className="h-3.5 w-3.5" />
            Map
          </button>
        </div>

        {mappedPlaces.length >
          0 && (
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-600">
            {
              mappedPlaces.length
            }{' '}
            mapped
          </span>
        )}
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(34rem,1.08fr)] xl:items-start">
        <div
          className={[
            mobileView ===
            'timeline'
              ? 'block'
              : 'hidden',
            'xl:block',
          ].join(
            ' ',
          )}
        >
          <div className="min-w-0">
          <ItineraryTimeline
            tripId={
              tripId
            }
            canEdit={
              canEdit
            }
            selectedPlaceId={
              selectedPlaceId
            }
            onSelectPlace={
              focusPlace
            }
          />
          </div>
        </div>

        <aside
          className={[
            mobileView ===
            'map'
              ? 'block'
              : 'hidden',
            'xl:sticky xl:top-[9.5rem] xl:block',
          ].join(
            ' ',
          )}
        >
          <div className="overflow-hidden rounded-[1.75rem] border border-white/[0.075] bg-[#08131d]/80 shadow-[0_28px_90px_rgba(0,0,0,0.24)]">
            <div className="border-b border-white/[0.065] px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-300/10 bg-sky-300/[0.05] text-sky-200">
                    <Compass className="h-4 w-4" />
                  </span>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200/70">
                      Journey map
                    </p>

                    <p className="mt-1 text-sm font-medium text-white">
                      Itinerary beside the map
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void reloadPlaces();
                  }}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-[11px] font-medium text-slate-500 outline-none transition hover:bg-white/[0.05] hover:text-white focus-visible:ring-2 focus-visible:ring-sky-300/20"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[10px] text-slate-500">
                  {
                    placesState
                      .places
                      .length
                  }{' '}
                  saved
                </span>

                <span className="rounded-full border border-sky-300/10 bg-sky-300/[0.035] px-2.5 py-1 text-[10px] text-sky-200/70">
                  {
                    mappedPlaces.length
                  }{' '}
                  mapped
                </span>
              </div>
            </div>

            {placesState.status ===
              'error' && (
              <div className="border-b border-rose-300/10 bg-rose-300/[0.035] px-5 py-3 text-xs text-rose-200/80 sm:px-6">
                {
                  placesState.error
                }
              </div>
            )}

            {selectedPlace && (
              <div className="border-b border-white/[0.06] bg-white/[0.018] px-5 py-4 sm:px-6">
                <div className="flex items-start gap-3">
                  <LocateFixed className="mt-0.5 h-4 w-4 shrink-0 text-sky-200/75" />

                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-200">
                      {
                        selectedPlace.name
                      }
                    </p>

                    <p className="mt-1 truncate text-[11px] text-slate-600">
                      {selectedPlace.address ??
                        'Saved journey place'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <MeridianMap
              places={
                placesState.places
              }
              selectedPlaceId={
                selectedPlaceId
              }
              onSelectPlace={
                setSelectedPlaceId
              }
              className="rounded-none border-0"
              heightClassName="h-[58dvh] min-h-[430px] max-h-[680px] xl:h-[calc(100vh-15rem)] xl:min-h-[590px] xl:max-h-[790px]"
            />

            <div className="border-t border-white/[0.06] px-5 py-3 sm:px-6">
              <p className="text-[10px] leading-5 text-slate-600">
                Activities connected to saved places can focus this map directly from the timeline.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
