export type PlaceCategory =
  | 'LANDMARK'
  | 'FOOD'
  | 'LODGING'
  | 'SHOPPING'
  | 'TRANSPORT'
  | 'ENTERTAINMENT'
  | 'NATURE'
  | 'OTHER';

export interface Place {
  id: string;
  tripId: string;
  name: string;
  category: PlaceCategory;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  website: string | null;
  sourceProvider: string | null;
  sourcePlaceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlaceInput {
  name: string;
  category?: PlaceCategory;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  website?: string | null;
  sourceProvider?: string | null;
  sourcePlaceId?: string | null;
}

export interface UpdatePlaceInput {
  name?: string;
  category?: PlaceCategory;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  website?: string | null;
  sourceProvider?: string | null;
  sourcePlaceId?: string | null;
}