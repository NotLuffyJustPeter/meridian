'use client';

import { Eye, EyeOff } from 'lucide-react';
import {
  useId,
  useState,
  type InputHTMLAttributes,
} from 'react';

type PasswordFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  label: string;
  error?: string;
  hint?: string;
};

export function PasswordField({
  id,
  label,
  error,
  hint,
  className,
  ...inputProps
}: PasswordFieldProps) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const [visible, setVisible] =
    useState(false);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-200"
        >
          {label}
        </label>

        {hint && (
          <span className="text-[11px] text-slate-600">
            {hint}
          </span>
        )}
      </div>

      <div className="group relative">
        <input
          {...inputProps}
          id={inputId}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? 'true' : 'false'}
          className={[
            'h-12 w-full rounded-xl border bg-white/[0.045] px-4 pr-12 text-sm text-white outline-none transition duration-200 placeholder:text-slate-600',
            'border-white/10 hover:border-white/20 focus:border-sky-300/50 focus:bg-white/[0.06] focus:ring-4 focus:ring-sky-300/[0.07]',
            error
              ? 'border-rose-300/30 focus:border-rose-300/45 focus:ring-rose-300/[0.06]'
              : '',
            className ?? '',
          ].join(' ')}
        />

        <button
          type="button"
          onClick={() =>
            setVisible((current) => !current)
          }
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/30"
          aria-label={
            visible
              ? 'Hide password'
              : 'Show password'
          }
          aria-pressed={visible}
        >
          {visible ? (
            <EyeOff
              className="h-4 w-4"
              strokeWidth={1.8}
            />
          ) : (
            <Eye
              className="h-4 w-4"
              strokeWidth={1.8}
            />
          )}
        </button>
      </div>

      {error && (
        <p
          className="mt-2 text-xs leading-5 text-rose-300"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
