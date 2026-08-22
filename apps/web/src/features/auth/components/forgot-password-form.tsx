'use client';

import {
  zodResolver,
} from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Mail,
} from 'lucide-react';
import {
  motion,
  useReducedMotion,
} from 'motion/react';
import Link from 'next/link';
import {
  useState,
} from 'react';
import {
  useForm,
} from 'react-hook-form';

import {
  getApiErrorMessage,
} from '../auth-client';
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from '../schemas/forgot-password.schema';

type ForgotPasswordFormProps = {
  initialEmail?: string;
};

export function ForgotPasswordForm({
  initialEmail = '',
}: ForgotPasswordFormProps) {
  const reduceMotion =
    useReducedMotion();

  const [
    serverError,
    setServerError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    submitted,
    setSubmitted,
  ] =
    useState(false);

  const {
    register,
    handleSubmit,
    formState: {
      errors,
      isSubmitting,
    },
  } =
    useForm<ForgotPasswordFormValues>({
      resolver:
        zodResolver(
          forgotPasswordSchema,
        ),
      defaultValues: {
        email:
          initialEmail,
      },
    });

  const onSubmit =
    async (
      values:
        ForgotPasswordFormValues,
    ) => {
      setServerError(
        null,
      );

      try {
        const response =
          await fetch(
            '/api/auth/password/forgot',
            {
              method:
                'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body:
                JSON.stringify(
                  values,
                ),
            },
          );

        if (!response.ok) {
          setServerError(
            await getApiErrorMessage(
              response,
              'Unable to request a password reset',
            ),
          );
          return;
        }

        setSubmitted(
          true,
        );
      } catch {
        setServerError(
          'Unable to reach Meridian. Please try again.',
        );
      }
    };

  return (
    <motion.div
      initial={
        reduceMotion
          ? false
          : {
              opacity: 0,
              y: 14,
            }
      }
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.45,
        ease: [
          0.22,
          1,
          0.36,
          1,
        ],
      }}
      className="relative w-full max-w-md"
    >
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.09] bg-[#08131d]/80 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-8">
        <div className="mb-8">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-300/10 bg-sky-300/[0.05]">
            <Mail className="h-5 w-5 text-sky-200" />
          </span>

          <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-white">
            Reset your password.
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            Enter the email connected to your Meridian account. We&apos;ll send a secure reset link if the account exists.
          </p>
        </div>

        {submitted ? (
          <div>
            <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.055] p-4">
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />

                <p className="text-sm leading-6 text-emerald-100">
                  If an account exists for that email, password reset instructions are on the way.
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Local development email appears in Mailpit at localhost:8025.
            </p>
          </div>
        ) : (
          <form
            onSubmit={
              handleSubmit(
                onSubmit,
              )
            }
            noValidate
            className="space-y-5"
          >
            {serverError && (
              <div
                role="alert"
                className="rounded-2xl border border-rose-300/15 bg-rose-300/[0.05] px-4 py-3 text-sm text-rose-200"
              >
                {serverError}
              </div>
            )}

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
                {...register(
                  'email',
                )}
                className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 text-sm text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-sky-300/50 focus:ring-4 focus:ring-sky-300/[0.07]"
              />

              {errors.email?.message && (
                <p className="mt-2 text-xs text-rose-300">
                  {errors.email.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={
                isSubmitting
              }
              className="group relative flex h-12 w-full items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-sky-50 disabled:opacity-60"
            >
              {isSubmitting
                ? 'Sending…'
                : 'Send reset link'}

              {!isSubmitting && (
                <ArrowRight className="absolute right-4 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              )}
            </button>
          </form>
        )}

        <Link
          href="/login"
          className="mt-7 flex items-center justify-center gap-2 text-sm text-slate-500 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    </motion.div>
  );
}
