'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Check,
  ExternalLink,
  Hotel,
  Landmark,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  TrainFront,
  Trees,
  Trash2,
  Utensils,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { GeocodingPreviewMap } from '../../geocoding/components/geocoding-preview-map';
import type {
  GeocodingResult,
  GeocodingSearchResponse,
} from '../../geocoding/types/geocoding.types';

import { MeridianMap } from '../../map/components/meridian-map';
import type {
  CreatePlaceInput,
  Place,
  PlaceCategory,
  UpdatePlaceInput,
} from '../types/place.types';

interface PlacesPanelProps {
  tripId: string;
}

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

type PlaceDialogState =
  | {
      mode: 'create';
    }
  | {
      mode: 'edit';
      place: Place;
    }
  | null;

interface PlaceFormState {
  name: string;
  category: PlaceCategory;
  address: string;
  latitude: string;
  longitude: string;
  website: string;
  notes: string;
  sourceProvider: string | null;
  sourcePlaceId: string | null;
}

type CategoryFilter =
  | 'ALL'
  | PlaceCategory;

interface CategoryMeta {
  label: string;
  filterLabel: string;
  badgeClassName: string;
  icon: LucideIcon;
}

const EMPTY_FORM: PlaceFormState = {
  name: '',
  category: 'OTHER',
  address: '',
  latitude: '',
  longitude: '',
  website: '',
  notes: '',
  sourceProvider: null,
  sourcePlaceId: null,
};

const CATEGORY_META: Record<
  PlaceCategory,
  CategoryMeta
> = {
  LANDMARK: {
    label: 'Landmark',
    filterLabel: 'Landmarks',
    badgeClassName:
      'border-violet-400/20 bg-violet-400/10 text-violet-200',
    icon: Landmark,
  },

  FOOD: {
    label: 'Food',
    filterLabel: 'Food',
    badgeClassName:
      'border-amber-400/20 bg-amber-400/10 text-amber-200',
    icon: Utensils,
  },

  LODGING: {
    label: 'Lodging',
    filterLabel: 'Hotels',
    badgeClassName:
      'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    icon: Hotel,
  },

  SHOPPING: {
    label: 'Shopping',
    filterLabel: 'Shopping',
    badgeClassName:
      'border-pink-400/20 bg-pink-400/10 text-pink-200',
    icon: ShoppingBag,
  },

  TRANSPORT: {
    label: 'Transport',
    filterLabel: 'Transport',
    badgeClassName:
      'border-sky-400/20 bg-sky-400/10 text-sky-200',
    icon: TrainFront,
  },

  ENTERTAINMENT: {
    label: 'Entertainment',
    filterLabel: 'Entertainment',
    badgeClassName:
      'border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200',
    icon: Sparkles,
  },

  NATURE: {
    label: 'Nature',
    filterLabel: 'Nature',
    badgeClassName:
      'border-teal-400/20 bg-teal-400/10 text-teal-200',
    icon: Trees,
  },

  OTHER: {
    label: 'Other',
    filterLabel: 'Other',
    badgeClassName:
      'border-white/10 bg-white/[0.05] text-white/70',
    icon: MapPin,
  },
};

