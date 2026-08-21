'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { getApiErrorMessage } from '../auth-client';
import {
  loginSchema,
  type LoginFormValues,
} from '../schemas/login.schema';
import { GoogleSignInButton } from './google-sign-in-button';
import { PasswordField } from './password-field';

type LoginFormProps = {
  registrationSucceeded?: boolean;
  googleClientId: string;
};

export function LoginForm({
  registrationSucceeded = false,
  googleClientId,
}: LoginFormProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

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
    <motion.div
      initial={
        reduceMotion
          ? false
          : { opacity: 0, y: 14 }
      }
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="relative w-full max-w-md"
    >
      <div className="pointer-events-none absolute -inset-x-10 -top-16 h-40 rounded-full bg-sky-400/[0.07] blur-3xl" />

      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.09] bg-[#08131d]/80 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-200/40 to-transparent" />

        <div className="mb-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-300/10 bg-sky-300/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-100/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.7)]" />
            Your journey awaits
          </div>

          <h1 className="text-4xl font-semibold tracking-[-0.045em] text-white sm:text-[2.7rem]">
            Welcome back.
          </h1>

          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
            Continue planning the places,
            timing and details behind your
            next journey.
          </p>
        </div>

        {registrationSucceeded && (
          <motion.div
            initial={
              reduceMotion
                ? false
                : { opacity: 0, y: -6 }
            }
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] px-4 py-3 text-sm text-emerald-100"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Your account is ready. Sign
              in to open your Meridian
              workspace.
            </span>
          </motion.div>
        )}

        {serverError && (
          <div
            role="alert"
            className="mb-5 rounded-2xl border border-rose-300/15 bg-rose-300/[0.05] px-4 py-3 text-sm leading-6 text-rose-200"
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
              className={[
                'h-12 w-full rounded-xl border bg-white/[0.045] px-4 text-sm text-white outline-none transition duration-200 placeholder:text-slate-600',
                'border-white/10 hover:border-white/20 focus:border-sky-300/50 focus:bg-white/[0.06] focus:ring-4 focus:ring-sky-300/[0.07]',
                errors.email
                  ? 'border-rose-300/30'
                  : '',
              ].join(' ')}
            />

            {errors.email?.message && (
              <p className="mt-2 text-xs leading-5 text-rose-300">
                {errors.email.message}
              </p>
            )}
          </div>

          <PasswordField
            id="password"
            label="Password"
            hint="Secure access"
            autoComplete="current-password"
            placeholder="Enter your password"
            error={errors.password?.message}
            {...register('password')}
          />

          <motion.button
            type="submit"
            disabled={isSubmitting}
            whileHover={
              reduceMotion || isSubmitting
                ? undefined
                : { y: -1 }
            }
            whileTap={
              reduceMotion || isSubmitting
                ? undefined
                : { scale: 0.99 }
            }
            className="group relative flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-white px-5 text-sm font-semibold text-slate-950 shadow-[0_12px_35px_rgba(255,255,255,0.08)] transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>
              {isSubmitting
                ? 'Signing in…'
                : 'Continue to Meridian'}
            </span>

            {!isSubmitting && (
              <ArrowRight className="absolute right-4 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            )}
          </motion.button>
        </form>

        <GoogleSignInButton
          clientId={googleClientId}
        />

        <div className="my-7 flex items-center gap-4">
          <div className="h-px flex-1 bg-white/[0.08]" />
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">
            New to Meridian?
          </span>
          <div className="h-px flex-1 bg-white/[0.08]" />
        </div>

        <Link
          href="/register"
          className="flex h-12 w-full items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] text-sm font-medium text-slate-200 transition hover:border-sky-300/15 hover:bg-sky-300/[0.04] hover:text-white"
        >
          Create a Meridian account
        </Link>

        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-600">
          <LockKeyhole className="h-3.5 w-3.5" />
          Secure server-side session
        </div>
      </div>
    </motion.div>
  );
}
