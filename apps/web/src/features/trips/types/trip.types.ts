export type TripStatus =
  | 'DRAFT'
  | 'PLANNED'
  | 'ARCHIVED';

export interface Trip {
  id: string;
  ownerId: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  timezone: string;
  currency: string;
  status: TripStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTripInput {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  timezone: string;
  currency: string;
}

export interface UpdateTripInput {
  name?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
  currency?: string;
  status?: TripStatus;
}