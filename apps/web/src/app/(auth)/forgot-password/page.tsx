import type {
  Metadata,
} from 'next';

import {
  ForgotPasswordForm,
} from '../../../features/auth/components/forgot-password-form';

export const metadata: Metadata = {
  title:
    'Forgot password',
};

type ForgotPasswordPageProps = {
  searchParams: Promise<{
    email?:
      | string
      | string[]
      | undefined;
  }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params =
    await searchParams;

  const initialEmail =
    typeof params.email ===
    'string'
      ? params.email
      : '';

  return (
    <ForgotPasswordForm
      initialEmail={
        initialEmail
      }
    />
  );
}
