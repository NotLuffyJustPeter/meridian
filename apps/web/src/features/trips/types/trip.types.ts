export type TripStatus =
  | 'DRAFT'
  | 'PLANNED'
  | 'ARCHIVED';

export type TripMemberRole =
  | 'EDITOR'
  | 'VIEWER';

export type TripAccessRole =
  | 'OWNER'
  | TripMemberRole;

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
  accessRole: TripAccessRole;
}

export interface TripCollaborator {
  id: string;
  tripId: string;
  userId: string;
  role: TripMemberRole;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: 'USER' | 'ADMIN';
    createdAt: string;
    updatedAt: string;
  };
}

export interface AddCollaboratorInput {
  email: string;
  role: TripMemberRole;
}

export interface UpdateCollaboratorInput {
  role: TripMemberRole;
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
