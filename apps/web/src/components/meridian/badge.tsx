import type {
  HTMLAttributes,
} from 'react';

import {
  cn,
} from '../../lib/cn';

type MeridianBadgeTone =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger';

const tones: Record<
  MeridianBadgeTone,
  string
> = {
  neutral:
    'border-white/[0.08] bg-white/[0.04] text-slate-400',
  accent:
    'border-sky-300/10 bg-sky-300/[0.05] text-sky-200/80',
  success:
    'border-emerald-300/12 bg-emerald-300/[0.055] text-emerald-200',
  warning:
    'border-amber-300/12 bg-amber-300/[0.055] text-amber-200',
  danger:
    'border-rose-300/12 bg-rose-300/[0.055] text-rose-200',
};

type MeridianBadgeProps =
  HTMLAttributes<HTMLSpanElement> & {
    tone?: MeridianBadgeTone;
  };

export function MeridianBadge({
  tone = 'neutral',
  className,
  ...props
}: MeridianBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
