import { io, type Socket } from 'socket.io-client';

function getRealtimeOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_REALTIME_ORIGIN ??
    'http://127.0.0.1:3001'
  ).replace(/\/$/, '');
}

export function createRealtimeSocket(
  ticket: string,
): Socket {
  return io(`${getRealtimeOrigin()}/realtime`, {
    auth: {
      ticket,
    },
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 750,
    reconnectionDelayMax: 5000,
    transports: ['websocket'],
  });
}
