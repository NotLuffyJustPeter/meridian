'use client';

import {
  ArrowUpRight,
  Compass,
  MapPin,
  Route,
  Sparkles,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';

const routeStops = [
  {
    city: 'Milan',
    detail: 'Duomo · Brera · Navigli',
    day: 'DAY 01',
    x: 176,
    y: 236,
    delay: 0.52,
  },
  {
    city: 'Lake Como',
    detail: 'Bellagio · Varenna',
    day: 'DAY 03',
    x: 356,
    y: 114,
    delay: 0.72,
  },
  {
    city: 'Verona',
    detail: 'Arena · Historic center',
    day: 'DAY 06',
    x: 572,
    y: 214,
    delay: 0.92,
  },
] as const;

export function AuthVisualPanel() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative flex h-full min-h-screen flex-col overflow-hidden px-10 py-9 xl:px-14 xl:py-11">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-[8%] h-80 w-80 rounded-full bg-sky-400/[0.08] blur-[110px]" />
        <div className="absolute bottom-[8%] right-[-12%] h-[30rem] w-[30rem] rounded-full bg-indigo-400/[0.07] blur-[130px]" />
        <div
          className="absolute inset-0 opacity-[0.24]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px)',
            backgroundSize: '54px 54px',
            maskImage:
              'linear-gradient(to bottom, black 0%, black 68%, transparent 96%)',
          }}
        />
      </div>

      <div className="relative z-10 flex items-center justify-between">
        <Link
          href="/"
          className="group inline-flex items-center gap-3"
        >
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.045] shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
            <Compass
              className="h-[18px] w-[18px] text-sky-200 transition-transform duration-300 group-hover:rotate-12"
              strokeWidth={1.6}
            />
            <span className="absolute inset-[5px] rounded-full border border-sky-300/10" />
          </span>

          <span className="text-[13px] font-semibold tracking-[0.26em] text-white">
            MERIDIAN
          </span>
        </Link>

        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.5)]" />
          Journey system online
        </div>
      </div>

      <div className="relative z-10 my-auto max-w-[820px] py-12">
        <motion.div
          initial={
            reduceMotion
              ? false
              : { opacity: 0, y: 12 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.48,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <div className="mb-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-200/75">
            <Sparkles
              className="h-3.5 w-3.5"
              strokeWidth={1.6}
            />
            Travel, thoughtfully organized
          </div>

          <h2 className="max-w-3xl text-[clamp(2.9rem,4.7vw,5.4rem)] font-medium leading-[0.98] tracking-[-0.058em] text-white">
            Your whole trip,
            <span className="block bg-gradient-to-r from-slate-300 via-slate-400 to-slate-600 bg-clip-text text-transparent">
              finally in one place.
            </span>
          </h2>

          <p className="mt-6 max-w-xl text-[15px] leading-7 text-slate-400 xl:text-base">
            Plan the route, shape the itinerary,
            keep places and budgets connected,
            then collaborate without losing the
            calm of the journey.
          </p>
        </motion.div>

        <motion.div
          initial={
            reduceMotion
              ? false
              : { opacity: 0, y: 18 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: reduceMotion ? 0 : 0.12,
            duration: 0.55,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="relative mt-9 overflow-hidden rounded-[2rem] border border-white/[0.085] bg-[#08131d]/68 p-3 shadow-[0_35px_120px_rgba(0,0,0,0.38)] backdrop-blur-2xl"
        >
          <div className="relative overflow-hidden rounded-[1.55rem] border border-white/[0.065] bg-[#07111b]/88">
            <div className="flex items-center justify-between border-b border-white/[0.065] px-5 py-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">
                  Active journey
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <h3 className="text-[15px] font-medium text-slate-100">
                    Northern Italy
                  </h3>
                  <span className="rounded-full border border-sky-300/10 bg-sky-300/[0.045] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-sky-200/70">
                    Planned
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-slate-600">
                <Route
                  className="h-3.5 w-3.5"
                  strokeWidth={1.6}
                />
                8 days · 3 regions
              </div>
            </div>

            <div className="relative h-[330px] overflow-hidden sm:h-[360px] xl:h-[390px]">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-[8%] top-[18%] h-48 w-48 rounded-full bg-sky-300/[0.035] blur-3xl" />
                <div
                  className="absolute inset-0 opacity-[0.44]"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle, rgba(148,163,184,0.19) 1px, transparent 1px)',
                    backgroundSize: '18px 18px',
                    maskImage:
                      'radial-gradient(ellipse at center, black 0%, black 44%, transparent 78%)',
                  }}
                />
              </div>

              <div className="absolute left-5 top-5 z-10 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2 font-mono text-[9px] leading-4 tracking-[0.08em] text-slate-600 backdrop-blur">
                45.4642° N
                <br />
                9.1900° E
              </div>

              <div className="absolute right-5 top-5 z-10 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2 text-[9px] font-medium uppercase tracking-[0.14em] text-slate-600 backdrop-blur">
                <MapPin
                  className="h-3 w-3 text-sky-300/70"
                  strokeWidth={1.8}
                />
                Lombardy · Veneto
              </div>

              <svg
                viewBox="0 0 760 360"
                className="absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient
                    id="meridian-route-gradient"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="0"
                  >
                    <stop
                      offset="0%"
                      stopColor="#7dd3fc"
                    />
                    <stop
                      offset="52%"
                      stopColor="#818cf8"
                    />
                    <stop
                      offset="100%"
                      stopColor="#94a3b8"
                    />
                  </linearGradient>

                  <filter
                    id="meridian-route-glow"
                    x="-50%"
                    y="-50%"
                    width="200%"
                    height="200%"
                  >
                    <feGaussianBlur
                      stdDeviation="4"
                      result="blur"
                    />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <path
                  d="M 62 285 C 130 260, 125 220, 176 236 C 235 255, 267 146, 356 114 C 431 87, 461 176, 572 214 C 633 235, 662 209, 706 165"
                  fill="none"
                  stroke="rgba(125,211,252,0.08)"
                  strokeWidth="10"
                  strokeLinecap="round"
                />

                <motion.path
                  d="M 62 285 C 130 260, 125 220, 176 236 C 235 255, 267 146, 356 114 C 431 87, 461 176, 572 214 C 633 235, 662 209, 706 165"
                  fill="none"
                  stroke="url(#meridian-route-gradient)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  filter="url(#meridian-route-glow)"
                  initial={
                    reduceMotion
                      ? false
                      : { pathLength: 0, opacity: 0.2 }
                  }
                  animate={{
                    pathLength: 1,
                    opacity: 0.8,
                  }}
                  transition={{
                    pathLength: {
                      duration: reduceMotion
                        ? 0
                        : 1.35,
                      ease: [0.22, 1, 0.36, 1],
                      delay: reduceMotion
                        ? 0
                        : 0.28,
                    },
                    opacity: {
                      duration: 0.4,
                    },
                  }}
                />

                {routeStops.map((stop) => (
                  <motion.g
                    key={stop.city}
                    initial={
                      reduceMotion
                        ? false
                        : {
                            opacity: 0,
                            scale: 0.75,
                          }
                    }
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    transition={{
                      delay: reduceMotion
                        ? 0
                        : stop.delay,
                      duration: 0.38,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    style={{
                      transformOrigin: `${stop.x}px ${stop.y}px`,
                    }}
                  >
                    <circle
                      cx={stop.x}
                      cy={stop.y}
                      r="13"
                      fill="#07111b"
                      stroke="rgba(125,211,252,0.22)"
                    />
                    <circle
                      cx={stop.x}
                      cy={stop.y}
                      r="4.5"
                      fill="#7dd3fc"
                    />
                  </motion.g>
                ))}
              </svg>

              {routeStops.map((stop, index) => (
                <motion.div
                  key={stop.city}
                  initial={
                    reduceMotion
                      ? false
                      : { opacity: 0, y: 6 }
                  }
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: reduceMotion
                      ? 0
                      : stop.delay + 0.08,
                    duration: 0.36,
                  }}
                  className={[
                    'absolute z-10 rounded-xl border border-white/[0.075] bg-[#08131d]/88 px-3 py-2.5 shadow-xl shadow-black/20 backdrop-blur-xl',
                    index === 0
                      ? 'left-[12%] top-[64%]'
                      : index === 1
                        ? 'left-[43%] top-[18%]'
                        : 'right-[12%] top-[57%]',
                  ].join(' ')}
                >
                  <p className="text-[8px] font-semibold uppercase tracking-[0.17em] text-slate-600">
                    {stop.day}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-slate-200">
                    {stop.city}
                  </p>
                  <p className="mt-0.5 hidden text-[9px] text-slate-600 xl:block">
                    {stop.detail}
                  </p>
                </motion.div>
              ))}

              <div className="absolute bottom-5 left-5 right-5 z-10 grid grid-cols-3 gap-2">
                {[
                  ['PLACES', '18 saved'],
                  ['BUDGET', '€1,840'],
                  ['STATUS', 'On track'],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2.5 backdrop-blur"
                  >
                    <p className="text-[8px] font-semibold tracking-[0.15em] text-slate-600">
                      {label}
                    </p>
                    <p
                      className={[
                        'mt-1 text-[11px] font-medium',
                        label === 'STATUS'
                          ? 'text-emerald-300/90'
                          : 'text-slate-300',
                      ].join(' ')}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={
            reduceMotion
              ? false
              : { opacity: 0 }
          }
          animate={{ opacity: 1 }}
          transition={{
            delay: reduceMotion ? 0 : 0.75,
            duration: 0.5,
          }}
          className="mt-5 flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-slate-700"
        >
          <span>
            Plan less · experience more
          </span>

          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 text-slate-600 transition hover:text-slate-300"
          >
            Explore Meridian
            <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </motion.div>
      </div>

      <div className="relative z-10 flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-slate-700">
        <span>
          Meridian travel workspace
        </span>
        <span>
          2026
        </span>
      </div>
    </div>
  );
}
