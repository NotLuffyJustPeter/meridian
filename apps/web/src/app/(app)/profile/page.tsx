import {
  UserRound,
} from 'lucide-react';
import type {
  Metadata,
} from 'next';

import {
  MeridianBadge,
} from '../../../components/meridian/badge';
import {
  PageHeading,
} from '../../../components/meridian/page-heading';
import {
  ProfileEditor,
} from '../../../features/auth/components/profile-editor';
import {
  SecuritySettingsPanel,
} from '../../../features/auth/components/security-settings-panel';
import {
  requireAuthenticatedUser,
} from '../../../lib/auth/server-auth';

export const metadata: Metadata = {
  title:
    'Profile & security',
};

export default async function ProfilePage() {
  const user =
    await requireAuthenticatedUser();

  const googleClientId =
    process.env
      .GOOGLE_CLIENT_ID
      ?.trim() ?? '';

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-20 pt-12 sm:px-6 sm:pt-16 lg:px-8">
      <PageHeading
        eyebrow="Meridian account"
        title="Profile & security."
        description={
          <>
            Keep your identity, sign-in methods and two-step verification together in one place.
          </>
        }
        actions={
          <MeridianBadge
            tone="accent"
            className="gap-2 px-3 py-1.5"
          >
            <UserRound className="h-3 w-3" />
            Account
          </MeridianBadge>
        }
      />

      <div className="mt-10 space-y-8">
        <ProfileEditor
          user={user}
        />

        <div
          id="security"
          className="scroll-mt-28"
        >
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              Sign-in & security
            </p>
          </div>

          <SecuritySettingsPanel
            user={user}
            googleClientId={
              googleClientId
            }
          />
        </div>
      </div>
    </main>
  );
}