const PLACE_CATEGORIES =
  Object.keys(
    CATEGORY_META,
  ) as PlaceCategory[];

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
    return 'Something went wrong.';
  }

  const message =
    payload['message'];

  if (
    typeof message ===
    'string'
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

function readPlacesPayload(
  payload: unknown,
): Place[] | null {
  if (
    Array.isArray(payload)
  ) {
    return payload as Place[];
  }

  if (
    isRecord(payload) &&
    Array.isArray(
      payload['data'],
    )
  ) {
    return payload[
      'data'
    ] as Place[];
  }

  return null;
}

async function fetchPlacesState(
  tripId: string,
): Promise<PlacesState> {
  try {
    const response =
      await fetch(
        `/api/trips/${encodeURIComponent(
          tripId,
        )}/places`,
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

    const payload =
      (await response.json()) as unknown;

    if (!response.ok) {
      return {
        status: 'error',
        places: [],
        error:
          getErrorMessage(
            payload,
          ),
      };
    }

    const places =
      readPlacesPayload(
        payload,
      );

    if (!places) {
      return {
        status: 'error',
        places: [],
        error:
          'Places service returned an invalid response.',
      };
    }

    return {
      status: 'success',
      places,
      error: null,
    };
  } catch {
    return {
      status: 'error',
      places: [],
      error:
        'Places service is currently unavailable.',
    };
  }
}

function nullableText(
  value: string,
): string | null {
  const trimmed =
    value.trim();

  return trimmed
    ? trimmed
    : null;
}

function placeToForm(
  place: Place,
): PlaceFormState {
  return {
    name:
      place.name,

    category:
      place.category,

    address:
      place.address ??
      '',

    latitude:
      place.latitude !==
      null
        ? String(
            place.latitude,
          )
        : '',

    longitude:
      place.longitude !==
      null
        ? String(
            place.longitude,
          )
        : '',

    website:
      place.website ??
      '',

    notes:
      place.notes ??
      '',

    sourceProvider:
      place.sourceProvider,

    sourcePlaceId:
      place.sourcePlaceId,
  };
}

function getPreviewCoordinates(
  form: PlaceFormState,
): {
  latitude: number;
  longitude: number;
} | null {
  const latitude =
    Number(
      form.latitude,
    );

  const longitude =
    Number(
      form.longitude,
    );

  if (
    !form.latitude.trim() ||
    !form.longitude.trim() ||
    !Number.isFinite(
      latitude,
    ) ||
    !Number.isFinite(
      longitude,
    ) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
}

function parseCoordinates(
  latitudeValue: string,
  longitudeValue: string,
):
  | {
      ok: true;
      latitude: number | null;
      longitude: number | null;
    }
  | {
      ok: false;
      message: string;
    } {
  const latitudeText =
    latitudeValue.trim();

  const longitudeText =
    longitudeValue.trim();

  const hasLatitude =
    latitudeText.length >
    0;

  const hasLongitude =
    longitudeText.length >
    0;

  if (
    hasLatitude !==
    hasLongitude
  ) {
    return {
      ok: false,
      message:
        'Latitude and longitude must be provided together.',
    };
  }

  if (
    !hasLatitude &&
    !hasLongitude
  ) {
    return {
      ok: true,
      latitude: null,
      longitude: null,
    };
  }

  const latitude =
    Number(
      latitudeText,
    );

  const longitude =
    Number(
      longitudeText,
    );

  if (
    !Number.isFinite(
      latitude,
    ) ||
    latitude < -90 ||
    latitude > 90
  ) {
    return {
      ok: false,
      message:
        'Latitude must be between -90 and 90.',
    };
  }

  if (
    !Number.isFinite(
      longitude,
    ) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return {
      ok: false,
      message:
        'Longitude must be between -180 and 180.',
    };
  }

  return {
    ok: true,
    latitude,
    longitude,
  };
}

function isValidWebsite(
  value: string,
): boolean {
  const trimmed =
    value.trim();

  if (!trimmed) {
    return true;
  }

  try {
    const url =
      new URL(
        trimmed,
      );

    return (
      url.protocol ===
        'http:' ||
      url.protocol ===
        'https:'
    );
  } catch {
    return false;
  }
}

function formatCoordinates(
  place: Place,
): string | null {
  if (
    place.latitude ===
      null ||
    place.longitude ===
      null
  ) {
    return null;
  }

  return `${place.latitude.toFixed(
    4,
  )}, ${place.longitude.toFixed(
    4,
  )}`;
}

function inferPlaceCategory(
  result: GeocodingResult,
): PlaceCategory {
  const category =
    result.category
      ?.toLocaleLowerCase() ??
    '';

  const type =
    result.type
      ?.toLocaleLowerCase() ??
    '';

  const combined =
    `${category} ${type}`;

  if (
    combined.includes(
      'restaurant',
    ) ||
    combined.includes(
      'cafe',
    ) ||
    combined.includes(
      'bar',
    ) ||
    combined.includes(
      'fast_food',
    ) ||
    combined.includes(
      'food',
    )
  ) {
    return 'FOOD';
  }

  if (
    combined.includes(
      'hotel',
    ) ||
    combined.includes(
      'hostel',
    ) ||
    combined.includes(
      'motel',
    ) ||
    combined.includes(
      'guest_house',
    ) ||
    combined.includes(
      'accommodation',
    )
  ) {
    return 'LODGING';
  }

  if (
    combined.includes(
      'shop',
    ) ||
    combined.includes(
      'mall',
    ) ||
    combined.includes(
      'marketplace',
    ) ||
    combined.includes(
      'supermarket',
    )
  ) {
    return 'SHOPPING';
  }

  if (
    combined.includes(
      'station',
    ) ||
    combined.includes(
      'airport',
    ) ||
    combined.includes(
      'bus_stop',
    ) ||
    combined.includes(
      'transport',
    ) ||
    combined.includes(
      'railway',
    )
  ) {
    return 'TRANSPORT';
  }

  if (
    combined.includes(
      'cinema',
    ) ||
    combined.includes(
      'theatre',
    ) ||
    combined.includes(
      'nightclub',
    ) ||
    combined.includes(
      'entertainment',
    )
  ) {
    return 'ENTERTAINMENT';
  }

  if (
    combined.includes(
      'park',
    ) ||
    combined.includes(
      'garden',
    ) ||
    combined.includes(
      'nature',
    ) ||
    combined.includes(
      'beach',
    ) ||
    combined.includes(
      'peak',
    )
  ) {
    return 'NATURE';
  }

  if (
    combined.includes(
      'museum',
    ) ||
    combined.includes(
      'monument',
    ) ||
    combined.includes(
      'attraction',
    ) ||
    combined.includes(
      'place_of_worship',
    ) ||
    combined.includes(
      'historic',
    ) ||
    combined.includes(
      'tourism',
    )
  ) {
    return 'LANDMARK';
  }

  return 'OTHER';
}

function CategoryBadge({
  category,
}: {
  category:
    PlaceCategory;
}) {
  const meta =
    CATEGORY_META[
      category
    ];

  const Icon =
    meta.icon;

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        'text-[10px] font-semibold uppercase tracking-[0.13em]',
        meta.badgeClassName,
      ].join(' ')}
    >
      <Icon
        className="h-3.5 w-3.5"
        strokeWidth={1.8}
        aria-hidden="true"
      />

      {meta.label}
    </span>
  );
}

