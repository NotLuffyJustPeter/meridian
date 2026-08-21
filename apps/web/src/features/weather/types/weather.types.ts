export type WeatherAvailability =
  | 'AVAILABLE'
  | 'PARTIAL'
  | 'OUT_OF_RANGE'
  | 'LOCATION_NOT_FOUND';

export type WeatherCondition =
  | 'CLEAR'
  | 'MOSTLY_CLEAR'
  | 'PARTLY_CLOUDY'
  | 'CLOUDY'
  | 'FOG'
  | 'DRIZZLE'
  | 'RAIN'
  | 'SNOW'
  | 'SHOWERS'
  | 'THUNDERSTORM'
  | 'UNKNOWN';

export interface WeatherLocation {
  name: string;
  country: string | null;
  latitude: number;
  longitude: number;
}

export interface WeatherDay {
  date: string;
  available: boolean;
  weatherCode: number | null;
  condition: WeatherCondition | null;
  temperatureMaxC: number | null;
  temperatureMinC: number | null;
  precipitationProbabilityMax: number | null;
  precipitationMm: number | null;
  windSpeedMaxKmh: number | null;
  sunrise: string | null;
  sunset: string | null;
}

export interface TripWeather {
  tripId: string;
  destination: string;
  timezone: string;
  location: WeatherLocation | null;
  provider: 'open-meteo';
  availability: WeatherAvailability;
  forecastWindow: {
    requestedStartDate: string;
    requestedEndDate: string;
    availableStartDate: string | null;
    availableEndDate: string | null;
  };
  days: WeatherDay[];
}
