import { LogoutButton } from '../../../features/auth/components/logout-button';
import { requireAuthenticatedUser } from '../../../lib/auth/server-auth';

export default async function DashboardPage() {
  const user =
    await requireAuthenticatedUser();

  return (
    <main className="min-h-screen bg-[#07101b] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
              <div className="h-2.5 w-2.5 rounded-full bg-sky-300" />
            </div>

            <span className="text-sm font-semibold tracking-[0.22em]">
              MERIDIAN
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-200">
                {user.name}
              </p>

              <p className="text-xs text-slate-500">
                {user.email}
              </p>
            </div>

            <LogoutButton />
          </div>
        </header>

        <div className="mt-24 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">
            Workspace
          </p>

          <h1 className="mt-4 text-5xl font-semibold tracking-[-0.05em]">
            Welcome, {user.name}.
          </h1>

          <p className="mt-5 max-w-xl leading-7 text-slate-400">
            Your Meridian workspace is
            ready. Soon your trips,
            saved places, itineraries and
            budgets will live here.
          </p>

          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.035] p-8">
            <p className="text-sm text-slate-500">
              Upcoming journeys
            </p>

            <p className="mt-2 text-lg font-medium">
              No trips yet
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Your future trips will
              appear here.
            </p>

            <button
              type="button"
              className="mt-6 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              Plan your first trip
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}