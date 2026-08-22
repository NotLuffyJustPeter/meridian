
'use client';

import {
  Sparkles,
  X,
} from 'lucide-react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'motion/react';
import {
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  createPortal,
} from 'react-dom';

import {
  AiPlannerPanel,
} from './ai-planner-panel';

function subscribeToClientEnvironment() {
  return () => {};
}

type MeridianAiAssistantProps = {
  tripId: string;
  destination: string;
  currency: string;
  onOpenItinerary: () => void;
};

export function MeridianAiAssistant({
  tripId,
  destination,
  currency,
  onOpenItinerary,
}: MeridianAiAssistantProps) {
  const reduceMotion =
    useReducedMotion();

  const isClient =
    useSyncExternalStore(
      subscribeToClientEnvironment,
      () => true,
      () => false,
    );

  const [
    open,
    setOpen,
  ] =
    useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key ===
        'Escape'
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      'keydown',
      onKeyDown,
    );

    return () => {
      document.removeEventListener(
        'keydown',
        onKeyDown,
      );
    };
  }, [
    open,
  ]);

  if (!isClient) {
    return null;
  }

  return createPortal(
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close Meridian assistant"
              initial={
                reduceMotion
                  ? false
                  : {
                      opacity: 0,
                    }
              }
              animate={{
                opacity: 1,
              }}
              exit={{
                opacity: 0,
              }}
              transition={{
                duration:
                  reduceMotion
                    ? 0
                    : 0.18,
              }}
              onClick={() => {
                setOpen(false);
              }}
              className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-[2px] md:hidden"
            />

            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Meridian journey assistant"
              initial={
                reduceMotion
                  ? false
                  : {
                      opacity: 0,
                      y: 18,
                      scale:
                        0.985,
                    }
              }
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={
                reduceMotion
                  ? {
                      opacity: 0,
                    }
                  : {
                      opacity: 0,
                      y: 12,
                      scale:
                        0.99,
                    }
              }
              transition={{
                duration:
                  reduceMotion
                    ? 0
                    : 0.26,
                ease: [
                  0.22,
                  1,
                  0.36,
                  1,
                ],
              }}
              className="fixed inset-x-0 bottom-0 z-[80] flex h-[92dvh] max-h-[92dvh] flex-col overflow-hidden rounded-t-[1.75rem] border border-sky-300/10 bg-[#07111b]/98 shadow-[0_34px_120px_rgba(0,0,0,0.58)] backdrop-blur-2xl md:inset-y-[92px] md:left-auto md:right-5 md:h-auto md:max-h-none md:w-[min(470px,calc(100vw-2.5rem))] md:rounded-[1.75rem]"
            >
              <header className="shrink-0 border-b border-white/[0.07] px-5 pb-4 pt-5 sm:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3.5">
                    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sky-300/15 bg-sky-300/[0.07] text-sky-200">
                      <Sparkles className="h-4.5 w-4.5" />

                      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_12px_rgba(125,211,252,0.75)]" />
                    </span>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold tracking-[-0.025em] text-white">
                          Meridian
                        </h2>

                        <span className="rounded-full border border-white/[0.07] bg-white/[0.035] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          AI journey assistant
                        </span>
                      </div>

                      <p className="mt-1 truncate text-xs text-slate-500">
                        {destination}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label="Close Meridian assistant"
                    onClick={() => {
                      setOpen(false);
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-slate-500 outline-none transition hover:bg-white/[0.055] hover:text-white focus-visible:ring-2 focus-visible:ring-sky-300/25"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-hidden">
                <AiPlannerPanel
                  tripId={tripId}
                  destination={
                    destination
                  }
                  currency={
                    currency
                  }
                  onOpenItinerary={() => {
                    setOpen(false);
                    onOpenItinerary();
                  }}
                />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {!open && (
        <motion.button
          type="button"
          aria-label="Ask Meridian"
          title="Ask Meridian"
          initial={
            reduceMotion
              ? false
              : {
                  opacity: 0,
                  y: 8,
                }
          }
          animate={{
            opacity: 1,
            y: 0,
          }}
          whileHover={
            reduceMotion
              ? undefined
              : {
                  y: -2,
                }
          }
          whileTap={
            reduceMotion
              ? undefined
              : {
                  scale:
                    0.98,
                }
          }
          onClick={() => {
            setOpen(true);
          }}
          className="group fixed bottom-5 right-5 z-[65] flex h-13 items-center gap-2.5 rounded-2xl border border-sky-300/15 bg-[#0a1824]/95 px-3.5 text-sky-100 shadow-[0_18px_60px_rgba(0,0,0,0.4)] outline-none backdrop-blur-xl transition hover:border-sky-300/25 hover:bg-[#0c1d2a] focus-visible:ring-2 focus-visible:ring-sky-300/30 sm:bottom-6 sm:right-6"
        >
          <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-sky-300/[0.075]">
            <Sparkles className="h-4 w-4" />

            <span className="absolute right-0 top-0 h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.8)]" />
          </span>

          <span className="hidden pr-1 text-xs font-semibold sm:block">
            Ask Meridian
          </span>
        </motion.button>
      )}
    </>,
    document.body,
  );
}
