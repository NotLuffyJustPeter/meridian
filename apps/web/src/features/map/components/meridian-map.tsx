'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Compass,
  Hotel,
  Landmark,
  Map as MapIcon,
  MapPin,
  ShoppingBag,
  Sparkles,
  TrainFront,
  Trees,
  Utensils,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';

import type {
  Place,
  PlaceCategory,
} from '../../places/types/place.types';

import 'maplibre-gl/dist/maplibre-gl.css';

interface MeridianMapProps {
  places?: Place[];
  selectedPlaceId?: string | null;
  onSelectPlace?: (
    placeId: string,
  ) => void;
  className?: string;
  heightClassName?: string;
}

type MapState =
  | 'loading'
  | 'ready'
  | 'error';

type MappedPlace =
  Place & {
    latitude: number;
    longitude: number;
  };

type MarkerEntry = {
  marker: import('maplibre-gl').Marker;
  popup: import('maplibre-gl').Popup;
  element: HTMLButtonElement;
  iconRoot: Root;
  category: PlaceCategory;
};

const MAP_STYLE =
  'https://tiles.openfreemap.org/styles/liberty';

const MARKER_BASE_CLASS =
  'flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 p-0 text-white transition-[box-shadow,border-color,filter] duration-200 hover:brightness-110';

function getMarkerColor(
  category: PlaceCategory,
): string {
  switch (category) {
    case 'LANDMARK':
      return '#8b5cf6';

    case 'FOOD':
      return '#f59e0b';

    case 'LODGING':
      return '#10b981';

    case 'SHOPPING':
      return '#ec4899';

    case 'TRANSPORT':
      return '#0ea5e9';

    case 'ENTERTAINMENT':
      return '#d946ef';

    case 'NATURE':
      return '#14b8a6';

    case 'OTHER':
      return '#64748b';
  }
}

function getMarkerIcon(
  category: PlaceCategory,
): LucideIcon {
  switch (category) {
    case 'LANDMARK':
      return Landmark;

    case 'FOOD':
      return Utensils;

    case 'LODGING':
      return Hotel;

    case 'SHOPPING':
      return ShoppingBag;

    case 'TRANSPORT':
      return TrainFront;

    case 'ENTERTAINMENT':
      return Sparkles;

    case 'NATURE':
      return Trees;

    case 'OTHER':
      return MapPin;
  }
}

function getCategoryLabel(
  category: PlaceCategory,
): string {
  switch (category) {
    case 'LANDMARK':
      return 'Landmark';

    case 'FOOD':
      return 'Food';

    case 'LODGING':
      return 'Lodging';

    case 'SHOPPING':
      return 'Shopping';

    case 'TRANSPORT':
      return 'Transport';

    case 'ENTERTAINMENT':
      return 'Entertainment';

    case 'NATURE':
      return 'Nature';

    case 'OTHER':
      return 'Other';
  }
}

function setMarkerSelected(
  element: HTMLButtonElement,
  selected: boolean,
): void {
  if (selected) {
    element.style.boxShadow =
      '0 0 0 5px rgba(255,255,255,0.22), 0 12px 32px rgba(0,0,0,0.48)';

    element.style.borderColor =
      'rgba(255,255,255,1)';

    element.style.filter =
      'brightness(1.08)';

    element.style.zIndex =
      '5';

    return;
  }

  element.style.boxShadow =
    '0 8px 24px rgba(0,0,0,0.38)';

  element.style.borderColor =
    'rgba(255,255,255,0.9)';

  element.style.filter =
    'brightness(1)';

  element.style.zIndex =
    '1';
}

function disposeMarkerEntry(
  entry: MarkerEntry,
): void {
  entry.popup.remove();
  entry.marker.remove();

  // React 19 can warn when a nested root is synchronously
  // unmounted while the parent tree is still rendering.
  // Deferring the root cleanup one task keeps MapLibre DOM
  // cleanup immediate without racing React's render phase.
  window.setTimeout(() => {
    entry.iconRoot.unmount();
  }, 0);
}

