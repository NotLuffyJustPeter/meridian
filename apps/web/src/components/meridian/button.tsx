import type {
  ButtonHTMLAttributes,
} from 'react';

import {
  cn,
} from '../../lib/cn';

export type MeridianButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger';

const variantClasses: Record<
  MeridianButtonVariant,
  string
> = {
  primary:
    'border-white bg-white text-slate-950 hover:-translate-y-0.5 hover:bg-sky-50 hover:shadow-[0_14px_36px_rgba(125,211,252,0.10)]',
  secondary:
    'border-white/[0.09] bg-white/[0.045] text-slate-200 hover:border-white/[0.16] hover:bg-white/[0.07] hover:text-white',
  ghost:
    'border-transparent bg-transparent text-slate-400 hover:bg-white/[0.045] hover:text-white',
  danger:
    'border-rose-300/15 bg-rose-300/[0.05] text-rose-200 hover:border-rose-300/25 hover:bg-rose-300/[0.08]',
};

export function meridianButtonClasses(
  variant: MeridianButtonVariant =
    'secondary',
): string {
  return cn(
    'inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold',
    'transition duration-200 outline-none disabled:pointer-events-none disabled:opacity-45',
    'focus-visible:ring-2 focus-visible:ring-sky-300/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b12]',
    variantClasses[variant],
  );
}

type MeridianButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: MeridianButtonVariant;
  };

export function MeridianButton({
  variant = 'secondary',
  className,
  type = 'button',
  ...props
}: MeridianButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        meridianButtonClasses(
          variant,
        ),
        className,
      )}
      {...props}
    />
  );
}
