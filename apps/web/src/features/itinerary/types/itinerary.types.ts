export type ActivityCategory =
  | 'SIGHTSEEING'
  | 'FOOD'
  | 'TRANSPORT'
  | 'LODGING'
  | 'SHOPPING'
  | 'ENTERTAINMENT'
  | 'OTHER';

export interface Activity {
  id: string;
  tripDayId: string;
  placeId: string | null;
  title: string;
  description: string | null;
  category: ActivityCategory;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface TripDay {
  id: string;
  tripId: string;
  date: string;
  dayNumber: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  activities: Activity[];
}

export interface Itinerary {
  tripId: string;
  startDate: string;
  endDate: string;
  timezone: string;
  days: TripDay[];
}

export interface CreateActivityInput {
  title: string;
  description?: string;
  category?: ActivityCategory;
  startTime?: string;
  endTime?: string;
  location?: string;
  notes?: string;
  position?: number;
  placeId?: string;
}

export interface UpdateActivityInput {
  title?: string;
  description?: string;
  category?: ActivityCategory;
  startTime?: string;
  endTime?: string;
  location?: string;
  notes?: string;
  position?: number;
  placeId?: string;
}

export interface ReorderActivitiesInput {
  activityIds: string[];
}
