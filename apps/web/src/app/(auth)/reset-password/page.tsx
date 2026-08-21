import type {
  Metadata,
} from 'next';

import {
  ResetPasswordForm,
} from '../../../features/auth/components/reset-password-form';

export const metadata: Metadata = {
  title:
    'Reset password',
};

type ResetPasswordPageProps = {
  searchParams: Promise<{
    token?:
      | string
      | string[]
      | undefined;
  }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const params =
    await searchParams;

  const token =
    typeof params.token ===
    'string'
      ? params.token
      : '';

  return (
    <ResetPasswordForm
      token={
        token
      }
    />
  );
}
