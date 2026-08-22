import type { Namespace, Socket } from 'socket.io';

import { TripsService } from '../trips/trips.service';
import { RealtimePublisherService } from './realtime-publisher.service';
import { RealtimeTicketService } from './realtime-ticket.service';
import type { RealtimeTicketPayload } from './realtime.types';
import { TripGateway } from './trip.gateway';

type TestSocket = Omit<Socket, 'data' | 'handshake'> & {
  data: {
    user?: RealtimeTicketPayload;
  };
  handshake: Omit<Socket['handshake'], 'auth'> & {
    auth: Record<string, unknown>;
  };
};

type TestMiddleware = (socket: TestSocket, next: (error?: Error) => void) => void;

type VerifyTicketMock = jest.Mock<Promise<RealtimeTicketPayload>, [string]>;

type AccessibleTrip = {
  id: string;
  accessRole: 'EDITOR';
};

type FindTripMock = jest.Mock<Promise<AccessibleTrip>, [string, string]>;

type AttachMock = jest.Mock<void, [Namespace]>;

type RoomEmitMock = jest.Mock<void, [string, unknown]>;

type NamespaceToMock = jest.Mock<
  {
    emit: RoomEmitMock;
  },
  [string]
>;

type NamespaceUseMock = jest.Mock<void, [TestMiddleware]>;

type NextMock = jest.Mock<void, [Error?]>;

type JoinMock = jest.Mock<Promise<void>, [string]>;

type LeaveMock = jest.Mock<Promise<void>, [string]>;

type SocketEmitMock = jest.Mock<boolean, [string, unknown]>;

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

function flushPromises(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

describe('TripGateway', () => {
  let verifyTicket: VerifyTicketMock;

  let findAccessibleTripOrThrow: FindTripMock;

  let attach: AttachMock;

  let namespaceUse: NamespaceUseMock;

  let namespaceTo: NamespaceToMock;

  let roomEmit: RoomEmitMock;

  let gateway: TripGateway;

  function createSocket(
    id: string,
    user?: RealtimeTicketPayload,
    ticket: unknown = 'valid-ticket',
  ) {
    const join: JoinMock = jest.fn<Promise<void>, [string]>(() => Promise.resolve());

    const leave: LeaveMock = jest.fn<Promise<void>, [string]>(() => Promise.resolve());

    const emit: SocketEmitMock = jest.fn<boolean, [string, unknown]>(() => true);

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
    verifyTicket = jest.fn<Promise<RealtimeTicketPayload>, [string]>(() =>
      Promise.resolve(USER_ONE),
    );

    findAccessibleTripOrThrow = jest.fn<Promise<AccessibleTrip>, [string, string]>(() =>
      Promise.resolve({
        id: 'trip-one',
        accessRole: 'EDITOR',
      }),
    );

    attach = jest.fn<void, [Namespace]>();

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

    roomEmit = jest.fn<void, [string, unknown]>();

    namespaceTo = jest.fn<
      {
        emit: RoomEmitMock;
      },
      [string]
    >(() => ({
      emit: roomEmit,
    }));

    namespaceUse = jest.fn<void, [TestMiddleware]>();

    const namespace = {
      use: namespaceUse,
      to: namespaceTo,
    } as unknown as Namespace;

    gateway.afterInit(namespace);
  });

  it('attaches publisher and authenticates a valid ticket', async () => {
    expect(attach).toHaveBeenCalledTimes(1);

    expect(namespaceUse).toHaveBeenCalledTimes(1);

    const middleware = namespaceUse.mock.calls[0]?.[0];

    expect(middleware).toBeDefined();

    if (!middleware) {
      throw new Error('Realtime middleware was not registered');
    }

    const { socket } = createSocket('socket-one');

    const next: NextMock = jest.fn<void, [Error?]>();

    middleware(socket, next);

    await flushPromises();

    expect(verifyTicket).toHaveBeenCalledWith('valid-ticket');

    expect(socket.data.user).toEqual(USER_ONE);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a connection without a ticket', async () => {
    const middleware = namespaceUse.mock.calls[0]?.[0];

    expect(middleware).toBeDefined();

    if (!middleware) {
      throw new Error('Realtime middleware was not registered');
    }

    const { socket } = createSocket('socket-one', undefined, null);

    const next: NextMock = jest.fn<void, [Error?]>();

    middleware(socket, next);

    await flushPromises();

    expect(verifyTicket).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledTimes(1);

    const firstCall = next.mock.calls[0];

    expect(firstCall).toBeDefined();

    const error = firstCall?.[0];

    expect(error).toBeInstanceOf(Error);

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

  it('denies room access when user cannot access the trip', async () => {
    findAccessibleTripOrThrow.mockImplementationOnce(() =>
      Promise.reject(new Error('Trip not found')),
    );

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

  it('counts unique users and updates presence on disconnect', async () => {
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
