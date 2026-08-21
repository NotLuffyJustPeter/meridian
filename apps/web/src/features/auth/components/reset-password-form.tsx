'use client';

import {
  zodResolver,
} from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ArrowRight,
  KeyRound,
} from 'lucide-react';
import {
  motion,
  useReducedMotion,
} from 'motion/react';
import Link from 'next/link';
import {
  useRouter,
} from 'next/navigation';
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
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from '../schemas/reset-password.schema';
import {
  PasswordField,
} from './password-field';

type ResetPasswordFormProps = {
  token: string;
};

export function ResetPasswordForm({
  token,
}: ResetPasswordFormProps) {
  const router =
    useRouter();

  const reduceMotion =
    useReducedMotion();

  const [
    serverError,
    setServerError,
  ] =
    useState<string | null>(
      null,
    );

  const {
    register,
    handleSubmit,
    formState: {
      errors,
      isSubmitting,
    },
  } =
    useForm<ResetPasswordFormValues>({
      resolver:
        zodResolver(
          resetPasswordSchema,
        ),
      defaultValues: {
        password: '',
        confirmPassword: '',
      },
    });

  const onSubmit =
    async (
      values:
        ResetPasswordFormValues,
    ) => {
      if (!token) {
        setServerError(
          'This reset link is missing its security token. Request a new link.',
        );
        return;
      }

      setServerError(
        null,
      );

      try {
        const response =
          await fetch(
            '/api/auth/password/reset',
            {
              method:
                'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body:
                JSON.stringify({
                  token,
                  password:
                    values.password,
                }),
            },
          );

        if (!response.ok) {
          setServerError(
            await getApiErrorMessage(
              response,
              'Unable to reset password',
            ),
          );
          return;
        }

        router.replace(
          '/login?reset=1',
        );
        router.refresh();
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
      }}
      className="relative w-full max-w-md"
    >
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.09] bg-[#08131d]/80 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-8">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-300/10 bg-sky-300/[0.05]">
          <KeyRound className="h-5 w-5 text-sky-200" />
        </span>

        <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-white">
          Choose a new password.
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-400">
          Resetting your password signs out existing Meridian sessions. Two-step verification stays enabled if you use it.
        </p>

        {!token && (
          <div className="mt-5 rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] px-4 py-3 text-sm leading-6 text-amber-100">
            This link is incomplete. Request a fresh password reset email.
          </div>
        )}

        {serverError && (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-rose-300/15 bg-rose-300/[0.05] px-4 py-3 text-sm text-rose-200"
          >
            {serverError}
          </div>
        )}

        <form
          onSubmit={
            handleSubmit(
              onSubmit,
            )
          }
          noValidate
          className="mt-7 space-y-5"
        >
          <PasswordField
            id="new-password"
            label="New password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            error={
              errors.password
                ?.message
            }
            {...register(
              'password',
            )}
          />

          <PasswordField
            id="confirm-password"
            label="Confirm password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            error={
              errors
                .confirmPassword
                ?.message
            }
            {...register(
              'confirmPassword',
            )}
          />

          <button
            type="submit"
            disabled={
              isSubmitting ||
              !token
            }
            className="group relative flex h-12 w-full items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? 'Updating…'
              : 'Reset password'}

            {!isSubmitting && (
              <ArrowRight className="absolute right-4 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            )}
          </button>
        </form>

        <Link
          href="/forgot-password"
          className="mt-7 flex items-center justify-center gap-2 text-sm text-slate-500 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Request another link
        </Link>
      </div>
    </motion.div>
  );
}
