
'use client';

import {
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { getApiErrorMessage } from '../auth-client';

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleIdConfiguration = {
  client_id: string;
  callback: (
    response: GoogleCredentialResponse,
  ) => void;
  ux_mode?: 'popup';
};

type GoogleButtonConfiguration = {
  type?: 'standard';
  theme?: 'outline';
  size?: 'large';
  text?: 'continue_with';
  shape?: 'rectangular';
  logo_alignment?: 'left';
  width?: number;
};

type GoogleAccountsId = {
  initialize(
    config: GoogleIdConfiguration,
  ): void;
  renderButton(
    parent: HTMLElement,
    options: GoogleButtonConfiguration,
  ): void;
};

type GoogleIdentityNamespace = {
  accounts: {
    id: GoogleAccountsId;
  };
};

declare global {
  interface Window {
    google?:
      GoogleIdentityNamespace;
  }
}

type GoogleSignInButtonProps = {
  clientId: string;
};

export function GoogleSignInButton({
  clientId,
}: GoogleSignInButtonProps) {
  const router =
    useRouter();

  const buttonRef =
    useRef<HTMLDivElement>(
      null,
    );

  const [scriptReady, setScriptReady] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null,
    );

  const handleCredential =
    useCallback(
      async (
        response:
          GoogleCredentialResponse,
      ): Promise<void> => {
        const credential =
          response.credential;

        if (!credential) {
          setError(
            'Google did not return a valid sign-in credential.',
          );
          return;
        }

        setError(null);
        setIsSubmitting(true);

        try {
          const apiResponse =
            await fetch(
              '/api/auth/google',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body: JSON.stringify(
                  {
                    credential,
                  },
                ),
              },
            );

          if (!apiResponse.ok) {
            const message =
              await getApiErrorMessage(
                apiResponse,
                'Unable to continue with Google',
              );

            setError(message);
            return;
          }

          router.replace(
            '/dashboard',
          );

          router.refresh();
        } catch {
          setError(
            'Unable to connect to Meridian. Please try again.',
          );
        } finally {
          setIsSubmitting(false);
        }
      },
      [
        router,
      ],
    );

  const renderGoogleButton =
    useCallback(
      () => {
        const google =
          window.google;

        const target =
          buttonRef.current;

        if (
          !google ||
          !target ||
          !clientId
        ) {
          return;
        }

        target.replaceChildren();

        google.accounts.id.initialize(
          {
            client_id:
              clientId,
            callback:
              (
                response,
              ) => {
                void handleCredential(
                  response,
                );
              },
            ux_mode:
              'popup',
          },
        );

        const width =
          Math.min(
            400,
            Math.max(
              240,
              Math.floor(
                target.clientWidth,
              ),
            ),
          );

        google.accounts.id.renderButton(
          target,
          {
            type:
              'standard',
            theme:
              'outline',
            size:
              'large',
            text:
              'continue_with',
            shape:
              'rectangular',
            logo_alignment:
              'left',
            width,
          },
        );
      },
      [
        clientId,
        handleCredential,
      ],
    );

  useEffect(
    () => {
      if (
        scriptReady &&
        clientId
      ) {
        renderGoogleButton();
      }
    },
    [
      clientId,
      renderGoogleButton,
      scriptReady,
    ],
  );

  if (!clientId) {
    return null;
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => {
          setScriptReady(true);
        }}
        onError={() => {
          setError(
            'Google sign-in could not be loaded.',
          );
        }}
      />

      <div className="my-6 flex items-center gap-4">
        <div className="h-px flex-1 bg-white/[0.08]" />

        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">
          or continue with
        </span>

        <div className="h-px flex-1 bg-white/[0.08]" />
      </div>

      <div className="relative">
        {!scriptReady && (
          <div className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/[0.09] bg-white text-sm font-medium text-slate-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Google…
          </div>
        )}

        <div
          ref={buttonRef}
          aria-label="Continue with Google"
          className={[
            'flex min-h-11 w-full items-center justify-center overflow-hidden rounded-lg',
            scriptReady
              ? ''
              : 'hidden',
          ].join(' ')}
        />

        {isSubmitting && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-white/95 text-sm font-medium text-slate-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening Meridian…
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-rose-300/15 bg-rose-300/[0.05] px-4 py-3 text-xs leading-5 text-rose-200"
        >
          {error}
        </div>
      )}

      <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-slate-600">
        <ShieldCheck className="h-3 w-3" />
        Google verifies your identity;
        Meridian keeps its own secure session.
      </div>
    </>
  );
}
