export type RealtimeConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface RealtimeTicketResponse {
  ticket: string;
  expiresInSeconds: number;
}

export interface TripPresenceEvent {
  tripId: string;
  onlineUsers: number;
}

export interface ItineraryChangedEvent {
  tripId: string;
  dayId: string;
  type:
    | 'created'
    | 'updated'
    | 'deleted'
    | 'reordered';
  activityId?: string;
  occurredAt: string;
}

export interface TripJoinedEvent {
  tripId: string;
  accessRole:
    | 'OWNER'
    | 'EDITOR'
    | 'VIEWER';
}
