'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { getApiErrorMessage } from '../auth-client';
import {
  registerSchema,
  type RegisterFormValues,
} from '../schemas/register.schema';

export function RegisterForm() {
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
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(
      registerSchema,
    ),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (
    values: RegisterFormValues,
  ): Promise<void> => {
    setServerError(null);

    const payload = {
      name: values.name,
      email: values.email,
      password: values.password,
    };

    try {
      const response = await fetch(
        '/api/auth/register',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const message =
          await getApiErrorMessage(
            response,
            'Unable to create your account',
          );

        setServerError(message);
        return;
      }

      router.replace(
        '/login?registered=1',
      );
    } catch {
      setServerError(
        'Unable to connect to Meridian. Please try again.',
      );
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium tracking-wide text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
          START EXPLORING
        </div>

        <h1 className="text-4xl font-semibold tracking-[-0.04em] text-white">
          Create your account.
        </h1>

        <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
          One workspace for your
          itineraries, places, budget and
          the details that make a journey
          yours.
        </p>
      </div>

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
        className="space-y-4"
      >
        <div>
          <label
            htmlFor="name"
            className="mb-2 block text-sm font-medium text-slate-200"
          >
            Full name
          </label>

          <input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Your name"
            aria-invalid={
              errors.name
                ? 'true'
                : 'false'
            }
            {...register('name')}
            className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 text-sm text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-sky-400/60 focus:bg-white/[0.06] focus:ring-4 focus:ring-sky-400/[0.08]"
          />

          {errors.name?.message && (
            <p className="mt-2 text-xs text-red-300">
              {errors.name.message}
            </p>
          )}
        </div>

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

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-slate-200"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="8+ characters"
              aria-invalid={
                errors.password
                  ? 'true'
                  : 'false'
              }
              {...register('password')}
              className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 text-sm text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-sky-400/60 focus:bg-white/[0.06] focus:ring-4 focus:ring-sky-400/[0.08]"
            />

            {errors.password
              ?.message && (
              <p className="mt-2 text-xs text-red-300">
                {
                  errors.password
                    .message
                }
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-sm font-medium text-slate-200"
            >
              Confirm
            </label>

            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat password"
              aria-invalid={
                errors.confirmPassword
                  ? 'true'
                  : 'false'
              }
              {...register(
                'confirmPassword',
              )}
              className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 text-sm text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-sky-400/60 focus:bg-white/[0.06] focus:ring-4 focus:ring-sky-400/[0.08]"
            />

            {errors.confirmPassword
              ?.message && (
              <p className="mt-2 text-xs text-red-300">
                {
                  errors
                    .confirmPassword
                    .message
                }
              </p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="group relative mt-2 flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-slate-100 px-5 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span>
            {isSubmitting
              ? 'Creating account...'
              : 'Create account'}
          </span>

          {!isSubmitting && (
            <span className="absolute right-4 transition-transform group-hover:translate-x-1">
              →
            </span>
          )}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-slate-200 transition hover:text-white"
        >
          Sign in
        </Link>
      </p>

      <p className="mt-5 text-center text-xs leading-5 text-slate-600">
        By creating an account, you are
        creating a private Meridian
        workspace for your journeys.
      </p>
    </div>
  );
}