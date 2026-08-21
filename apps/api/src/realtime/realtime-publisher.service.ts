import { Injectable } from '@nestjs/common';
import type { Namespace } from 'socket.io';

import type { ItineraryChangedEvent } from './realtime.types';

@Injectable()
export class RealtimePublisherService {
  private namespace: Namespace | null = null;

  attach(namespace: Namespace): void {
    this.namespace = namespace;
  }

  publishItineraryChanged(event: Omit<ItineraryChangedEvent, 'occurredAt'>): void {
    this.namespace?.to(this.tripRoom(event.tripId)).emit('itinerary:changed', {
      ...event,
      occurredAt: new Date().toISOString(),
    } satisfies ItineraryChangedEvent);
  }

  private tripRoom(tripId: string): string {
    return `trip:${tripId}`;
  }
}
