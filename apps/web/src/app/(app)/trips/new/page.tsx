import {
  CreateTripForm,
} from '../../../../features/trips/components/create-trip-form';

export default function NewTripPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-5 pb-20 pt-10 sm:px-6 sm:pt-14 lg:px-8">
      <CreateTripForm />
    </main>
  );
}
