'use client';

import {
  useEffect,
  useRef,
  useState,
} from 'react';
import type { Socket } from 'socket.io-client';

import { createRealtimeSocket } from '../lib/realtime-client';
import type {
  ItineraryChangedEvent,
  RealtimeConnectionStatus,
  RealtimeTicketResponse,
  TripJoinedEvent,
  TripPresenceEvent,
} from '../types/realtime.types';

interface UseTripRealtimeOptions {
  tripId: string;
  onItineraryChanged: () => void;
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readTicket(
  payload: unknown,
): RealtimeTicketResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  const candidate =
    isRecord(payload['data'])
      ? payload['data']
      : payload;

  const ticket = candidate['ticket'];
  const expiresInSeconds =
    candidate['expiresInSeconds'];

  if (
    typeof ticket !== 'string' ||
    typeof expiresInSeconds !== 'number'
  ) {
    return null;
  }

  return {
    ticket,
    expiresInSeconds,
  };
}

async function requestRealtimeTicket(): Promise<string> {
  const response = await fetch('/api/realtime/ticket', {
    method: 'POST',
    cache: 'no-store',
  });

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error('Unable to create realtime ticket');
  }

  const ticketResponse = readTicket(payload);

  if (!ticketResponse) {
    throw new Error('Realtime ticket response is invalid');
  }

  return ticketResponse.ticket;
}

export function useTripRealtime({
  tripId,
  onItineraryChanged,
}: UseTripRealtimeOptions): {
  status: RealtimeConnectionStatus;
  onlineUsers: number;
} {
  const [
    status,
    setStatus,
  ] =
    useState<RealtimeConnectionStatus>(
      'connecting',
    );

  const [
    onlineUsers,
    setOnlineUsers,
  ] = useState(0);

  const callbackRef =
    useRef(onItineraryChanged);

  useEffect(() => {
    callbackRef.current =
      onItineraryChanged;
  }, [onItineraryChanged]);

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;
    let refreshingTicket = false;

    async function refreshSocketTicket(): Promise<void> {
      if (
        cancelled ||
        !socket ||
        refreshingTicket
      ) {
        return;
      }

      refreshingTicket = true;

      try {
        const ticket =
          await requestRealtimeTicket();

        if (
          cancelled ||
          !socket
        ) {
          return;
        }

        socket.auth = {
          ticket,
        };

        socket.connect();
      } catch {
        if (!cancelled) {
          setStatus('error');
        }
      } finally {
        refreshingTicket = false;
      }
    }

    async function start(): Promise<void> {
      setStatus('connecting');
      setOnlineUsers(0);

      try {
        const ticket =
          await requestRealtimeTicket();

        if (cancelled) {
          return;
        }

        socket =
          createRealtimeSocket(
            ticket,
          );

        socket.on(
          'connect',
          () => {
            if (cancelled) {
              return;
            }

            setStatus(
              'connected',
            );

            socket?.emit(
              'trip:join',
              {
                tripId,
              },
            );
          },
        );

        socket.on(
          'trip:joined',
          (
            event: TripJoinedEvent,
          ) => {
            if (
              event.tripId !==
              tripId
            ) {
              return;
            }

            callbackRef.current();
          },
        );

        socket.on(
          'trip:presence',
          (
            event: TripPresenceEvent,
          ) => {
            if (
              event.tripId ===
              tripId
            ) {
              setOnlineUsers(
                event.onlineUsers,
              );
            }
          },
        );

        socket.on(
          'itinerary:changed',
          (
            event: ItineraryChangedEvent,
          ) => {
            if (
              event.tripId ===
              tripId
            ) {
              callbackRef.current();
            }
          },
        );

        socket.on(
          'trip:error',
          () => {
            if (!cancelled) {
              setStatus('error');
            }
          },
        );

        socket.on(
          'disconnect',
          (reason) => {
            if (cancelled) {
              return;
            }

            setOnlineUsers(0);
            setStatus(
              'disconnected',
            );

            if (
              reason ===
              'io server disconnect'
            ) {
              void refreshSocketTicket();
            }
          },
        );

        socket.on(
          'connect_error',
          () => {
            if (cancelled) {
              return;
            }

            setStatus('connecting');
            void refreshSocketTicket();
          },
        );

        socket.connect();
      } catch {
        if (!cancelled) {
          setStatus('error');
        }
      }
    }

    void start();

    return () => {
      cancelled = true;

      if (socket) {
        if (socket.connected) {
          socket.emit(
            'trip:leave',
            {
              tripId,
            },
          );
        }

        socket.removeAllListeners();
        socket.disconnect();
      }
    };
  }, [tripId]);

  return {
    status,
    onlineUsers,
  };
}