function createPopupContent(
  place: MappedPlace,
): HTMLDivElement {
  const root =
    document.createElement(
      'div',
    );

  root.className =
    'min-w-[210px]';

  const eyebrow =
    document.createElement(
      'p',
    );

  eyebrow.className =
    'text-[9px] font-semibold uppercase tracking-[0.18em] text-sky-300/70';

  eyebrow.textContent =
    getCategoryLabel(
      place.category,
    );

  const title =
    document.createElement(
      'p',
    );

  title.className =
    'mt-1.5 pr-6 text-sm font-semibold text-white';

  title.textContent =
    place.name;

  root.append(
    eyebrow,
    title,
  );

  if (place.address) {
    const address =
      document.createElement(
        'p',
      );

    address.className =
      'mt-2 text-xs leading-5 text-slate-400';

    address.textContent =
      place.address;

    root.appendChild(
      address,
    );
  }

  const coordinates =
    document.createElement(
      'p',
    );

  coordinates.className =
    'mt-3 font-mono text-[10px] text-slate-500';

  coordinates.textContent =
    `${place.latitude.toFixed(
      4,
    )}, ${place.longitude.toFixed(
      4,
    )}`;

  root.appendChild(
    coordinates,
  );

  if (place.website) {
    const link =
      document.createElement(
        'a',
      );

    link.href =
      place.website;

    link.target =
      '_blank';

    link.rel =
      'noreferrer';

    link.className =
      'mt-3 inline-flex text-xs font-medium text-sky-300 transition hover:text-sky-200';

    link.textContent =
      'Open website ↗';

    root.appendChild(
      link,
    );
  }

  return root;
}

