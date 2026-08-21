import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';

import { TripsService } from '../trips/trips.service';
import {
  WEATHER_PROVIDER,
  type WeatherProvider,
  WeatherProviderUnavailableError,
} from './weather.provider';
import type {
  ProviderForecastDay,
  TripWeather,
  WeatherAvailability,
  WeatherCondition,
  WeatherDay,
} from './weather.types';

@Injectable()
export class WeatherService {
  constructor(
    private readonly tripsService: TripsService,
    @Inject(WEATHER_PROVIDER)
    private readonly weatherProvider: WeatherProvider,
  ) {}

  async getTripWeather(ownerId: string, tripId: string): Promise<TripWeather> {
    const trip = await this.tripsService.findAccessibleTripOrThrow(ownerId, tripId);

    const requestedDates = this.buildTripDates(trip.startDate, trip.endDate);

    const requestedStartDate = requestedDates[0] ?? this.toDateKey(trip.startDate);

    const requestedEndDate = requestedDates.at(-1) ?? this.toDateKey(trip.endDate);

    try {
      const location = await this.weatherProvider.resolveLocation(trip.destination);

      if (!location) {
        return {
          tripId: trip.id,
          destination: trip.destination,
          timezone: trip.timezone,
          location: null,
          provider: 'open-meteo',
          availability: 'LOCATION_NOT_FOUND',
          forecastWindow: {
            requestedStartDate,
            requestedEndDate,
            availableStartDate: null,
            availableEndDate: null,
          },
          days: requestedDates.map((date) => this.unavailableDay(date)),
        };
      }

      const forecast = await this.weatherProvider.getForecast(location, trip.timezone);

      const forecastByDate = new Map<string, ProviderForecastDay>(
        forecast.days.map((day) => [day.date, day]),
      );

      const days = requestedDates.map((date) => {
        const forecastDay = forecastByDate.get(date);

        return forecastDay ? this.availableDay(forecastDay) : this.unavailableDay(date);
      });

      const availability = this.getAvailability(days);

      return {
        tripId: trip.id,
        destination: trip.destination,
        timezone: trip.timezone,
        location,
        provider: 'open-meteo',
        availability,
        forecastWindow: {
          requestedStartDate,
          requestedEndDate,
          availableStartDate: forecast.days[0]?.date ?? null,
          availableEndDate: forecast.days.at(-1)?.date ?? null,
        },
        days,
      };
    } catch (error) {
      if (error instanceof WeatherProviderUnavailableError) {
        throw new ServiceUnavailableException('Weather service is currently unavailable');
      }

      throw error;
    }
  }

  private availableDay(day: ProviderForecastDay): WeatherDay {
    return {
      date: day.date,
      available: true,
      weatherCode: day.weatherCode,
      condition: this.weatherCondition(day.weatherCode),
      temperatureMaxC: day.temperatureMaxC,
      temperatureMinC: day.temperatureMinC,
      precipitationProbabilityMax: day.precipitationProbabilityMax,
      precipitationMm: day.precipitationMm,
      windSpeedMaxKmh: day.windSpeedMaxKmh,
      sunrise: day.sunrise,
      sunset: day.sunset,
    };
  }

  private unavailableDay(date: string): WeatherDay {
    return {
      date,
      available: false,
      weatherCode: null,
      condition: null,
      temperatureMaxC: null,
      temperatureMinC: null,
      precipitationProbabilityMax: null,
      precipitationMm: null,
      windSpeedMaxKmh: null,
      sunrise: null,
      sunset: null,
    };
  }

  private getAvailability(days: WeatherDay[]): WeatherAvailability {
    const availableDays = days.filter((day) => day.available).length;

    if (availableDays === days.length && days.length > 0) {
      return 'AVAILABLE';
    }

    if (availableDays > 0) {
      return 'PARTIAL';
    }

    return 'OUT_OF_RANGE';
  }

  private weatherCondition(weatherCode: number | null): WeatherCondition {
    if (weatherCode === null) {
      return 'UNKNOWN';
    }

    if (weatherCode === 0) {
      return 'CLEAR';
    }

    if (weatherCode === 1) {
      return 'MOSTLY_CLEAR';
    }

    if (weatherCode === 2) {
      return 'PARTLY_CLOUDY';
    }

    if (weatherCode === 3) {
      return 'CLOUDY';
    }

    if (weatherCode === 45 || weatherCode === 48) {
      return 'FOG';
    }

    if ([51, 53, 55, 56, 57].includes(weatherCode)) {
      return 'DRIZZLE';
    }

    if ([61, 63, 65, 66, 67].includes(weatherCode)) {
      return 'RAIN';
    }

    if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
      return 'SNOW';
    }

    if ([80, 81, 82].includes(weatherCode)) {
      return 'SHOWERS';
    }

    if ([95, 96, 99].includes(weatherCode)) {
      return 'THUNDERSTORM';
    }

    return 'UNKNOWN';
  }

  private buildTripDates(startDate: Date, endDate: Date): string[] {
    const cursor = new Date(
      Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()),
    );

    const end = new Date(
      Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()),
    );

    const dates: string[] = [];

    while (cursor.getTime() <= end.getTime()) {
      dates.push(this.toDateKey(cursor));

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return dates;
  }

  private toDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
