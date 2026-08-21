'use client';

import {
  CircleAlert,
  LoaderCircle,
  Mail,
  ShieldCheck,
  Trash2,
  UserRoundPlus,
  UsersRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useModalBehavior } from '../../../hooks/use-modal-behavior';
import type {
  TripCollaborator,
  TripMemberRole,
} from '../../trips/types/trip.types';

interface ShareJourneyDialogProps {
  tripId: string;
  tripName: string;
  onClose: () => void;
}

type LoadState =
  | { status: 'loading'; collaborators: TripCollaborator[]; error: null }
  | { status: 'success'; collaborators: TripCollaborator[]; error: null }
  | { status: 'error'; collaborators: TripCollaborator[]; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;

  const message = payload['message'];

  if (typeof message === 'string') return message;

  if (
    Array.isArray(message) &&
    message.every((item) => typeof item === 'string')
  ) {
    return message.join(', ');
  }

  return fallback;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function readCollaborators(payload: unknown): TripCollaborator[] | null {
  if (Array.isArray(payload)) return payload as TripCollaborator[];

  if (isRecord(payload) && Array.isArray(payload['data'])) {
    return payload['data'] as TripCollaborator[];
  }

  return null;
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'M'
  );
}

async function fetchCollaborators(
  tripId: string,
): Promise<TripCollaborator[]> {
  const response = await fetch(
    `/api/trips/${encodeURIComponent(tripId)}/collaborators`,
    {
      method: 'GET',
      cache: 'no-store',
    },
  );

  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(
      readErrorMessage(
        payload,
        'Unable to load journey access.',
      ),
    );
  }

  const collaborators =
    readCollaborators(payload);

  if (!collaborators) {
    throw new Error(
      'Meridian received an invalid collaborators response.',
    );
  }

  return collaborators;
}