export function MeridianMap({
  places = [],
  selectedPlaceId = null,
  onSelectPlace,
  className = '',
  heightClassName =
    'h-[420px] sm:h-[480px] lg:h-[520px]',
}: MeridianMapProps) {
  const containerRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const mapRef =
    useRef<
      import('maplibre-gl').Map | null
    >(null);

  const markerRefs =
    useRef<
      Map<string, MarkerEntry>
    >(
      new Map(),
    );

  const onSelectPlaceRef =
    useRef<
      MeridianMapProps['onSelectPlace']
    >(
      onSelectPlace,
    );

  const selectedPlaceIdRef =
    useRef<string | null>(
      selectedPlaceId,
    );

  const [
    state,
    setState,
  ] =
    useState<MapState>(
      'loading',
    );

  const mappedPlaces =
    useMemo<MappedPlace[]>(
      () =>
        places.filter(
          (
            place,
          ): place is MappedPlace =>
            place.latitude !==
              null &&
            place.longitude !==
              null,
        ),
      [places],
    );

  useEffect(() => {
    onSelectPlaceRef.current =
      onSelectPlace;
  }, [onSelectPlace]);

  useEffect(() => {
    selectedPlaceIdRef.current =
      selectedPlaceId;
  }, [selectedPlaceId]);

  useEffect(() => {
    const markerStore =
      markerRefs.current;

    const container =
      containerRef.current;

    if (
      !container ||
      mapRef.current
    ) {
      return;
    }

    let cancelled =
      false;

    async function initializeMap() {
      try {
        const maplibregl =
          await import(
            'maplibre-gl'
          );

        if (
          cancelled ||
          !containerRef.current
        ) {
          return;
        }

        const map =
          new maplibregl.Map({
            container:
              containerRef.current,

            style:
              MAP_STYLE,

            center: [
              -102,
              23,
            ],

            zoom: 4,

            minZoom: 1,

            dragRotate:
              false,

            pitchWithRotate:
              false,
          });

        mapRef.current =
          map;

        map.addControl(
          new maplibregl.NavigationControl({
            showCompass:
              false,

            visualizePitch:
              false,
          }),
          'top-right',
        );

        map.addControl(
          new maplibregl.FullscreenControl(),
          'top-right',
        );

        map.addControl(
          new maplibregl.ScaleControl({
            unit: 'metric',
          }),
          'bottom-left',
        );

        map.once(
          'style.load',
          () => {
            if (
              cancelled
            ) {
              return;
            }

            setState(
              'ready',
            );

            window.requestAnimationFrame(
              () => {
                map.resize();
              },
            );
          },
        );

        map.on(
          'error',
          (event) => {
            console.error(
              'MapLibre error:',
              event.error,
            );
          },
        );
      } catch (
        error
      ) {
        console.error(
          'Unable to initialize map:',
          error,
        );

        if (
          !cancelled
        ) {
          setState(
            'error',
          );
        }
      }
    }

    void initializeMap();

    return () => {
      cancelled =
        true;

      markerStore.forEach(
        (entry) => {
          disposeMarkerEntry(
            entry,
          );
        },
      );

      markerStore.clear();

      mapRef.current?.remove();

      mapRef.current =
        null;
    };
  }, []);

  /*
   * Important for responsive layouts.
   *
   * MapLibre may initialize while the container is hidden
   * by the mobile Places / Map switcher. ResizeObserver
   * makes it recalculate its canvas as soon as the panel
   * becomes visible again.
   */
  useEffect(() => {
    if (
      state !==
      'ready'
    ) {
      return;
    }

    const container =
      containerRef.current;

    const map =
      mapRef.current;

    if (
      !container ||
      !map ||
      typeof ResizeObserver ===
        'undefined'
    ) {
      return;
    }

    const observer =
      new ResizeObserver(
        () => {
          if (
            container.clientWidth <=
              0 ||
            container.clientHeight <=
              0
          ) {
            return;
          }

          window.requestAnimationFrame(
            () => {
              map.resize();
            },
          );
        },
      );

    observer.observe(
      container,
    );

    return () => {
      observer.disconnect();
    };
  }, [state]);

  useEffect(() => {
    if (
      state !==
      'ready'
    ) {
      return;
    }

    let cancelled =
      false;

    async function renderMarkers() {
      const maplibregl =
        await import(
          'maplibre-gl'
        );

      const currentMap =
        mapRef.current;

      if (
        cancelled ||
        !currentMap
      ) {
        return;
      }

      markerRefs.current.forEach(
        (entry) => {
          disposeMarkerEntry(
            entry,
          );
        },
      );

      markerRefs.current.clear();

      if (
        mappedPlaces.length ===
        0
      ) {
        return;
      }

      const bounds =
        new maplibregl.LngLatBounds();

      mappedPlaces.forEach(
        (place) => {
          const element =
            document.createElement(
              'button',
            );

          element.type =
            'button';

          element.className =
            MARKER_BASE_CLASS;

          element.style.backgroundColor =
            getMarkerColor(
              place.category,
            );

          const isSelected =
            place.id ===
            selectedPlaceIdRef.current;

          setMarkerSelected(
            element,
            isSelected,
          );

          element.setAttribute(
            'aria-label',
            `View ${place.name}`,
          );

          element.title =
            place.name;

          const iconHost =
            document.createElement(
              'span',
            );

          iconHost.className =
            'pointer-events-none flex h-4 w-4 items-center justify-center';

          element.appendChild(
            iconHost,
          );

          const Icon =
            getMarkerIcon(
              place.category,
            );

          const iconRoot =
            createRoot(
              iconHost,
            );

          iconRoot.render(
            <Icon
              className="h-4 w-4 text-white"
              strokeWidth={2}
              aria-hidden="true"
            />,
          );

          const popup =
            new maplibregl.Popup({
              offset: 24,

              closeButton:
                true,

              closeOnClick:
                false,

              className:
                'meridian-map-popup',
            }).setDOMContent(
              createPopupContent(
                place,
              ),
            );

          const marker =
            new maplibregl.Marker({
              element,

              anchor:
                'center',
            })
              .setLngLat([
                place.longitude,
                place.latitude,
              ])
              .setPopup(
                popup,
              )
              .addTo(
                currentMap,
              );

          element.addEventListener(
            'click',
            () => {
              onSelectPlaceRef.current?.(
                place.id,
              );
            },
          );

          markerRefs.current.set(
            place.id,
            {
              marker,
              popup,
              element,
              iconRoot,
              category:
                place.category,
            },
          );

          bounds.extend([
            place.longitude,
            place.latitude,
          ]);
        },
      );

      const selectedId =
        selectedPlaceIdRef.current;

      if (selectedId) {
        const selectedPlace =
          mappedPlaces.find(
            (place) =>
              place.id ===
              selectedId,
          );

        const selectedEntry =
          markerRefs.current.get(
            selectedId,
          );

        if (
          selectedPlace &&
          selectedEntry
        ) {
          currentMap.easeTo({
            center: [
              selectedPlace.longitude,
              selectedPlace.latitude,
            ],

            zoom: Math.max(
              currentMap.getZoom(),
              14,
            ),

            duration: 700,
          });

          if (
            !selectedEntry.popup.isOpen()
          ) {
            selectedEntry.marker.togglePopup();
          }

          return;
        }
      }

      if (
        mappedPlaces.length ===
        1
      ) {
        const place =
          mappedPlaces[0];

        currentMap.easeTo({
          center: [
            place.longitude,
            place.latitude,
          ],

          zoom: 13,

          duration: 900,
        });

        return;
      }

      currentMap.fitBounds(
        bounds,
        {
          padding: {
            top: 80,
            right: 80,
            bottom: 80,
            left: 80,
          },

          maxZoom: 14,

          duration: 1000,
        },
      );
    }

    void renderMarkers();

    return () => {
      cancelled =
        true;
    };
  }, [
    mappedPlaces,
    state,
  ]);

  useEffect(() => {
    if (
      state !==
      'ready'
    ) {
      return;
    }

    markerRefs.current.forEach(
      (
        entry,
        placeId,
      ) => {
        const selected =
          placeId ===
          selectedPlaceId;

        setMarkerSelected(
          entry.element,
          selected,
        );

        if (
          !selected &&
          entry.popup.isOpen()
        ) {
          entry.popup.remove();
        }
      },
    );

    if (
      !selectedPlaceId
    ) {
      return;
    }

    const currentMap =
      mapRef.current;

    if (!currentMap) {
      return;
    }

    const place =
      mappedPlaces.find(
        (item) =>
          item.id ===
          selectedPlaceId,
      );

    if (!place) {
      return;
    }

    currentMap.flyTo({
      center: [
        place.longitude,
        place.latitude,
      ],

      zoom: Math.max(
        currentMap.getZoom(),
        14,
      ),

      duration: 900,

      essential: true,
    });

    const entry =
      markerRefs.current.get(
        selectedPlaceId,
      );

    if (
      entry &&
      !entry.popup.isOpen()
    ) {
      entry.marker.togglePopup();
    }
  }, [
    mappedPlaces,
    selectedPlaceId,
    state,
  ]);

  return (
    <section
      className={[
        'relative overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#081018]',
        className,
      ].join(' ')}
    >
      <div
        ref={
          containerRef
        }
        className={[
          'w-full',
          heightClassName,
        ].join(' ')}
      />

      {state ===
        'loading' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#081018]">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-300/10 bg-sky-300/[0.05] text-sky-200">
              <Compass
                className="h-5 w-5 animate-pulse"
                strokeWidth={
                  1.6
                }
              />
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
              Loading map
            </p>

            <p className="mt-2 text-xs text-white/25">
              Preparing your
              journey view...
            </p>
          </div>
        </div>
      )}

      {state ===
        'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#081018] p-6">
          <div className="max-w-sm text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-300/10 bg-rose-300/[0.05] text-rose-200">
              <MapIcon
                className="h-5 w-5"
                strokeWidth={
                  1.6
                }
              />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-white">
              Map unavailable
            </h3>

            <p className="mt-2 text-xs leading-5 text-white/35">
              Meridian could not
              load the map tiles.
              Check your connection
              and try again.
            </p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute left-4 top-4 z-10">
        <div className="rounded-xl border border-white/10 bg-[#081018]/85 px-3.5 py-2.5 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Compass
              className="h-4 w-4 text-sky-200"
              strokeWidth={
                1.6
              }
            />

            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
              Meridian Map
            </span>
          </div>
        </div>
      </div>

      {state ===
        'ready' &&
        mappedPlaces.length >
          0 && (
          <div className="pointer-events-none absolute bottom-4 right-4 z-10">
            <div className="rounded-xl border border-white/10 bg-[#081018]/85 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.15em] text-white/45 shadow-xl backdrop-blur-md">
              {
                mappedPlaces.length
              }{' '}
              {mappedPlaces.length ===
              1
                ? 'mapped place'
                : 'mapped places'}
            </div>
          </div>
        )}
    </section>
  );
}