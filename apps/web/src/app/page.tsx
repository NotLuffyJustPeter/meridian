import {
  ArrowRight,
  Bot,
  CloudSun,
  Compass,
  MapPinned,
  Route,
  Users,
  WalletCards,
} from 'lucide-react';
import Link from 'next/link';

const features = [
  {
    icon: Bot,
    title: 'Meridian AI',
    description:
      'Context-aware suggestions that understand your destination, dates and itinerary.',
  },
  {
    icon: MapPinned,
    title: 'Places & maps',
    description:
      'Keep every place connected visually to your activities and trip.',
  },
  {
    icon: Route,
    title: 'Smart itinerary',
    description:
      'Build, organize and reorder every day of your journey.',
  },
  {
    icon: WalletCards,
    title: 'Budget',
    description:
      'Track expenses and understand your trip spending in one place.',
  },
  {
    icon: CloudSun,
    title: 'Weather',
    description:
      'See useful forecast context while you plan each destination.',
  },
  {
    icon: Users,
    title: 'Collaboration',
    description:
      'Plan together with realtime updates and role-based access.',
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050b12] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-260px] h-[620px] w-[900px] -translate-x-1/2 rounded-full bg-sky-400/[0.07] blur-[140px]" />
        <div className="absolute inset-0 meridian-grid-mask opacity-30" />
      </div>

      <header className="relative z-20 mx-auto flex max-w-[1380px] items-center justify-between px-6 py-7 lg:px-10">
        <Link
          href="/"
          className="flex items-center gap-3"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
            <Compass className="h-4 w-4 text-sky-300" />
          </div>

          <span className="text-sm font-semibold tracking-[0.22em]">
            MERIDIAN
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-xl px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
          >
            Sign in
          </Link>

          <Link
            href="/register"
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
          >
            Register
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-[1380px] px-6 pb-28 pt-20 lg:px-10 lg:pb-36 lg:pt-28">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-7 inline-flex items-center rounded-full border border-sky-300/15 bg-sky-300/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">
            Intelligent travel planning
          </div>

          <h1 className="text-5xl font-semibold leading-[0.95] tracking-[-0.055em] text-white sm:text-6xl md:text-7xl lg:text-8xl">
            Your journey,
            <br />
            intelligently connected.
          </h1>

          <p className="mx-auto mt-8 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
            Plan itineraries, discover places, manage budgets,
            check weather and collaborate — with Meridian AI
            keeping everything connected.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              Start planning
              <ArrowRight className="h-4 w-4" />
            </Link>

          </div>
        </div>

        <div className="relative mx-auto mt-20 max-w-6xl">
          <div className="absolute inset-x-20 top-10 h-64 rounded-full bg-sky-400/[0.08] blur-[100px]" />

          <div className="relative overflow-hidden rounded-[30px] border border-white/[0.09] bg-[#08131d]/95 shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
            <div className="flex h-14 items-center justify-between border-b border-white/[0.07] px-5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
              </div>

              <span className="text-[10px] uppercase tracking-[0.18em] text-slate-600">
                Tokyo · Japan
              </span>

              <div className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-emerald-200">
                Live
              </div>
            </div>

            <div className="grid min-h-[560px] lg:grid-cols-[380px_1fr]">
              <div className="border-b border-white/[0.07] p-6 lg:border-b-0 lg:border-r">
                <div className="mb-7">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                    Day 03
                  </p>

                  <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">
                    Wednesday in Tokyo
                  </h2>
                </div>

                <div className="space-y-3">
                  {[
                    ['09:00', 'Tsukiji Outer Market'],
                    ['12:30', 'Ginza'],
                    ['16:00', 'TeamLab Borderless'],
                    ['20:00', 'Shibuya Sky'],
                  ].map(([time, place]) => (
                    <div
                      key={place}
                      className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition hover:border-white/[0.12] hover:bg-white/[0.04]"
                    >
                      <span className="text-[10px] font-semibold text-sky-300">
                        {time}
                      </span>

                      <p className="mt-1.5 text-sm font-medium text-slate-200">
                        {place}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative min-h-[420px] overflow-hidden bg-[#061019]">
                <div className="absolute inset-0 meridian-grid-mask opacity-60" />

                <div className="absolute left-[19%] top-[19%] h-3 w-3 rounded-full bg-sky-300 shadow-[0_0_0_8px_rgba(125,211,252,.07),0_0_28px_rgba(125,211,252,.3)]" />

                <div className="absolute left-[47%] top-[34%] h-3 w-3 rounded-full bg-sky-300 shadow-[0_0_0_8px_rgba(125,211,252,.07),0_0_28px_rgba(125,211,252,.3)]" />

                <div className="absolute left-[34%] top-[61%] h-3 w-3 rounded-full bg-indigo-300 shadow-[0_0_0_8px_rgba(129,140,248,.07),0_0_28px_rgba(129,140,248,.3)]" />

                <div className="absolute right-[18%] top-[69%] h-3 w-3 rounded-full bg-sky-300 shadow-[0_0_0_8px_rgba(125,211,252,.07),0_0_28px_rgba(125,211,252,.3)]" />

                <svg
                  className="absolute inset-0 h-full w-full opacity-50"
                  viewBox="0 0 800 560"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M150 110 C260 120, 270 190, 380 190 S430 330, 300 345 S510 410, 655 395"
                    fill="none"
                    stroke="rgba(125,211,252,.5)"
                    strokeWidth="2"
                    strokeDasharray="7 8"
                  />
                </svg>

                <div className="absolute bottom-6 left-6 right-6 max-w-md rounded-2xl border border-white/[0.09] bg-[#07111b]/90 p-4 shadow-2xl backdrop-blur-xl">
                  <div className="flex gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-300/15 bg-sky-300/[0.06]">
                      <Bot className="h-4 w-4 text-sky-300" />
                    </div>

                    <div>
                      <div className="text-xs font-medium text-white">
                        Meridian AI
                      </div>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        I optimized the afternoon route to reduce
                        travel time between activities.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-6 flex max-w-4xl flex-wrap justify-center gap-x-8 gap-y-3 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-600">
            <span>Map first</span>
            <span>AI assisted</span>
            <span>Realtime collaboration</span>
            <span>One workspace</span>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto max-w-[1380px] px-6 py-28 lg:px-10 lg:py-36">
          <div className="grid gap-14 lg:grid-cols-[0.75fr_1.25fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300">
                One workspace
              </p>

              <h2 className="mt-5 max-w-md text-4xl font-semibold leading-tight tracking-[-0.05em] sm:text-5xl">
                Everything your journey needs.
              </h2>

              <p className="mt-5 max-w-md text-sm leading-7 text-slate-500">
                Meridian turns scattered travel planning into one
                connected experience.
              </p>
            </div>

            <div className="grid gap-px overflow-hidden rounded-[28px] border border-white/[0.07] bg-white/[0.07] sm:grid-cols-2">
              {features.map((feature) => {
                const Icon = feature.icon;

                return (
                  <article
                    key={feature.title}
                    className="bg-[#07101b] p-7 transition hover:bg-[#091622]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03]">
                      <Icon className="h-[18px] w-[18px] text-sky-300" />
                    </div>

                    <h3 className="mt-6 text-sm font-semibold text-white">
                      {feature.title}
                    </h3>

                    <p className="mt-3 text-sm leading-6 text-slate-500">
                      {feature.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-6 pb-10 lg:px-10">
        <div className="mx-auto max-w-[1380px] rounded-[32px] border border-white/[0.08] bg-[#08131d] px-6 py-20 text-center sm:px-12 lg:py-28">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300">
            Start your next journey
          </p>

          <h2 className="mx-auto mt-5 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.055em] sm:text-6xl">
            Plan less.
            <br />
            Experience more.
          </h2>

          <p className="mx-auto mt-6 max-w-lg text-sm leading-7 text-slate-500">
            Everything stays connected, from the first idea to the
            last day of your trip.
          </p>

          <Link
            href="/register"
            className="mt-9 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
          >
            Create your first trip
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="relative z-10 mx-auto flex max-w-[1380px] flex-col gap-3 px-6 py-9 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <span>© 2026 Meridian</span>
        <span>Intelligent travel planning.</span>
      </footer>
    </main>
  );
}