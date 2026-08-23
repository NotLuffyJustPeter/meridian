'use client';

import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';

import { createRealtimeSocket } from '../lib/realtime-client';
import type {
  BudgetChangedEvent,
  ItineraryChangedEvent,
  RealtimeConnectionStatus,
  RealtimeTicketResponse,
  TripJoinedEvent,
  TripPresenceEvent,
} from '../types/realtime.types';

interface UseTripRealtimeOptions {
  tripId: string;
  onItineraryChanged?: () => void;
  onBudgetChanged?: () => void;
}

const RETRY_DELAY_MS = 3000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readTicket(payload: unknown): RealtimeTicketResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  const candidate = isRecord(payload['data']) ? payload['data'] : payload;

  const ticket = candidate['ticket'];

  const expiresInSeconds = candidate['expiresInSeconds'];

  if (typeof ticket !== 'string' || typeof expiresInSeconds !== 'number') {
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

  const rawBody = await response.text();

  let payload: unknown = null;

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch {
      payload = null;
    }
  }

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
  onBudgetChanged,
}: UseTripRealtimeOptions): {
  status: RealtimeConnectionStatus;
  onlineUsers: number;
} {
  const [status, setStatus] = useState<RealtimeConnectionStatus>('connecting');

  const [onlineUsers, setOnlineUsers] = useState(0);

  const itineraryCallbackRef = useRef(onItineraryChanged);

  const budgetCallbackRef = useRef(onBudgetChanged);

  useEffect(() => {
    itineraryCallbackRef.current = onItineraryChanged;
  }, [onItineraryChanged]);

  useEffect(() => {
    budgetCallbackRef.current = onBudgetChanged;
  }, [onBudgetChanged]);

  useEffect(() => {
    let cancelled = false;

    let socket: Socket | null = null;

    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    let refreshingTicket = false;

    function clearRetry(): void {
      if (retryTimer !== null) {
        clearTimeout(retryTimer);

        retryTimer = null;
      }
    }

    function disposeSocket(): void {
      if (!socket) {
        return;
      }

      socket.removeAllListeners();

      if (socket.connected) {
        socket.emit('trip:leave', {
          tripId,
        });
      }

      socket.disconnect();

      socket = null;
    }

    function scheduleRestart(): void {
      if (cancelled || retryTimer !== null) {
        return;
      }

      setStatus('disconnected');

      retryTimer = setTimeout(() => {
        retryTimer = null;

        if (cancelled) {
          return;
        }

        disposeSocket();

        void start();
      }, RETRY_DELAY_MS);
    }

    async function refreshSocketTicket(): Promise<void> {
      if (cancelled || !socket || refreshingTicket) {
        return;
      }

      refreshingTicket = true;

      try {
        const ticket = await requestRealtimeTicket();

        if (cancelled || !socket) {
          return;
        }

        socket.auth = {
          ticket,
        };

        socket.connect();
      } catch {
        if (!cancelled) {
          scheduleRestart();
        }
      } finally {
        refreshingTicket = false;
      }
    }

    function registerSocketListeners(currentSocket: Socket): void {
      currentSocket.on('connect', () => {
        if (cancelled || socket !== currentSocket) {
          return;
        }

        clearRetry();

        setStatus('connected');

        currentSocket.emit('trip:join', {
          tripId,
        });
      });

      currentSocket.on('trip:joined', (event: TripJoinedEvent) => {
        if (event.tripId !== tripId) {
          return;
        }

        itineraryCallbackRef.current?.();
        budgetCallbackRef.current?.();
      });

      currentSocket.on('trip:presence', (event: TripPresenceEvent) => {
        if (event.tripId === tripId) {
          setOnlineUsers(event.onlineUsers);
        }
      });

      currentSocket.on('itinerary:changed', (event: ItineraryChangedEvent) => {
        if (event.tripId === tripId) {
          itineraryCallbackRef.current?.();
        }
      });

      currentSocket.on('budget:changed', (event: BudgetChangedEvent) => {
        if (event.tripId === tripId) {
          budgetCallbackRef.current?.();
        }
      });

      currentSocket.on('trip:error', () => {
        if (!cancelled) {
          setStatus('error');
        }
      });

      currentSocket.on('disconnect', (reason) => {
        if (cancelled || socket !== currentSocket) {
          return;
        }

        setOnlineUsers(0);

        setStatus('disconnected');

        if (reason === 'io server disconnect') {
          void refreshSocketTicket();
        }
      });

      currentSocket.on('connect_error', () => {
        if (cancelled || socket !== currentSocket) {
          return;
        }

        setStatus('connecting');

        void refreshSocketTicket();
      });
    }

    async function start(): Promise<void> {
      if (cancelled) {
        return;
      }

      setStatus('connecting');

      setOnlineUsers(0);

      try {
        const ticket = await requestRealtimeTicket();

        if (cancelled) {
          return;
        }

        disposeSocket();

        const nextSocket = createRealtimeSocket(ticket);

        socket = nextSocket;

        registerSocketListeners(nextSocket);

        nextSocket.connect();
      } catch {
        if (!cancelled) {
          scheduleRestart();
        }
      }
    }

    void start();

    return () => {
      cancelled = true;

      clearRetry();

      disposeSocket();
    };
  }, [tripId]);

  return {
    status,
    onlineUsers,
  };
}
