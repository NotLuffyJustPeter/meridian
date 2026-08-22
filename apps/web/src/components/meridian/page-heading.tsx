import type {
  ReactNode,
} from 'react';

import {
  cn,
} from '../../lib/cn';

type PageHeadingProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeadingProps) {
  return (
    <div
      className={cn(
        'flex flex-col justify-between gap-6 lg:flex-row lg:items-end',
        className,
      )}
    >
      <div className="max-w-3xl">
        {eyebrow && (
          <div className="flex items-center gap-3">
            <span className="h-px w-7 bg-sky-300/45" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/75">
              {eyebrow}
            </p>
          </div>
        )}

        <h1 className="mt-5 text-4xl font-medium tracking-[-0.052em] text-white sm:text-5xl">
          {title}
        </h1>

        {description && (
          <div className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-[15px]">
            {description}
          </div>
        )}
      </div>

      {actions && (
        <div className="shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
