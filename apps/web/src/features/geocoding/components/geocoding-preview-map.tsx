'use client';

import {
  Crosshair,
  MapPin,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import 'maplibre-gl/dist/maplibre-gl.css';

interface GeocodingPreviewMapProps {
  latitude: number;
  longitude: number;
  label?: string;
}

type PreviewMapState =
  | 'loading'
  | 'ready'
  | 'error';

const MAP_STYLE =
  'https://tiles.openfreemap.org/styles/liberty';

export function GeocodingPreviewMap({
  latitude,
  longitude,
  label = 'Selected location',
}: GeocodingPreviewMapProps) {
  const containerRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const mapRef =
    useRef<
      import('maplibre-gl').Map | null
    >(null);

  const markerRef =
    useRef<
      import('maplibre-gl').Marker | null
    >(null);

  /*
   * El mapa solamente necesita estas coordenadas
   * para su creación inicial.
   *
   * Después, el segundo useEffect mueve el mapa
   * cuando latitude/longitude cambian.
   */
  const initialPositionRef =
    useRef({
      latitude,
      longitude,
    });

  const [
    state,
    setState,
  ] =
    useState<PreviewMapState>(
      'loading',
    );

  useEffect(() => {
    const container =
      containerRef.current;

    if (
      !container ||
      mapRef.current
    ) {
      return;
    }

    const initialPosition =
      initialPositionRef.current;

    let cancelled =
      false;

    let mapInstance:
      import('maplibre-gl').Map | null =
      null;

    let markerInstance:
      import('maplibre-gl').Marker | null =
      null;

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
              initialPosition.longitude,
              initialPosition.latitude,
            ],

            zoom: 14,

            minZoom: 2,

            maxZoom: 18,

            dragRotate:
              false,

            pitchWithRotate:
              false,

            scrollZoom:
              false,
          });

        mapInstance =
          map;

        mapRef.current =
          map;

        const markerElement =
          document.createElement(
            'div',
          );

        markerElement.className =
          'flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-sky-500 shadow-[0_10px_30px_rgba(0,0,0,0.4)]';

        const markerDot =
          document.createElement(
            'div',
          );

        markerDot.className =
          'h-2.5 w-2.5 rounded-full bg-white';

        markerElement.appendChild(
          markerDot,
        );

        const marker =
          new maplibregl.Marker({
            element:
              markerElement,

            anchor:
              'center',
          })
            .setLngLat([
              initialPosition.longitude,
              initialPosition.latitude,
            ])
            .addTo(
              map,
            );

        markerInstance =
          marker;

        markerRef.current =
          marker;

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
              'Geocoding preview map error:',
              event.error,
            );
          },
        );
      } catch (
        error
      ) {
        console.error(
          'Unable to initialize geocoding preview map:',
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

      markerInstance?.remove();

      mapInstance?.remove();

      markerRef.current =
        null;

      mapRef.current =
        null;
    };
  }, []);

  useEffect(() => {
    if (
      state !==
      'ready'
    ) {
      return;
    }

    const map =
      mapRef.current;

    const marker =
      markerRef.current;

    if (
      !map ||
      !marker
    ) {
      return;
    }

    marker.setLngLat([
      longitude,
      latitude,
    ]);

    map.easeTo({
      center: [
        longitude,
        latitude,
      ],

      zoom:
        Math.max(
          map.getZoom(),
          14,
        ),

      duration: 650,
    });
  }, [
    latitude,
    longitude,
    state,
  ]);

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081018]">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-300/10 bg-sky-300/[0.05] text-sky-200">
            <Crosshair
              className="h-4 w-4"
              strokeWidth={
                1.7
              }
            />
          </div>

          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-sky-300/60">
              Location preview
            </p>

            <p className="mt-0.5 truncate text-xs font-medium text-white/65">
              {label}
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />

          <span className="text-[9px] uppercase tracking-[0.14em] text-white/25">
            Located
          </span>
        </div>
      </div>

      <div className="relative h-[210px] sm:h-[240px]">
        <div
          ref={
            containerRef
          }
          className="h-full w-full"
        />

        {state ===
          'loading' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#081018]">
            <div className="text-center">
              <MapPin
                className="mx-auto h-5 w-5 animate-pulse text-sky-200"
                strokeWidth={
                  1.6
                }
              />

              <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-white/30">
                Preparing preview
              </p>
            </div>
          </div>
        )}

        {state ===
          'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#081018] px-6 text-center">
            <div>
              <MapPin
                className="mx-auto h-5 w-5 text-rose-200/60"
                strokeWidth={
                  1.6
                }
              />

              <p className="mt-3 text-xs text-white/40">
                Preview unavailable
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] px-4 py-3">
        <p className="font-mono text-[10px] text-white/30">
          {latitude.toFixed(
            5,
          )}
          ,{' '}
          {longitude.toFixed(
            5,
          )}
        </p>

        <p className="text-[9px] uppercase tracking-[0.14em] text-white/20">
          MapLibre · OpenStreetMap
        </p>
      </div>
    </section>
  );
}