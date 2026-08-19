'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { getApiErrorMessage } from '../auth-client';
import {
  loginSchema,
  type LoginFormValues,
} from '../schemas/login.schema';

type LoginFormProps = {
  registrationSucceeded?: boolean;
};

export function LoginForm({
  registrationSucceeded = false,
}: LoginFormProps) {
  const router = useRouter();

  const [serverError, setServerError] =
    useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (
    values: LoginFormValues,
  ): Promise<void> => {
    setServerError(null);

    try {
      const response = await fetch(
        '/api/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(values),
        },
      );

      if (!response.ok) {
        const message =
          await getApiErrorMessage(
            response,
            'Unable to sign in',
          );

        setServerError(message);
        return;
      }

      router.replace('/dashboard');
      router.refresh();
    } catch {
      setServerError(
        'Unable to connect to Meridian. Please try again.',
      );
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-9">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium tracking-wide text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          YOUR JOURNEY AWAITS
        </div>

        <h1 className="text-4xl font-semibold tracking-[-0.04em] text-white">
          Welcome back.
        </h1>

        <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
          Sign in to continue planning
          trips, places and experiences
          from your Meridian workspace.
        </p>
      </div>

      {registrationSucceeded && (
        <div className="mb-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-3 text-sm text-emerald-200">
          Your account was created
          successfully. You can sign in
          now.
        </div>
      )}

      {serverError && (
        <div
          role="alert"
          className="mb-6 rounded-2xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm text-red-200"
        >
          {serverError}
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="space-y-5"
      >
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium text-slate-200"
          >
            Email address
          </label>

          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={
              errors.email
                ? 'true'
                : 'false'
            }
            {...register('email')}
            className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 text-sm text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-sky-400/60 focus:bg-white/[0.06] focus:ring-4 focus:ring-sky-400/[0.08]"
          />

          {errors.email?.message && (
            <p className="mt-2 text-xs text-red-300">
              {errors.email.message}
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-200"
            >
              Password
            </label>

            <span className="text-xs text-slate-600">
              Secure access
            </span>
          </div>

          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            aria-invalid={
              errors.password
                ? 'true'
                : 'false'
            }
            {...register('password')}
            className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 text-sm text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-sky-400/60 focus:bg-white/[0.06] focus:ring-4 focus:ring-sky-400/[0.08]"
          />

          {errors.password?.message && (
            <p className="mt-2 text-xs text-red-300">
              {errors.password.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="group relative flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-slate-100 px-5 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span>
            {isSubmitting
              ? 'Signing in...'
              : 'Continue to Meridian'}
          </span>

          {!isSubmitting && (
            <span className="absolute right-4 transition-transform group-hover:translate-x-1">
              →
            </span>
          )}
        </button>
      </form>

      <div className="my-7 flex items-center gap-4">
        <div className="h-px flex-1 bg-white/10" />

        <span className="text-xs uppercase tracking-[0.18em] text-slate-600">
          New here?
        </span>

        <div className="h-px flex-1 bg-white/10" />
      </div>

      <Link
        href="/register"
        className="flex h-12 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.06]"
      >
        Create a Meridian account
      </Link>

      <p className="mt-7 text-center text-xs leading-5 text-slate-600">
        Your authentication session is
        protected using secure server-side
        cookies.
      </p>
    </div>
  );
}