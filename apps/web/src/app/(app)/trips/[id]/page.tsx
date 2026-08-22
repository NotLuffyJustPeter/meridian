import {
  TripWorkspace,
} from '../../../../features/trips/components/trip-workspace';

type TripPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function TripPage({
  params,
}: TripPageProps) {
  const { id } =
    await params;

  return (
    <main className="mx-auto w-full max-w-[1500px] px-5 pb-20 pt-8 sm:px-6 sm:pt-10 lg:px-8 xl:px-10">
      <TripWorkspace
        tripId={id}
      />
    </main>
  );
}
