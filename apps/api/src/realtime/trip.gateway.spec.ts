import type { Namespace, Socket } from 'socket.io';

import { TripsService } from '../trips/trips.service';
import { RealtimePublisherService } from './realtime-publisher.service';
import { RealtimeTicketService } from './realtime-ticket.service';
import type { RealtimeTicketPayload } from './realtime.types';
import { TripGateway } from './trip.gateway';

type TestSocket = Socket & {
  data: {
    user?: RealtimeTicketPayload;
  };
};

const USER_ONE: RealtimeTicketPayload = {
  sub: 'user-one',
  email: 'one@meridian.test',
  role: 'USER',
  type: 'realtime',
};

const USER_TWO: RealtimeTicketPayload = {
  sub: 'user-two',
  email: 'two@meridian.test',
  role: 'USER',
  type: 'realtime',
};

describe('TripGateway', () => {
  let verifyTicket: ReturnType<typeof jest.fn>;
  let findAccessibleTripOrThrow: ReturnType<typeof jest.fn>;
  let attach: ReturnType<typeof jest.fn>;
  let namespaceUse: ReturnType<typeof jest.fn>;
  let namespaceTo: ReturnType<typeof jest.fn>;
  let roomEmit: ReturnType<typeof jest.fn>;
  let gateway: TripGateway;

  function createSocket(
    id: string,
    user?: RealtimeTicketPayload,
    ticket: unknown = 'valid-ticket',
  ) {
    const join = jest.fn(async (_room: string) => undefined);
    const leave = jest.fn(async (_room: string) => undefined);
    const emit = jest.fn();

    const socket = {
      id,
      data: user
        ? {
            user,
          }
        : {},
      handshake: {
        auth: {
          ticket,
        },
      },
      join,
      leave,
      emit,
    } as unknown as TestSocket;

    return {
      socket,
      join,
      leave,
      emit,
    };
  }

  beforeEach(() => {
    verifyTicket = jest.fn(async (_ticket: string) => USER_ONE);

    findAccessibleTripOrThrow = jest.fn(async (_userId: string, _tripId: string) => ({
      id: 'trip-one',
      accessRole: 'EDITOR' as const,
    }));

    attach = jest.fn();

    const realtimeTicketService = {
      verifyTicket,
    } as unknown as RealtimeTicketService;

    const tripsService = {
      findAccessibleTripOrThrow,
    } as unknown as TripsService;

    const realtimePublisher = {
      attach,
    } as unknown as RealtimePublisherService;

    gateway = new TripGateway(realtimeTicketService, tripsService, realtimePublisher);

    roomEmit = jest.fn();

    namespaceTo = jest.fn(() => ({
      emit: roomEmit,
    }));

    namespaceUse = jest.fn();

    const namespace = {
      use: namespaceUse,
      to: namespaceTo,
    } as unknown as Namespace;

    gateway.afterInit(namespace);
  });

  it('attaches the publisher and authenticates a valid realtime ticket', async () => {
    expect(attach).toHaveBeenCalledTimes(1);
    expect(namespaceUse).toHaveBeenCalledTimes(1);

    const middleware = namespaceUse.mock.calls[0]?.[0] as unknown as (
      socket: TestSocket,
      next: (error?: Error) => void,
    ) => Promise<void>;

    const { socket } = createSocket('socket-one');
    const next = jest.fn();

    await middleware(socket, next);

    expect(verifyTicket).toHaveBeenCalledWith('valid-ticket');
    expect(socket.data.user).toEqual(USER_ONE);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a connection without a realtime ticket', async () => {
    const middleware = namespaceUse.mock.calls[0]?.[0] as unknown as (
      socket: TestSocket,
      next: (error?: Error) => void,
    ) => Promise<void>;

    const { socket } = createSocket('socket-one', undefined, null);

    const next = jest.fn();

    await middleware(socket, next);

    expect(verifyTicket).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);

    const error = next.mock.calls[0]?.[0] as Error | undefined;

    expect(error?.message).toBe('Realtime ticket is required');
  });

  it('joins an authorized trip room and emits presence', async () => {
    const { socket, join, emit } = createSocket('socket-one', USER_ONE);

    gateway.handleConnection(socket);

    await gateway.joinTrip(socket, {
      tripId: 'trip-one',
    });

    expect(findAccessibleTripOrThrow).toHaveBeenCalledWith(USER_ONE.sub, 'trip-one');

    expect(join).toHaveBeenCalledWith('trip:trip-one');

    expect(emit).toHaveBeenCalledWith('trip:joined', {
      tripId: 'trip-one',
      accessRole: 'EDITOR',
    });

    expect(namespaceTo).toHaveBeenCalledWith('trip:trip-one');

    expect(roomEmit).toHaveBeenLastCalledWith('trip:presence', {
      tripId: 'trip-one',
      onlineUsers: 1,
    });
  });

  it('denies room access when the user cannot access the trip', async () => {
    findAccessibleTripOrThrow.mockImplementationOnce(async () => {
      throw new Error('Trip not found');
    });

    const { socket, join, emit } = createSocket('socket-one', USER_ONE);

    gateway.handleConnection(socket);

    await gateway.joinTrip(socket, {
      tripId: 'trip-one',
    });

    expect(join).not.toHaveBeenCalled();

    expect(emit).toHaveBeenCalledWith('trip:error', {
      tripId: 'trip-one',
      message: 'Trip access denied',
    });
  });

  it('counts unique users rather than browser tabs and updates presence on disconnect', async () => {
    const firstTab = createSocket('socket-one', USER_ONE);

    const secondTab = createSocket('socket-two', USER_ONE);

    const otherUser = createSocket('socket-three', USER_TWO);

    gateway.handleConnection(firstTab.socket);
    gateway.handleConnection(secondTab.socket);
    gateway.handleConnection(otherUser.socket);

    await gateway.joinTrip(firstTab.socket, {
      tripId: 'trip-one',
    });

    expect(roomEmit).toHaveBeenLastCalledWith('trip:presence', {
      tripId: 'trip-one',
      onlineUsers: 1,
    });

    await gateway.joinTrip(secondTab.socket, {
      tripId: 'trip-one',
    });

    expect(roomEmit).toHaveBeenLastCalledWith('trip:presence', {
      tripId: 'trip-one',
      onlineUsers: 1,
    });

    await gateway.joinTrip(otherUser.socket, {
      tripId: 'trip-one',
    });

    expect(roomEmit).toHaveBeenLastCalledWith('trip:presence', {
      tripId: 'trip-one',
      onlineUsers: 2,
    });

    gateway.handleDisconnect(firstTab.socket);

    expect(roomEmit).toHaveBeenLastCalledWith('trip:presence', {
      tripId: 'trip-one',
      onlineUsers: 2,
    });

    gateway.handleDisconnect(secondTab.socket);

    expect(roomEmit).toHaveBeenLastCalledWith('trip:presence', {
      tripId: 'trip-one',
      onlineUsers: 1,
    });
  });
});
