import type {
  HTMLAttributes,
} from 'react';

import {
  cn,
} from '../../lib/cn';

type SurfaceCardProps =
  HTMLAttributes<HTMLDivElement> & {
    elevated?: boolean;
  };

export function SurfaceCard({
  elevated = false,
  className,
  ...props
}: SurfaceCardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--meridian-radius-xl)] border border-[var(--meridian-border)]',
        elevated
          ? 'bg-[var(--meridian-surface-raised)] shadow-[var(--meridian-shadow-lg)]'
          : 'bg-[var(--meridian-surface)] shadow-[var(--meridian-shadow-sm)]',
        className,
      )}
      {...props}
    />
  );
}
