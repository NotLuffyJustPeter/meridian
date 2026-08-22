'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowRight,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { getApiErrorMessage } from '../auth-client';
import {
  registerSchema,
  type RegisterFormValues,
} from '../schemas/register.schema';
import { GoogleSignInButton } from './google-sign-in-button';
import { PasswordField } from './password-field';

function passwordScore(password: string): number {
  let score = 0;

  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  return score;
}

type RegisterFormProps = {
  googleClientId: string;
};

export function RegisterForm({
  googleClientId,
}: RegisterFormProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [serverError, setServerError] =
    useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
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

  const password =
    useWatch({
      control,
      name: 'password',
    }) ?? '';

  const strength = useMemo(
    () => passwordScore(password),
    [password],
  );

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
      className="relative w-full max-w-lg"
    >
      <div className="pointer-events-none absolute -inset-x-10 -top-16 h-40 rounded-full bg-sky-400/[0.07] blur-3xl" />

      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.09] bg-[#08131d]/80 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-200/40 to-transparent" />

        <div className="mb-7">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-300/10 bg-sky-300/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-100/80">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.7)]" />
            Start exploring
          </div>

          <h1 className="text-4xl font-semibold tracking-[-0.045em] text-white sm:text-[2.7rem]">
            Create your account.
          </h1>

          <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
            Build a private travel workspace
            for itineraries, places, budgets
            and collaborative planning.
          </p>
        </div>

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
              aria-invalid={errors.name ? 'true' : 'false'}
              {...register('name')}
              className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 text-sm text-white outline-none transition duration-200 placeholder:text-slate-600 hover:border-white/20 focus:border-sky-300/50 focus:bg-white/[0.06] focus:ring-4 focus:ring-sky-300/[0.07]"
            />
            {errors.name?.message && (
              <p className="mt-2 text-xs leading-5 text-rose-300">
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
              aria-invalid={errors.email ? 'true' : 'false'}
              {...register('email')}
              className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 text-sm text-white outline-none transition duration-200 placeholder:text-slate-600 hover:border-white/20 focus:border-sky-300/50 focus:bg-white/[0.06] focus:ring-4 focus:ring-sky-300/[0.07]"
            />
            {errors.email?.message && (
              <p className="mt-2 text-xs leading-5 text-rose-300">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordField
              id="password"
              label="Password"
              hint="8+ characters"
              autoComplete="new-password"
              placeholder="Create password"
              error={errors.password?.message}
              {...register('password')}
            />

            <PasswordField
              id="confirmPassword"
              label="Confirm"
              autoComplete="new-password"
              placeholder="Repeat password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-black/[0.12] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5" />
                Password strength
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {strength <= 1
                  ? 'Basic'
                  : strength <= 3
                    ? 'Good'
                    : 'Strong'}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map((segment) => (
                <div
                  key={segment}
                  className={[
                    'h-1 rounded-full transition-colors',
                    segment <= strength
                      ? 'bg-sky-300/70'
                      : 'bg-white/[0.07]',
                  ].join(' ')}
                />
              ))}
            </div>

            <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-600">
              <Check className="h-3 w-3" />
              Use a unique password you do not reuse elsewhere.
            </div>
          </div>

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
            className="group relative mt-2 flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-white px-5 text-sm font-semibold text-slate-950 shadow-[0_12px_35px_rgba(255,255,255,0.08)] transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>
              {isSubmitting
                ? 'Creating account…'
                : 'Create account'}
            </span>
            {!isSubmitting && (
              <ArrowRight className="absolute right-4 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            )}
          </motion.button>
        </form>

        <GoogleSignInButton
          clientId={googleClientId}
        />

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-slate-200 transition hover:text-white"
          >
            Sign in
          </Link>
        </p>

        <p className="mt-4 text-center text-[11px] leading-5 text-slate-600">
          Your account creates a private
          Meridian workspace for your journeys.
        </p>
      </div>
    </motion.div>
  );
}
