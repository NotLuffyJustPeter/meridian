import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';

import { TripsService } from '../trips/trips.service';
import { JoinTripDto } from './dto/join-trip.dto';
import { RealtimePublisherService } from './realtime-publisher.service';
import { RealtimeTicketService } from './realtime-ticket.service';
import type { RealtimeTicketPayload, TripPresenceEvent } from './realtime.types';

type MeridianSocketData = {
  user?: RealtimeTicketPayload;
};

type MeridianSocket = Omit<Socket, 'data' | 'handshake'> & {
  data: MeridianSocketData;
  handshake: Omit<Socket['handshake'], 'auth'> & {
    auth: Record<string, unknown>;
  };
};

type NamespaceMiddleware = Parameters<Namespace['use']>[0];

type NamespaceMiddlewareNext = Parameters<NamespaceMiddleware>[1];

function realtimeCorsOrigins(): string[] {
  return (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: realtimeCorsOrigins(),
    credentials: true,
  },
})
export class TripGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  namespace!: Namespace;

  private readonly socketTrips = new Map<string, Set<string>>();

  private readonly tripPresence = new Map<string, Map<string, Set<string>>>();

  constructor(
    private readonly realtimeTicketService: RealtimeTicketService,
    private readonly tripsService: TripsService,
    private readonly realtimePublisher: RealtimePublisherService,
  ) {}

  afterInit(namespace: Namespace): void {
    this.namespace = namespace;

    this.realtimePublisher.attach(namespace);

    namespace.use((socket, next) => {
      void this.authenticateSocket(socket as MeridianSocket, next);
    });
  }

  handleConnection(client: MeridianSocket): void {
    this.socketTrips.set(client.id, new Set());
  }

  handleDisconnect(client: MeridianSocket): void {
    const tripIds = this.socketTrips.get(client.id);

    const userId = client.data.user?.sub;

    if (tripIds && userId) {
      for (const tripId of tripIds) {
        this.removePresence(tripId, userId, client.id);

        this.emitPresence(tripId);
      }
    }

    this.socketTrips.delete(client.id);
  }

  @SubscribeMessage('trip:join')
  async joinTrip(
    @ConnectedSocket()
    client: MeridianSocket,
    @MessageBody()
    dto: JoinTripDto,
  ): Promise<void> {
    const user = client.data.user;

    if (!user) {
      client.emit('trip:error', {
        tripId: dto.tripId,
        message: 'Realtime authentication is required',
      });

      return;
    }

    try {
      const trip = await this.tripsService.findAccessibleTripOrThrow(user.sub, dto.tripId);

      const room = this.tripRoom(dto.tripId);

      await client.join(room);

      const joinedTrips = this.socketTrips.get(client.id) ?? new Set<string>();

      joinedTrips.add(dto.tripId);

      this.socketTrips.set(client.id, joinedTrips);

      this.addPresence(dto.tripId, user.sub, client.id);

      client.emit('trip:joined', {
        tripId: dto.tripId,
        accessRole: trip.accessRole,
      });

      this.emitPresence(dto.tripId);
    } catch {
      client.emit('trip:error', {
        tripId: dto.tripId,
        message: 'Trip access denied',
      });
    }
  }

  @SubscribeMessage('trip:leave')
  async leaveTrip(
    @ConnectedSocket()
    client: MeridianSocket,
    @MessageBody()
    dto: JoinTripDto,
  ): Promise<void> {
    const user = client.data.user;

    if (!user) {
      return;
    }

    await client.leave(this.tripRoom(dto.tripId));

    this.socketTrips.get(client.id)?.delete(dto.tripId);

    this.removePresence(dto.tripId, user.sub, client.id);

    this.emitPresence(dto.tripId);
  }

  private async authenticateSocket(
    socket: MeridianSocket,
    next: NamespaceMiddlewareNext,
  ): Promise<void> {
    const ticket = socket.handshake.auth['ticket'];

    if (typeof ticket !== 'string' || !ticket) {
      next(new Error('Realtime ticket is required'));

      return;
    }

    try {
      socket.data.user = await this.realtimeTicketService.verifyTicket(ticket);

      next();
    } catch {
      next(new Error('Invalid or expired realtime ticket'));
    }
  }

  private addPresence(tripId: string, userId: string, socketId: string): void {
    const users = this.tripPresence.get(tripId) ?? new Map<string, Set<string>>();

    const sockets = users.get(userId) ?? new Set<string>();

    sockets.add(socketId);

    users.set(userId, sockets);

    this.tripPresence.set(tripId, users);
  }

  private removePresence(tripId: string, userId: string, socketId: string): void {
    const users = this.tripPresence.get(tripId);

    if (!users) {
      return;
    }

    const sockets = users.get(userId);

    if (!sockets) {
      return;
    }

    sockets.delete(socketId);

    if (sockets.size === 0) {
      users.delete(userId);
    }

    if (users.size === 0) {
      this.tripPresence.delete(tripId);
    }
  }

  private emitPresence(tripId: string): void {
    const payload: TripPresenceEvent = {
      tripId,
      onlineUsers: this.tripPresence.get(tripId)?.size ?? 0,
    };

    this.namespace.to(this.tripRoom(tripId)).emit('trip:presence', payload);
  }

  private tripRoom(tripId: string): string {
    return `trip:${tripId}`;
  }
}
