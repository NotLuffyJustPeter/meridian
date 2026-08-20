'use client';

import {
  Compass,
  Map,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import 'maplibre-gl/dist/maplibre-gl.css';

interface MeridianMapProps {
  className?: string;
}

type MapState =
  | 'loading'
  | 'ready'
  | 'error';

const MAP_STYLE =
  'https://tiles.openfreemap.org/styles/liberty';

export function MeridianMap({
  className = '',
}: MeridianMapProps) {
  const containerRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const mapRef =
    useRef<
      import('maplibre-gl').Map | null
    >(null);

  const [
    state,
    setState,
  ] =
    useState<MapState>(
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
              0,
              20,
            ],

            zoom: 1.6,

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
            !cancelled
            ) {
            setState(
                'ready',
            );

            window.requestAnimationFrame(
                () => {
                map.resize();
                },
            );
            }
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

      mapRef.current?.remove();
      mapRef.current =
        null;
    };
  }, []);

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
        className="h-[420px] w-full sm:h-[480px] lg:h-[520px]"
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
              <Map
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
    </section>
  );
}