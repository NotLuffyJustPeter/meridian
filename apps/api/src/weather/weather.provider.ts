import type { ProviderForecast, WeatherLocation } from './weather.types';

export const WEATHER_PROVIDER = Symbol('WEATHER_PROVIDER');

export interface WeatherProvider {
  resolveLocation(query: string): Promise<WeatherLocation | null>;

  getForecast(location: WeatherLocation, timezone: string): Promise<ProviderForecast>;
}

export class WeatherProviderUnavailableError extends Error {
  constructor(message = 'Weather provider is unavailable') {
    super(message);
    this.name = 'WeatherProviderUnavailableError';
  }
}
