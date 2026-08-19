import type { ReactNode } from 'react';

import { requireAuthenticatedUser } from '../../lib/auth/server-auth';

type AppLayoutProps = {
  children: ReactNode;
};

export default async function AppLayout({
  children,
}: AppLayoutProps) {
  await requireAuthenticatedUser();

  return children;
}