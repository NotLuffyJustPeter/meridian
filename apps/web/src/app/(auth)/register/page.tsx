
import type { Metadata } from 'next';

import { RegisterForm } from '../../../features/auth/components/register-form';

export const metadata: Metadata = {
  title: 'Create account',
};

export default function RegisterPage() {
  const googleClientId =
    process.env
      .GOOGLE_CLIENT_ID
      ?.trim() ?? '';

  return (
    <RegisterForm
      googleClientId={
        googleClientId
      }
    />
  );
}
