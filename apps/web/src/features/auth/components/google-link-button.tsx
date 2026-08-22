'use client';

import {
  Loader2,
} from 'lucide-react';
import Script from 'next/script';
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

type GoogleAccountsId = {
  initialize(config: {
    client_id: string;
    callback: (
      response: GoogleCredentialResponse,
    ) => void;
    ux_mode?: 'popup';
  }): void;

  renderButton(
    parent: HTMLElement,
    options: {
      type?: 'standard';
      theme?: 'outline';
      size?: 'large';
      text?: 'continue_with';
      shape?: 'rectangular';
      logo_alignment?: 'left';
      width?: number;
    },
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

type GoogleLinkButtonProps = {
  clientId: string;
  onLinked: () => Promise<void>;
};

export function GoogleLinkButton({
  clientId,
  onLinked,
}: GoogleLinkButtonProps) {
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
      ) => {
        const credential =
          response.credential;

        if (!credential) {
          setError(
            'Google did not return a valid credential.',
          );
          return;
        }

        setError(null);
        setIsSubmitting(true);

        try {
          const apiResponse =
            await fetch(
              '/api/auth/google/link',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body: JSON.stringify({
                  credential,
                }),
              },
            );

          if (!apiResponse.ok) {
            setError(
              await getApiErrorMessage(
                apiResponse,
                'Unable to connect Google',
              ),
            );
            return;
          }

          await onLinked();
        } catch {
          setError(
            'Unable to connect Google right now. Please try again.',
          );
        } finally {
          setIsSubmitting(false);
        }
      },
      [
        onLinked,
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

        google.accounts.id.initialize({
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
        });

        const width =
          Math.min(
            360,
            Math.max(
              220,
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
    return (
      <p className="text-xs leading-5 text-amber-200/80">
        Google linking is not configured for this environment.
      </p>
    );
  }

  return (
    <div>
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

      <div className="relative max-w-[360px]">
        {!scriptReady && (
          <div className="flex h-11 items-center justify-center gap-2 rounded-lg border border-white/[0.09] bg-white text-sm font-medium text-slate-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Google…
          </div>
        )}

        <div
          ref={buttonRef}
          aria-label="Connect Google account"
          className={[
            'flex min-h-11 w-full items-center overflow-hidden rounded-lg',
            scriptReady
              ? ''
              : 'hidden',
          ].join(' ')}
        />

        {isSubmitting && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-white/95 text-sm font-medium text-slate-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            Connecting…
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 max-w-[520px] rounded-xl border border-rose-300/15 bg-rose-300/[0.05] px-4 py-3 text-xs leading-5 text-rose-200"
        >
          {error}
        </div>
      )}
    </div>
  );
}
