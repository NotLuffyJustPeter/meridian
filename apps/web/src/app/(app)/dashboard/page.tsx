import {
  PageHeading,
} from '../../../components/meridian/page-heading';
import {
  TripsDashboard,
} from '../../../features/trips/components/trips-dashboard';
import {
  requireAuthenticatedUser,
} from '../../../lib/auth/server-auth';

export default async function DashboardPage() {
  const user =
    await requireAuthenticatedUser();

  const firstName =
    user.name
      .trim()
      .split(/\s+/)[0] ||
    user.name;

  return (
    <main className="mx-auto w-full max-w-7xl px-5 pb-20 pt-12 sm:px-6 sm:pt-16 lg:px-8">
      <section className="pb-11 sm:pb-13">
        <PageHeading
          eyebrow="Travel workspace"
          title={
            <>
              Where are we going next,{' '}
              <span className="text-slate-400">
                {firstName}?
              </span>
            </>
          }
          description={
            <>
              Keep every journey in one calm, intelligent workspace — itinerary, places, weather, budget and collaborators included.
            </>
          }        />
      </section>

      <TripsDashboard />
    </main>
  );
}
