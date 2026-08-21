import type { ExpenseCategory } from '../../generated/prisma/client';
import type { WeatherCondition } from '../../weather/weather.types';

export interface JourneyContextTrip {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  timezone: string;
  currency: string;
  status: 'DRAFT' | 'PLANNED' | 'ARCHIVED';
  travelDates: string[];
}

export interface JourneyContextActivity {
  id: string;
  title: string;
  description: string | null;
  category: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
  position: number;
}

export interface JourneyContextDay {
  id: string;
  date: string;
  dayNumber: number;
  notes: string | null;
  activities: JourneyContextActivity[];
}

export interface JourneyContextPlace {
  id: string;
  name: string;
  category: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  website: string | null;
}

export interface JourneyContextBudgetCategory {
  category: ExpenseCategory;
  limitAmount: string | null;
  spentAmount: string;
}

export interface JourneyContextBudget {
  configured: boolean;
  totalAmount: string | null;
  totalSpent: string;
  remainingAmount: string | null;
  categories: JourneyContextBudgetCategory[];
}

export type JourneyContextWeatherAvailability =
  'AVAILABLE' | 'PARTIAL' | 'OUT_OF_RANGE' | 'LOCATION_NOT_FOUND' | 'UNAVAILABLE';

export interface JourneyContextWeatherDay {
  date: string;
  available: boolean;
  condition: WeatherCondition | null;
  temperatureMaxC: number | null;
  temperatureMinC: number | null;
  precipitationProbabilityMax: number | null;
  precipitationMm: number | null;
  windSpeedMaxKmh: number | null;
}

export interface JourneyContextWeather {
  availability: JourneyContextWeatherAvailability;
  days: JourneyContextWeatherDay[];
}

export interface JourneyContext {
  trip: JourneyContextTrip;
  itinerary: JourneyContextDay[];
  savedPlaces: JourneyContextPlace[];
  budget: JourneyContextBudget;
  weather: JourneyContextWeather;
}
