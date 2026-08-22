import {
  Compass,
} from 'lucide-react';
import Link from 'next/link';

import {
  cn,
} from '../../lib/cn';

type MeridianLogoProps = {
  href?: string;
  compact?: boolean;
  className?: string;
};

export function MeridianLogo({
  href = '/dashboard',
  compact = false,
  className,
}: MeridianLogoProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group inline-flex items-center gap-3 outline-none',
        'focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-sky-300/40',
        className,
      )}
      aria-label="Meridian home"
    >
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] shadow-[0_10px_28px_rgba(0,0,0,0.22)] transition duration-300 group-hover:border-sky-200/20 group-hover:bg-sky-300/[0.055]">
        <Compass
          className="h-[17px] w-[17px] text-sky-200 transition-transform duration-300 group-hover:rotate-12"
          strokeWidth={1.55}
        />

        <span className="pointer-events-none absolute inset-[5px] rounded-full border border-sky-300/10" />
      </span>

      {!compact && (
        <span className="text-[12px] font-semibold tracking-[0.245em] text-slate-100 transition group-hover:text-white">
          MERIDIAN
        </span>
      )}
    </Link>
  );
}
