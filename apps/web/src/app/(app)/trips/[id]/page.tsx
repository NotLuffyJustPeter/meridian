import Link from 'next/link';

import { LogoutButton } from '../../../../features/auth/components/logout-button';
import { TripWorkspace } from '../../../../features/trips/components/trip-workspace';
import { requireAuthenticatedUser } from '../../../../lib/auth/server-auth';

type TripPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function TripPage({
  params,
}: TripPageProps) {
  const user =
    await requireAuthenticatedUser();

  const { id } =
    await params;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07101b] text-white">
      <div className="pointer-events-none absolute left-1/3 top-[-24rem] h-[44rem] w-[44rem] rounded-full bg-sky-400/[0.045] blur-[130px]" />

      <div className="pointer-events-none absolute right-[-20rem] top-[32rem] h-[38rem] w-[38rem] rounded-full bg-cyan-300/[0.02] blur-[120px]" />

      <div className="relative mx-auto w-full max-w-[1500px] px-5 pb-20 pt-7 sm:px-6 lg:px-8 xl:px-10">
        <header className="flex items-center justify-between border-b border-white/[0.07] pb-6">
          <Link
            href="/dashboard"
            className="group flex items-center gap-3"
          >
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.045]">
              <div className="absolute h-4 w-4 rounded-full border border-sky-200/20" />

              <div className="h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_14px_rgba(125,211,252,0.7)]" />
            </div>

            <span className="text-sm font-semibold tracking-[0.24em] text-slate-100 transition group-hover:text-white">
              MERIDIAN
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-200">
                {user.name}
              </p>

              <p className="mt-0.5 text-xs text-slate-500">
                {user.email}
              </p>
            </div>

            <LogoutButton />
          </div>
        </header>

        <div className="pt-10 sm:pt-12">
          <TripWorkspace
            tripId={id}
          />
        </div>
      </div>
    </main>
  );
}