function PlaceCard({
  place,
  selected,
  cardRef,
  onSelect,
  onEdit,
  onDelete,
}: {
  place: Place;
  selected: boolean;
  cardRef: (
    element:
      HTMLElement | null,
  ) => void;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const coordinates =
    formatCoordinates(
      place,
    );

  const meta =
    CATEGORY_META[
      place.category
    ];

  const Icon =
    meta.icon;

  return (
    <article
      ref={cardRef}
      onClick={onSelect}
      onKeyDown={(
        event,
      ) => {
        if (
          event.target !==
          event.currentTarget
        ) {
          return;
        }

        if (
          event.key ===
            'Enter' ||
          event.key ===
            ' '
        ) {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={
        selected
      }
      className={[
        'group relative cursor-pointer overflow-hidden rounded-[1.65rem] border outline-none transition duration-300 hover:-translate-y-0.5',
        selected
          ? 'border-sky-300/30 bg-sky-300/[0.055] shadow-[0_0_0_1px_rgba(125,211,252,0.06)]'
          : 'border-white/[0.08] bg-white/[0.028] hover:border-white/[0.15] hover:bg-white/[0.045]',
        'focus-visible:border-sky-300/40 focus-visible:ring-2 focus-visible:ring-sky-300/15',
      ].join(' ')}
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full border border-white/[0.04] bg-white/[0.018]" />

      <div className="p-5">
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CategoryBadge
              category={
                place.category
              }
            />

            <h3 className="mt-4 truncate text-base font-semibold tracking-[-0.025em] text-white">
              {place.name}
            </h3>

            {place.address && (
              <div className="mt-2 flex items-start gap-2">
                <MapPin
                  className="mt-0.5 h-4 w-4 shrink-0 text-white/25"
                  strokeWidth={1.6}
                />

                <p className="line-clamp-2 text-sm leading-5 text-white/45">
                  {
                    place.address
                  }
                </p>
              </div>
            )}
          </div>

          <div className="flex shrink-0 gap-1.5 opacity-70 transition group-hover:opacity-100">
            <button
              type="button"
              onClick={(
                event,
              ) => {
                event.stopPropagation();
                onEdit();
              }}
              aria-label={`Edit ${place.name}`}
              title="Edit place"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-white/45 transition hover:border-white/[0.14] hover:bg-white/[0.08] hover:text-white"
            >
              <Pencil
                className="h-3.5 w-3.5"
                strokeWidth={1.8}
              />
            </button>

            <button
              type="button"
              onClick={(
                event,
              ) => {
                event.stopPropagation();
                onDelete();
              }}
              aria-label={`Delete ${place.name}`}
              title="Delete place"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-300/10 bg-rose-300/[0.025] text-rose-200/45 transition hover:border-rose-300/20 hover:bg-rose-300/[0.08] hover:text-rose-100"
            >
              <Trash2
                className="h-3.5 w-3.5"
                strokeWidth={1.8}
              />
            </button>
          </div>
        </div>

        {(coordinates ||
          place.website) && (
          <div className="relative mt-5 flex flex-wrap items-center gap-2">
            {coordinates && (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-black/10 px-3 py-1.5 font-mono text-[11px] text-white/40">
                <MapPin
                  className="h-3 w-3"
                  strokeWidth={1.8}
                />

                {
                  coordinates
                }
              </span>
            )}

            {place.website && (
              <a
                href={
                  place.website
                }
                target="_blank"
                rel="noreferrer"
                onClick={(
                  event,
                ) => {
                  event.stopPropagation();
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-black/10 px-3 py-1.5 text-[11px] text-sky-200/65 transition hover:border-sky-300/20 hover:bg-sky-300/[0.05] hover:text-sky-100"
              >
                Website

                <ExternalLink
                  className="h-3.5 w-3.5"
                  strokeWidth={1.7}
                />
              </a>
            )}
          </div>
        )}

        {place.notes && (
          <div className="relative mt-5 border-t border-white/[0.06] pt-4">
            <p className="line-clamp-3 text-sm leading-6 text-white/45">
              {
                place.notes
              }
            </p>
          </div>
        )}
      </div>

      <div className="relative flex items-center justify-between border-t border-white/[0.06] bg-black/[0.08] px-5 py-3.5">
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-white/25">
          <Icon
            className="h-3.5 w-3.5"
            strokeWidth={1.7}
          />

          Saved place
        </div>

        <span
          className={[
            'h-1.5 w-1.5 rounded-full',
            selected
              ? 'bg-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.7)]'
              : coordinates
                ? 'bg-emerald-300'
                : 'bg-white/20',
          ].join(' ')}
        />
      </div>
    </article>
  );
}

function LoadingState() {
  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="h-3 w-24 animate-pulse rounded-full bg-white/[0.06]" />
          <div className="mt-3 h-8 w-64 animate-pulse rounded-full bg-white/[0.05]" />
        </div>

        <div className="h-10 w-32 animate-pulse rounded-xl bg-white/[0.05]" />
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map(
          (item) => (
            <div
              key={item}
              className="h-24 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025]"
            />
          ),
        )}
      </div>

      <div className="mt-6 h-[600px] animate-pulse rounded-[1.75rem] border border-white/[0.06] bg-white/[0.025]" />
    </div>
  );
}

function EmptyPlaces({
  onAdd,
}: {
  onAdd: () => void;
}) {
  return (
    <div className="relative mt-7 overflow-hidden rounded-[2rem] border border-dashed border-white/10 bg-white/[0.018] px-6 py-16 text-center">
      <div className="pointer-events-none absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300/[0.07] blur-3xl" />

      <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-300/10 bg-sky-300/[0.045] text-sky-200">
        <MapPin
          className="h-6 w-6"
          strokeWidth={1.5}
        />
      </div>

      <p className="relative mt-6 text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-300/70">
        Saved places
      </p>

      <h3 className="relative mt-2 text-2xl font-semibold tracking-[-0.035em] text-white">
        Build your travel collection.
      </h3>

      <p className="relative mx-auto mt-3 max-w-md text-sm leading-6 text-white/40">
        Save restaurants,
        landmarks, hotels and
        discoveries before deciding
        exactly where they belong in
        your journey.
      </p>

      <button
        type="button"
        onClick={onAdd}
        className="relative mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
      >
        <Plus
          className="h-4 w-4"
          strokeWidth={1.9}
        />

        Add first place
      </button>
    </div>
  );
}

function NoResults() {
  return (
    <div className="rounded-[1.35rem] border border-dashed border-white/10 bg-white/[0.015] px-6 py-10 text-center">
      <Search
        className="mx-auto h-5 w-5 text-white/25"
        strokeWidth={1.6}
      />

      <p className="mt-4 text-sm font-medium text-white/65">
        No places match these
        filters.
      </p>

      <p className="mt-2 text-sm text-white/35">
        Try another category or a
        different search.
      </p>
    </div>
  );
}

function FieldLabel({
  children,
}: {
  children:
    ReactNode;
}) {
  return (
    <span className="text-xs font-medium text-white/60">
      {children}
    </span>
  );
}

function PlaceDialog({
  dialog,
  form,
  error,
  submitting,
  onChange,
  onClose,
  onSubmit,
}: {
  dialog:
    NonNullable<PlaceDialogState>;
  form:
    PlaceFormState;
  error:
    string | null;
  submitting:
    boolean;
  onChange: (
    next:
      PlaceFormState,
  ) => void;
  onClose:
    () => void;
  onSubmit:
    () => void;
}) {
  const isEditing =
    dialog.mode ===
    'edit';

  const [
    locationQuery,
    setLocationQuery,
  ] =
    useState('');

  const [
    searchResults,
    setSearchResults,
  ] =
    useState<GeocodingResult[]>(
      [],
    );

  const [
    searchAttribution,
    setSearchAttribution,
  ] =
    useState<string | null>(
      null,
    );

  const [
    searchError,
    setSearchError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    searching,
    setSearching,
  ] =
    useState(false);

  const [
    hasSearched,
    setHasSearched,
  ] =
    useState(false);

  async function searchLocation():
    Promise<void> {
    const query =
      locationQuery.trim();

    if (
      query.length < 3
    ) {
      setSearchError(
        'Enter at least 3 characters.',
      );

      return;
    }

    setSearching(
      true,
    );

    setSearchError(
      null,
    );

    setHasSearched(
      true,
    );

    try {
      const response =
        await fetch(
          `/api/geocoding/search?q=${encodeURIComponent(
            query,
          )}`,
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

      const payload =
        (await response.json()) as unknown;

      if (!response.ok) {
        setSearchResults(
          [],
        );

        setSearchAttribution(
          null,
        );

        setSearchError(
          getErrorMessage(
            payload,
          ),
        );

        return;
      }

      if (
        !isRecord(
          payload,
        ) ||
        !Array.isArray(
          payload['results'],
        )
      ) {
        setSearchResults(
          [],
        );

        setSearchAttribution(
          null,
        );

        setSearchError(
          'Geocoding service returned an invalid response.',
        );

        return;
      }

      const typedPayload =
        payload as unknown as GeocodingSearchResponse;

      setSearchResults(
        typedPayload.results,
      );

      setSearchAttribution(
        typedPayload.attribution,
      );
    } catch {
      setSearchResults(
        [],
      );

      setSearchAttribution(
        null,
      );

      setSearchError(
        'Unable to search locations right now.',
      );
    } finally {
      setSearching(
        false,
      );
    }
  }

  function selectSearchResult(
    result:
      GeocodingResult,
  ): void {
    onChange({
      ...form,

      name:
        result.name,

      category:
        inferPlaceCategory(
          result,
        ),

      address:
        result.displayName,

      latitude:
        String(
          result.latitude,
        ),

      longitude:
        String(
          result.longitude,
        ),

      website:
        result.website ??
        form.website,

      sourceProvider:
        result.provider,

      sourcePlaceId:
        result.providerPlaceId,
    });
  }

  const selectedSourceId =
    form.sourcePlaceId;

  const previewCoordinates =
    getPreviewCoordinates(
      form,
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={
        isEditing
          ? 'Edit place'
          : 'Add place'
      }
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#0c1118] shadow-[0_30px_120px_rgba(0,0,0,0.65)]">
        <div className="flex items-start justify-between border-b border-white/[0.07] px-6 py-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300/70">
              Saved place
            </p>

            <h3 className="mt-1.5 text-xl font-semibold tracking-[-0.03em] text-white">
              {isEditing
                ? 'Edit place'
                : 'Add a place'}
            </h3>

            <p className="mt-1 max-w-xl text-sm leading-6 text-white/35">
              Search for a real
              location or enter the
              details manually.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={
              submitting
            }
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/45 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
          >
            <X
              className="h-4 w-4"
              strokeWidth={1.8}
            />
          </button>
        </div>

        <div className="space-y-6 p-6">
          <section className="rounded-2xl border border-sky-300/10 bg-sky-300/[0.025] p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300/70">
                  Find a location
                </p>

                <p className="mt-1 text-xs leading-5 text-white/30">
                  Search OpenStreetMap
                  and select a result
                  to fill the place
                  details automatically.
                </p>
              </div>

              <MapPin
                className="h-5 w-5 shrink-0 text-sky-300/40"
                strokeWidth={1.6}
              />
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25"
                  strokeWidth={1.7}
                />

                <input
                  value={
                    locationQuery
                  }
                  onChange={(
                    event,
                  ) => {
                    setLocationQuery(
                      event.target.value,
                    );

                    if (
                      searchError
                    ) {
                      setSearchError(
                        null,
                      );
                    }
                  }}
                  onKeyDown={(
                    event,
                  ) => {
                    if (
                      event.key ===
                      'Enter'
                    ) {
                      event.preventDefault();

                      if (
                        !searching
                      ) {
                        void searchLocation();
                      }
                    }
                  }}
                  placeholder="Duomo di Milano"
                  className="w-full rounded-xl border border-white/[0.08] bg-black/10 py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-sky-300/30"
                />
              </div>

              <button
                type="button"
                disabled={
                  searching ||
                  locationQuery
                    .trim()
                    .length < 3
                }
                onClick={() => {
                  void searchLocation();
                }}
                className="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-xl border border-sky-300/15 bg-sky-300/[0.08] px-4 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-300/[0.12] disabled:cursor-not-allowed disabled:opacity-35"
              >
                {searching ? (
                  <>
                    <LoaderCircle
                      className="h-4 w-4 animate-spin"
                      strokeWidth={1.8}
                    />

                    Searching
                  </>
                ) : (
                  <>
                    <Search
                      className="h-4 w-4"
                      strokeWidth={1.8}
                    />

                    Search
                  </>
                )}
              </button>
            </div>

            {searchError && (
              <div className="mt-3 rounded-xl border border-rose-300/10 bg-rose-300/[0.04] px-3.5 py-2.5 text-xs text-rose-200/75">
                {
                  searchError
                }
              </div>
            )}

            {!searching &&
              hasSearched &&
              !searchError &&
              searchResults.length ===
                0 && (
                <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/10 px-4 py-5 text-center">
                  <MapPin
                    className="mx-auto h-4 w-4 text-white/25"
                    strokeWidth={1.6}
                  />

                  <p className="mt-2 text-xs text-white/40">
                    No matching
                    locations found.
                  </p>
                </div>
              )}

            {searchResults.length >
              0 && (
              <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.07] bg-black/10">
                {searchResults.map(
                  (
                    result,
                    index,
                  ) => {
                    const selected =
                      selectedSourceId ===
                      result.providerPlaceId;

                    return (
                      <button
                        key={`${result.provider}:${result.providerPlaceId}`}
                        type="button"
                        onClick={() => {
                          selectSearchResult(
                            result,
                          );
                        }}
                        className={[
                          'flex w-full items-start gap-3 px-4 py-4 text-left transition',
                          index > 0
                            ? 'border-t border-white/[0.06]'
                            : '',
                          selected
                            ? 'bg-sky-300/[0.07]'
                            : 'hover:bg-white/[0.035]',
                        ].join(
                          ' ',
                        )}
                      >
                        <div
                          className={[
                            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                            selected
                              ? 'border-sky-300/20 bg-sky-300/10 text-sky-200'
                              : 'border-white/[0.07] bg-white/[0.03] text-white/35',
                          ].join(
                            ' ',
                          )}
                        >
                          {selected ? (
                            <Check
                              className="h-4 w-4"
                              strokeWidth={2}
                            />
                          ) : (
                            <MapPin
                              className="h-4 w-4"
                              strokeWidth={1.7}
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-white">
                              {
                                result.name
                              }
                            </p>

                            {selected && (
                              <span className="rounded-full border border-sky-300/15 bg-sky-300/[0.06] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-sky-200/80">
                                Selected
                              </span>
                            )}
                          </div>

                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/35">
                            {
                              result.displayName
                            }
                          </p>

                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/25">
                            <span>
                              {result.latitude.toFixed(
                                4,
                              )}
                              ,{' '}
                              {result.longitude.toFixed(
                                4,
                              )}
                            </span>

                            {result.type && (
                              <span>
                                {
                                  result.type
                                }
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  },
                )}

                {searchAttribution && (
                  <div className="border-t border-white/[0.06] px-4 py-2.5 text-[9px] uppercase tracking-[0.12em] text-white/20">
                    {
                      searchAttribution
                    }
                  </div>
                )}
              </div>
            )}
          </section>

          {form.sourceProvider &&
            form.sourcePlaceId && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.035] px-4 py-3">
                <Check
                  className="h-4 w-4 shrink-0 text-emerald-300"
                  strokeWidth={2}
                />

                <div className="min-w-0">
                  <p className="text-xs font-medium text-emerald-100/80">
                    Location linked
                  </p>

                  <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.12em] text-emerald-200/35">
                    {
                      form.sourceProvider
                    }{' '}
                    ·{' '}
                    {
                      form.sourcePlaceId
                    }
                  </p>
                </div>
              </div>
            )}

            {previewCoordinates && (
              <GeocodingPreviewMap
                latitude={
                  previewCoordinates.latitude
                }
                longitude={
                  previewCoordinates.longitude
                }
                label={
                  form.name.trim() ||
                  'Selected location'
                }
              />
            )}

          <label className="block">
            <FieldLabel>
              Name
            </FieldLabel>

            <input
              value={
                form.name
              }
              onChange={(
                event,
              ) =>
                onChange({
                  ...form,
                  name:
                    event
                      .target
                      .value,
                })
              }
              maxLength={160}
              placeholder="Duomo di Milano"
              className="mt-2 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-sky-300/30"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <FieldLabel>
                Category
              </FieldLabel>

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
                      event
                        .target
                        .value as PlaceCategory,
                  })
                }
                className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#111720] px-4 py-3 text-sm text-white outline-none focus:border-sky-300/30"
              >
                {PLACE_CATEGORIES.map(
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
              <FieldLabel>
                Website
              </FieldLabel>

              <input
                type="url"
                value={
                  form.website
                }
                onChange={(
                  event,
                ) =>
                  onChange({
                    ...form,
                    website:
                      event
                        .target
                        .value,
                  })
                }
                maxLength={500}
                placeholder="https://..."
                className="mt-2 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-sky-300/30"
              />
            </label>
          </div>

          <label className="block">
            <FieldLabel>
              Address
            </FieldLabel>

            <input
              value={
                form.address
              }
              onChange={(
                event,
              ) =>
                onChange({
                  ...form,
                  address:
                    event
                      .target
                      .value,
                })
              }
              maxLength={300}
              placeholder="Piazza del Duomo, Milano"
              className="mt-2 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-sky-300/30"
            />
          </label>

          <div>
            <div className="flex items-center justify-between">
              <FieldLabel>
                Coordinates
              </FieldLabel>

              <span className="text-[10px] uppercase tracking-[0.16em] text-white/20">
                Advanced
              </span>
            </div>

            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              <input
                type="number"
                step="any"
                value={
                  form.latitude
                }
                onChange={(
                  event,
                ) =>
                  onChange({
                    ...form,
                    latitude:
                      event
                        .target
                        .value,
                  })
                }
                placeholder="Latitude · 45.4642"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 font-mono text-sm text-white outline-none placeholder:font-sans placeholder:text-white/20 focus:border-sky-300/30"
              />

              <input
                type="number"
                step="any"
                value={
                  form.longitude
                }
                onChange={(
                  event,
                ) =>
                  onChange({
                    ...form,
                    longitude:
                      event
                        .target
                        .value,
                  })
                }
                placeholder="Longitude · 9.1916"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 font-mono text-sm text-white outline-none placeholder:font-sans placeholder:text-white/20 focus:border-sky-300/30"
              />
            </div>

            <p className="mt-2 text-xs leading-5 text-white/25">
              Usually filled
              automatically when a
              search result is
              selected.
            </p>
          </div>

          <label className="block">
            <FieldLabel>
              Notes
            </FieldLabel>

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
                    event
                      .target
                      .value,
                })
              }
              maxLength={2000}
              rows={4}
              placeholder="Reservations, best time to visit, reminders..."
              className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/20 focus:border-sky-300/30"
            />
          </label>

          {error && (
            <div className="rounded-xl border border-rose-300/10 bg-rose-300/[0.04] px-4 py-3 text-sm text-rose-200/80">
              {error}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-white/[0.07] px-6 py-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={
              submitting
            }
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={
              submitting ||
              form.name
                .trim()
                .length ===
                0
            }
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting
              ? 'Saving...'
              : isEditing
                ? 'Save changes'
                : 'Add place'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteDialog({
  place,
  deleting,
  error,
  onCancel,
  onConfirm,
}: {
  place: Place;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-label="Delete place"
    >
      <div className="w-full max-w-md rounded-[26px] border border-white/10 bg-[#0c1118] p-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-300/10 bg-rose-300/[0.05] text-rose-200">
          <Trash2
            className="h-5 w-5"
            strokeWidth={1.6}
          />
        </div>

        <h3 className="mt-5 text-xl font-semibold text-white">
          Delete place?
        </h3>

        <p className="mt-2 text-sm leading-6 text-white/45">
          “{place.name}” will be
          permanently removed from
          this journey.
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
            disabled={
              deleting
            }
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={
              deleting
            }
            className="rounded-xl border border-rose-300/15 bg-rose-300/[0.08] px-4 py-2.5 text-sm font-semibold text-rose-100"
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

export function PlacesPanel({
  tripId,
}: PlacesPanelProps) {
  const [
    state,
    setState,
  ] =
    useState<PlacesState>({
      status: 'loading',
      places: [],
      error: null,
    });

  const [
    search,
    setSearch,
  ] =
    useState('');

  const [
    categoryFilter,
    setCategoryFilter,
  ] =
    useState<CategoryFilter>(
      'ALL',
    );

  const [
    selectedPlaceId,
    setSelectedPlaceId,
  ] =
    useState<string | null>(
      null,
    );

  const placeCardRefs =
    useRef<
      Map<string, HTMLElement>
    >(
      new Map(),
    );

  const [
    dialog,
    setDialog,
  ] =
    useState<PlaceDialogState>(
      null,
    );

  const [
    form,
    setForm,
  ] =
    useState<PlaceFormState>(
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
    useState<Place | null>(
      null,
    );

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

  async function reloadPlaces():
    Promise<PlacesState> {
    const nextState =
      await fetchPlacesState(
        tripId,
      );

    setState(
      nextState,
    );

    return nextState;
  }

  useEffect(() => {
    let cancelled =
      false;

    void fetchPlacesState(
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

  const visiblePlaces =
    useMemo(() => {
      if (
        state.status !==
        'success'
      ) {
        return [];
      }

      const normalizedSearch =
        search
          .trim()
          .toLocaleLowerCase();

      return state.places.filter(
        (place) => {
          if (
            categoryFilter !==
              'ALL' &&
            place.category !==
              categoryFilter
          ) {
            return false;
          }

          if (
            !normalizedSearch
          ) {
            return true;
          }

          const searchable =
            [
              place.name,
              place.address,
              place.notes,
              CATEGORY_META[
                place.category
              ].label,
            ]
              .filter(
                (
                  value,
                ): value is string =>
                  typeof value ===
                  'string',
              )
              .join(' ')
              .toLocaleLowerCase();

          return searchable.includes(
            normalizedSearch,
          );
        },
      );
    }, [
      categoryFilter,
      search,
      state,
    ]);

  const mappedCount =
    useMemo(() => {
      if (
        state.status !==
        'success'
      ) {
        return 0;
      }

      return state.places.filter(
        (place) =>
          place.latitude !==
            null &&
          place.longitude !==
            null,
      ).length;
    }, [state]);

  const categoryCount =
    useMemo(() => {
      if (
        state.status !==
        'success'
      ) {
        return 0;
      }

      return new Set(
        state.places.map(
          (place) =>
            place.category,
        ),
      ).size;
    }, [state]);

  useEffect(() => {
    if (
      !selectedPlaceId
    ) {
      return;
    }

    const frame =
      window.requestAnimationFrame(
        () => {
          const card =
            placeCardRefs.current.get(
              selectedPlaceId,
            );

          card?.scrollIntoView({
            behavior:
              'smooth',

            block:
              'nearest',

            inline:
              'nearest',
          });
        },
      );

    return () => {
      window.cancelAnimationFrame(
        frame,
      );
    };
  }, [
    selectedPlaceId,
    visiblePlaces,
  ]);

  function registerPlaceCard(
    placeId: string,
    element:
      HTMLElement | null,
  ): void {
    if (element) {
      placeCardRefs.current.set(
        placeId,
        element,
      );

      return;
    }

    placeCardRefs.current.delete(
      placeId,
    );
  }

  function openCreate() {
    setForm({
      ...EMPTY_FORM,
    });

    setFormError(
      null,
    );

    setDialog({
      mode: 'create',
    });
  }

  function openEdit(
    place: Place,
  ) {
    setForm(
      placeToForm(
        place,
      ),
    );

    setFormError(
      null,
    );

    setDialog({
      mode: 'edit',
      place,
    });
  }

  function closeDialog() {
    if (submitting) {
      return;
    }

    setDialog(
      null,
    );

    setFormError(
      null,
    );
  }

  async function submitPlace():
    Promise<void> {
    if (!dialog) {
      return;
    }

    const name =
      form.name.trim();

    if (!name) {
      setFormError(
        'Place name is required.',
      );

      return;
    }

    if (
      !isValidWebsite(
        form.website,
      )
    ) {
      setFormError(
        'Website must be a valid http or https URL.',
      );

      return;
    }

    const coordinates =
      parseCoordinates(
        form.latitude,
        form.longitude,
      );

    if (
      !coordinates.ok
    ) {
      setFormError(
        coordinates.message,
      );

      return;
    }

    const payload = {
      name,

      category:
        form.category,

      address:
        nullableText(
          form.address,
        ),

      latitude:
        coordinates.latitude,

      longitude:
        coordinates.longitude,

      website:
        nullableText(
          form.website,
        ),

      notes:
        nullableText(
          form.notes,
        ),

      sourceProvider:
        form.sourceProvider,

      sourcePlaceId:
        form.sourcePlaceId,
    };

    setSubmitting(
      true,
    );

    setFormError(
      null,
    );

    try {
      const isEditing =
        dialog.mode ===
        'edit';

      const path =
        isEditing
          ? `/api/trips/${encodeURIComponent(
              tripId,
            )}/places/${encodeURIComponent(
              dialog.place.id,
            )}`
          : `/api/trips/${encodeURIComponent(
              tripId,
            )}/places`;

      const body:
        | CreatePlaceInput
        | UpdatePlaceInput =
        payload;

      const response =
        await fetch(
          path,
          {
            method:
              isEditing
                ? 'PATCH'
                : 'POST',

            headers: {
              'content-type':
                'application/json',
            },

            body:
              JSON.stringify(
                body,
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
        setFormError(
          getErrorMessage(
            responsePayload,
          ),
        );

        return;
      }

      setDialog(
        null,
      );

      setForm({
        ...EMPTY_FORM,
      });

      await reloadPlaces();
    } catch {
      setFormError(
        'Unable to save this place right now.',
      );
    } finally {
      setSubmitting(
        false,
      );
    }
  }

  async function confirmDelete():
    Promise<void> {
    if (!deleteTarget) {
      return;
    }

    const deletingPlaceId =
      deleteTarget.id;

    setDeleting(
      true,
    );

    setDeleteError(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/trips/${encodeURIComponent(
            tripId,
          )}/places/${encodeURIComponent(
            deletingPlaceId,
          )}`,
          {
            method:
              'DELETE',
          },
        );

      if (!response.ok) {
        let payload:
          unknown = null;

        try {
          payload =
            (await response.json()) as unknown;
        } catch {
          payload =
            null;
        }

        setDeleteError(
          getErrorMessage(
            payload,
          ),
        );

        return;
      }

      if (
        selectedPlaceId ===
        deletingPlaceId
      ) {
        setSelectedPlaceId(
          null,
        );
      }

      setDeleteTarget(
        null,
      );

      await reloadPlaces();
    } catch {
      setDeleteError(
        'Unable to delete this place right now.',
      );
    } finally {
      setDeleting(
        false,
      );
    }
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
      <div className="rounded-[1.75rem] border border-rose-300/10 bg-rose-300/[0.035] p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-200">
          Couldn&apos;t load places
        </p>

        <p className="mt-3 text-sm text-slate-400">
          {state.error}
        </p>

        <button
          type="button"
          onClick={() => {
            setState({
              status:
                'loading',
              places: [],
              error:
                null,
            });

            void reloadPlaces();
          }}
          className="mt-6 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  const totalPlaces =
    state.places.length;

  return (
    <>
      <section>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
                Places
              </p>

              <span className="rounded-full border border-white/[0.07] bg-white/[0.035] px-2.5 py-1 text-[10px] text-white/40">
                {totalPlaces}{' '}
                {totalPlaces === 1
                  ? 'place'
                  : 'places'}
              </span>
            </div>

            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">
              Places worth the detour.
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              Collect restaurants,
              landmarks, hotels and
              discoveries before
              deciding exactly where
              they belong in the
              journey.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
          >
            <Plus
              className="h-4 w-4"
            />

            Add place
          </button>
        </div>

        {totalPlaces > 0 && (
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">
                Saved
              </p>

              <p className="mt-3 text-2xl font-semibold text-white">
                {totalPlaces}
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">
                Ready for map
              </p>

              <p className="mt-3 text-2xl font-semibold text-white">
                {mappedCount}
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">
                Categories
              </p>

              <p className="mt-3 text-2xl font-semibold text-white">
                {categoryCount}
              </p>
            </div>
          </div>
        )}

        {totalPlaces === 0 ? (
          <EmptyPlaces
            onAdd={openCreate}
          />
        ) : (
          <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(320px,0.72fr)_minmax(0,1.28fr)]">
            <aside className="min-w-0 overflow-hidden rounded-[1.65rem] border border-white/[0.07] bg-white/[0.018]">
              <div className="border-b border-white/[0.06] px-5 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-sky-300/60">
                      Collection
                    </p>

                    <h3 className="mt-1 text-lg font-semibold text-white">
                      Saved places
                    </h3>
                  </div>

                  <span className="text-[10px] uppercase tracking-[0.16em] text-white/25">
                    {visiblePlaces.length}{' '}
                    shown
                  </span>
                </div>
              </div>

              <div className="space-y-4 p-4">
                <div className="relative">
                  <Search
                    className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30"
                  />

                  <input
                    type="search"
                    value={search}
                    onChange={(
                      event,
                    ) =>
                      setSearch(
                        event.target.value,
                      )
                    }
                    placeholder="Search places..."
                    className="w-full rounded-xl border border-white/[0.08] bg-black/10 py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/20"
                  />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() =>
                      setCategoryFilter(
                        'ALL',
                      )
                    }
                    className={[
                      'shrink-0 rounded-full border px-3 py-1.5 text-xs transition',
                      categoryFilter ===
                      'ALL'
                        ? 'border-white/20 bg-white/[0.1] text-white'
                        : 'border-white/[0.07] text-white/40',
                    ].join(' ')}
                  >
                    All
                  </button>

                  {PLACE_CATEGORIES.map(
                    (
                      category,
                    ) => {
                      const meta =
                        CATEGORY_META[
                          category
                        ];

                      const Icon =
                        meta.icon;

                      const active =
                        categoryFilter ===
                        category;

                      return (
                        <button
                          key={
                            category
                          }
                          type="button"
                          onClick={() =>
                            setCategoryFilter(
                              category,
                            )
                          }
                          className={[
                            'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition',
                            active
                              ? meta.badgeClassName
                              : 'border-white/[0.07] text-white/40',
                          ].join(
                            ' ',
                          )}
                        >
                          <Icon
                            className="h-3.5 w-3.5"
                          />

                          {
                            meta.filterLabel
                          }
                        </button>
                      );
                    },
                  )}
                </div>
              </div>

              <div className="border-t border-white/[0.06]">
                {visiblePlaces.length ===
                0 ? (
                  <div className="p-4">
                    <NoResults />
                  </div>
                ) : (
                  <div className="max-h-[620px] space-y-3 overflow-y-auto p-4">
                    {visiblePlaces.map(
                      (place) => (
                        <PlaceCard
                          key={
                            place.id
                          }
                          place={
                            place
                          }
                          selected={
                            selectedPlaceId ===
                            place.id
                          }
                          cardRef={(
                            element,
                          ) => {
                            registerPlaceCard(
                              place.id,
                              element,
                            );
                          }}
                          onSelect={() => {
                            setSelectedPlaceId(
                              place.id,
                            );
                          }}
                          onEdit={() =>
                            openEdit(
                              place,
                            )
                          }
                          onDelete={() => {
                            setDeleteError(
                              null,
                            );

                            setDeleteTarget(
                              place,
                            );
                          }}
                        />
                      ),
                    )}
                  </div>
                )}
              </div>
            </aside>

            <div className="min-w-0 lg:sticky lg:top-6">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-sky-300/60">
                    Explore
                  </p>

                  <h3 className="mt-1 text-lg font-semibold text-white">
                    Journey map
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />

                  <span className="text-[10px] uppercase tracking-[0.16em] text-white/25">
                    Interactive
                  </span>
                </div>
              </div>

              <MeridianMap
                places={
                  state.places
                }
                selectedPlaceId={
                  selectedPlaceId
                }
                onSelectPlace={(
                  placeId,
                ) => {
                  setSearch(
                    '',
                  );

                  setCategoryFilter(
                    'ALL',
                  );

                  setSelectedPlaceId(
                    placeId,
                  );
                }}
                heightClassName="h-[460px] sm:h-[520px] lg:h-[650px]"
              />

              <div className="mt-3 flex items-center justify-between px-1">
                <p className="text-xs text-white/25">
                  {mappedCount}{' '}
                  {mappedCount === 1
                    ? 'place has'
                    : 'places have'}{' '}
                  coordinates.
                </p>

                <p className="text-[10px] uppercase tracking-[0.15em] text-white/20">
                  MapLibre
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {dialog && (
        <PlaceDialog
          dialog={dialog}
          form={form}
          error={formError}
          submitting={
            submitting
          }
          onChange={setForm}
          onClose={
            closeDialog
          }
          onSubmit={() => {
            void submitPlace();
          }}
        />
      )}

      {deleteTarget && (
        <DeleteDialog
          place={
            deleteTarget
          }
          deleting={
            deleting
          }
          error={
            deleteError
          }
          onCancel={() => {
            if (deleting) {
              return;
            }

            setDeleteTarget(
              null,
            );

            setDeleteError(
              null,
            );
          }}
          onConfirm={() => {
            void confirmDelete();
          }}
        />
      )}
    </>
  );
}