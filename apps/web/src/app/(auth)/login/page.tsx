import type {
  Metadata,
} from 'next';

import {
  LoginForm,
} from '../../../features/auth/components/login-form';

export const metadata: Metadata = {
  title:
    'Sign in',
};

type LoginPageProps = {
  searchParams: Promise<{
    registered?:
      | string
      | string[]
      | undefined;
    reset?:
      | string
      | string[]
      | undefined;
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const params =
    await searchParams;

  const googleClientId =
    process.env
      .GOOGLE_CLIENT_ID
      ?.trim() ?? '';

  return (
    <LoginForm
      registrationSucceeded={
        params.registered ===
        '1'
      }
      passwordResetSucceeded={
        params.reset ===
        '1'
      }
      googleClientId={
        googleClientId
      }
    />
  );
}
