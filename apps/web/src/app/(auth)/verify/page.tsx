
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { MfaChallengeForm } from '../../../features/auth/components/mfa-challenge-form';
import { getMfaChallengeToken } from '../../../lib/auth/auth-cookies';

export const metadata: Metadata = {
  title:
    'Two-step verification',
};

export default async function VerifyPage() {
  const challengeToken =
    await getMfaChallengeToken();

  if (!challengeToken) {
    redirect('/login');
  }

  return (
    <MfaChallengeForm />
  );
}
