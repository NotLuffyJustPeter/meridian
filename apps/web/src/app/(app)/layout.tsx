import type {
  ReactNode,
} from 'react';

import {
  AppShell,
} from '../../features/navigation/components/app-shell';
import {
  requireAuthenticatedUser,
} from '../../lib/auth/server-auth';

type AppLayoutProps = {
  children: ReactNode;
};

export default async function AppLayout({
  children,
}: AppLayoutProps) {
  const user =
    await requireAuthenticatedUser();

  return (
    <AppShell
      user={user}
    >
      {children}
    </AppShell>
  );
}