export function ShareJourneyDialog({
  tripId,
  tripName,
  onClose,
}: ShareJourneyDialogProps) {
  const [state, setState] = useState<LoadState>({
    status: 'loading',
    collaborators: [],
    error: null,
  });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TripMemberRole>('EDITOR');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [changingMemberId, setChangingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const busy =
    inviting ||
    changingMemberId !== null ||
    removingMemberId !== null;

  useModalBehavior({
    open: true,
    disabled: busy,
    onClose,
  });

  async function reloadCollaborators(): Promise<void> {
    try {
      const collaborators =
        await fetchCollaborators(
          tripId,
        );

      setState({
        status: 'success',
        collaborators,
        error: null,
      });
    } catch (error) {
      setState({
        status: 'error',
        collaborators: [],
        error:
          error instanceof Error
            ? error.message
            : 'Collaborators service is currently unavailable.',
      });
    }
  }

  useEffect(() => {
    let cancelled = false;

    void fetchCollaborators(
      tripId,
    ).then(
      (collaborators) => {
        if (cancelled) {
          return;
        }

        setState({
          status: 'success',
          collaborators,
          error: null,
        });
      },
      (error: unknown) => {
        if (cancelled) {
          return;
        }

        setState({
          status: 'error',
          collaborators: [],
          error:
            error instanceof Error
              ? error.message
              : 'Collaborators service is currently unavailable.',
        });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [tripId]);

  const sortedCollaborators = useMemo(
    () =>
      [...state.collaborators].sort((left, right) =>
        left.user.name.localeCompare(right.user.name),
      ),
    [state.collaborators],
  );

  async function invite(): Promise<void> {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setInviteError('Enter the email of a Meridian account.');
      return;
    }

    setInviting(true);
    setInviteError(null);

    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/collaborators`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: normalizedEmail,
            role,
          }),
        },
      );

      const payload = await readJson(response);

      if (!response.ok) {
        setInviteError(
          readErrorMessage(payload, 'Unable to add collaborator.'),
        );
        return;
      }

      setEmail('');
      setRole('EDITOR');
      await reloadCollaborators();
    } catch {
      setInviteError('Collaborators service is currently unavailable.');
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(
    collaborator: TripCollaborator,
    nextRole: TripMemberRole,
  ): Promise<void> {
    if (collaborator.role === nextRole) return;

    setChangingMemberId(collaborator.id);

    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/collaborators/${encodeURIComponent(
          collaborator.id,
        )}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ role: nextRole }),
        },
      );

      if (!response.ok) {
        await reloadCollaborators();
        return;
      }

      setState((current) => ({
        status: 'success',
        error: null,
        collaborators: current.collaborators.map((member) =>
          member.id === collaborator.id
            ? { ...member, role: nextRole }
            : member,
        ),
      }));
    } catch {
      await reloadCollaborators();
    } finally {
      setChangingMemberId(null);
    }
  }

  async function remove(collaborator: TripCollaborator): Promise<void> {
    if (!window.confirm(`Remove ${collaborator.user.name} from this journey?`)) {
      return;
    }

    setRemovingMemberId(collaborator.id);

    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/collaborators/${encodeURIComponent(
          collaborator.id,
        )}`,
        { method: 'DELETE' },
      );

      if (!response.ok) {
        await reloadCollaborators();
        return;
      }

      setState((current) => ({
        status: 'success',
        error: null,
        collaborators: current.collaborators.filter(
          (member) => member.id !== collaborator.id,
        ),
      }));
    } catch {
      await reloadCollaborators();
    } finally {
      setRemovingMemberId(null);
    }
  }

  const memberCount = state.collaborators.length + 1;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Share journey"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !busy) {
          onClose();
        }
      }}
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[1.8rem] border border-white/[0.1] bg-[#09131e] shadow-[0_30px_120px_rgba(0,0,0,0.65)]">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/[0.07] bg-[#09131e]/95 px-5 py-5 backdrop-blur-xl sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sky-300">
              <UsersRound className="h-4 w-4" strokeWidth={1.7} />
              <p className="text-[10px] font-semibold uppercase tracking-[0.19em]">
                Collaboration
              </p>
            </div>

            <h2 className="mt-2 truncate text-xl font-semibold tracking-[-0.035em] text-white">
              Share {tripName}
            </h2>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Invite existing Meridian accounts and choose what they can change.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] text-slate-400 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
            aria-label="Close share dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-5 sm:p-6">
          <section className="rounded-[1.45rem] border border-sky-300/10 bg-sky-300/[0.035] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-300/15 bg-sky-300/[0.06] text-sky-200">
                <UserRoundPlus className="h-4 w-4" strokeWidth={1.8} />
              </div>

              <div>
                <p className="text-sm font-semibold text-white">
                  Add collaborator
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  The email must already belong to a registered Meridian account.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
              <label className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setInviteError(null);
                  }}
                  placeholder="friend@email.com"
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-300/35"
                />
              </label>

              <select
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as TripMemberRole)
                }
                className="h-11 rounded-xl border border-white/[0.08] bg-[#0a1722] px-3 text-sm text-white outline-none focus:border-sky-300/35"
              >
                <option value="EDITOR">Editor</option>
                <option value="VIEWER">Viewer</option>
              </select>

              <button
                type="button"
                onClick={() => void invite()}
                disabled={inviting || email.trim().length === 0}
                className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {inviting ? 'Adding...' : 'Add'}
              </button>
            </div>

            {inviteError && (
              <div className="mt-3 flex gap-2 rounded-xl border border-rose-300/10 bg-rose-300/[0.04] px-3.5 py-3 text-xs text-rose-200">
                <CircleAlert className="h-4 w-4 shrink-0" />
                {inviteError}
              </div>
            )}
          </section>

          <section className="mt-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  People with access
                </p>
                <p className="mt-1 text-sm font-medium text-white">
                  {memberCount} {memberCount === 1 ? 'member' : 'members'}
                </p>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5" />
                Owner controls access
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-[1.4rem] border border-white/[0.07]">
              <div className="flex items-center gap-3 bg-white/[0.025] px-4 py-4 sm:px-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-300/15 bg-sky-300/[0.07] text-[10px] font-semibold text-sky-100">
                  YOU
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">You</p>
                  <p className="mt-0.5 text-xs text-slate-500">Journey owner</p>
                </div>
                <span className="rounded-full border border-sky-300/15 bg-sky-300/[0.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-sky-100">
                  Owner
                </span>
              </div>

              {state.status === 'loading' && (
                <div className="flex items-center justify-center gap-2 border-t border-white/[0.06] px-4 py-8 text-xs text-slate-500">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Loading access…
                </div>
              )}

              {state.status === 'error' && (
                <div className="border-t border-white/[0.06] px-4 py-5">
                  <p className="text-xs text-rose-200">{state.error}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setState({
                        status: 'loading',
                        collaborators: state.collaborators,
                        error: null,
                      });
                      void reloadCollaborators();
                    }}
                    className="mt-3 text-xs font-semibold text-sky-200"
                  >
                    Try again
                  </button>
                </div>
              )}

              {state.status === 'success' &&
                sortedCollaborators.length === 0 && (
                  <div className="border-t border-white/[0.06] px-4 py-8 text-center text-xs text-slate-500">
                    No collaborators yet.
                  </div>
                )}

              {state.status === 'success' &&
                sortedCollaborators.map((collaborator) => {
                  const changing = changingMemberId === collaborator.id;
                  const removing = removingMemberId === collaborator.id;

                  return (
                    <div
                      key={collaborator.id}
                      className="flex flex-col gap-3 border-t border-white/[0.06] bg-black/[0.08] px-4 py-4 sm:flex-row sm:items-center sm:px-5"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-xs font-semibold text-slate-300">
                          {initials(collaborator.user.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">
                            {collaborator.user.name}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {collaborator.user.email}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={collaborator.role}
                          disabled={changing || removing}
                          onChange={(event) =>
                            void changeRole(
                              collaborator,
                              event.target.value as TripMemberRole,
                            )
                          }
                          className="h-9 min-w-28 rounded-xl border border-white/[0.08] bg-[#0a1722] px-3 text-xs text-slate-200 outline-none"
                        >
                          <option value="EDITOR">Editor</option>
                          <option value="VIEWER">Viewer</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => void remove(collaborator)}
                          disabled={changing || removing}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-300/10 bg-rose-300/[0.025] text-rose-200/55 transition hover:bg-rose-300/[0.08] hover:text-rose-100 disabled:opacity-40"
                          aria-label={`Remove ${collaborator.user.name}`}
                        >
                          {removing ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>

          <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[11px] leading-5 text-slate-500">
            Editors can change the itinerary, places, budget and expenses. Viewers can explore the shared workspace and receive live updates without editing it.
          </div>
        </div>
      </div>
    </div>
  );
}
