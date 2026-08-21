import type { AccessTokenPayload } from '../auth/auth.types';

export type RealtimeTicketPayload = Omit<AccessTokenPayload, 'type'> & {
  type: 'realtime';
};

export type ItineraryChangeType = 'created' | 'updated' | 'deleted' | 'reordered';

export interface ItineraryChangedEvent {
  tripId: string;
  dayId: string;
  type: ItineraryChangeType;
  activityId?: string;
  occurredAt: string;
}

export interface TripPresenceEvent {
  tripId: string;
  onlineUsers: number;
}
