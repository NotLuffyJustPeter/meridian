'use client';

import {
  motion,
  useReducedMotion,
} from 'motion/react';
import {
  usePathname,
} from 'next/navigation';
import type {
  ReactNode,
} from 'react';

type PageTransitionProps = {
  children: ReactNode;
};

export function PageTransition({
  children,
}: PageTransitionProps) {
  const pathname =
    usePathname();

  const reduceMotion =
    useReducedMotion();

  return (
    <motion.div
      key={pathname}
      initial={
        reduceMotion
          ? false
          : {
              opacity: 0,
              y: 6,
            }
      }
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration:
          reduceMotion
            ? 0
            : 0.32,
        ease: [
          0.22,
          1,
          0.36,
          1,
        ],
      }}
      className="min-h-[calc(100vh-72px)]"
    >
      {children}
    </motion.div>
  );
}
