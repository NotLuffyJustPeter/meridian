import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

import { EXPENSE_CATEGORIES, type ExpenseCategoryValue } from '../../common/expense-categories';
import { PrismaService } from '../../database/prisma.service';
import { TripsService } from '../../trips/trips.service';
import { WeatherService } from '../../weather/weather.service';
import type {
  JourneyContext,
  JourneyContextBudget,
  JourneyContextBudgetCategory,
  JourneyContextWeather,
} from './journey-context.types';

type DecimalLike = {
  toFixed(decimalPlaces?: number): string;
};

@Injectable()
export class JourneyContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tripsService: TripsService,
    private readonly weatherService: WeatherService,
  ) {}

  async build(ownerId: string, tripId: string): Promise<JourneyContext> {
    await this.tripsService.findAccessibleTripOrThrow(ownerId, tripId);

    const trip = await this.prisma.trip.findUnique({
      where: {
        id: tripId,
      },
      include: {
        days: {
          orderBy: {
            dayNumber: 'asc',
          },
          include: {
            activities: {
              orderBy: [
                {
                  position: 'asc',
                },
                {
                  createdAt: 'asc',
                },
              ],
            },
          },
        },
        places: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        budget: {
          include: {
            categoryLimits: true,
          },
        },
        expenses: true,
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    const travelDates = this.buildDateRange(trip.startDate, trip.endDate);

    const budget = this.buildBudget({
      totalAmount: trip.budget?.totalAmount ?? null,
      categoryLimits: trip.budget?.categoryLimits ?? [],
      expenses: trip.expenses,
    });

    const weather = await this.buildWeather(ownerId, tripId);

    return {
      trip: {
        id: trip.id,
        name: trip.name,
        destination: trip.destination,
        startDate: this.toDateKey(trip.startDate),
        endDate: this.toDateKey(trip.endDate),
        timezone: trip.timezone,
        currency: trip.currency,
        status: trip.status,
        travelDates,
      },
      itinerary: trip.days.map((day) => ({
        id: day.id,
        date: this.toDateKey(day.date),
        dayNumber: day.dayNumber,
        notes: day.notes,
        activities: day.activities.map((activity) => ({
          id: activity.id,
          title: activity.title,
          description: activity.description,
          category: activity.category,
          startTime: activity.startTime,
          endTime: activity.endTime,
          location: activity.location,
          notes: activity.notes,
          position: activity.position,
        })),
      })),
      savedPlaces: trip.places.slice(0, 50).map((place) => ({
        id: place.id,
        name: place.name,
        category: place.category,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        notes: place.notes,
        website: place.website,
      })),
      budget,
      weather,
    };
  }

  private buildBudget({
    totalAmount,
    categoryLimits,
    expenses,
  }: {
    totalAmount: DecimalLike | null;
    categoryLimits: Array<{
      category: ExpenseCategoryValue;
      amount: DecimalLike;
    }>;
    expenses: Array<{
      category: ExpenseCategoryValue;
      amount: DecimalLike;
    }>;
  }): JourneyContextBudget {
    const spentByCategory = new Map<ExpenseCategoryValue, bigint>();

    let totalSpentCents = 0n;

    for (const expense of expenses) {
      const cents = this.moneyToCents(expense.amount);

      totalSpentCents += cents;

      spentByCategory.set(expense.category, (spentByCategory.get(expense.category) ?? 0n) + cents);
    }

    const limitByCategory = new Map<ExpenseCategoryValue, string>(
      categoryLimits.map((limit) => [limit.category, limit.amount.toFixed(2)]),
    );

    const categories: JourneyContextBudgetCategory[] = EXPENSE_CATEGORIES.map((category) => ({
      category,
      limitAmount: limitByCategory.get(category) ?? null,
      spentAmount: this.centsToMoney(spentByCategory.get(category) ?? 0n),
    }));

    const totalAmountCents = totalAmount ? this.moneyToCents(totalAmount) : null;

    return {
      configured: totalAmount !== null,
      totalAmount: totalAmount ? totalAmount.toFixed(2) : null,
      totalSpent: this.centsToMoney(totalSpentCents),
      remainingAmount:
        totalAmountCents === null ? null : this.centsToMoney(totalAmountCents - totalSpentCents),
      categories,
    };
  }

  private async buildWeather(ownerId: string, tripId: string): Promise<JourneyContextWeather> {
    try {
      const weather = await this.weatherService.getTripWeather(ownerId, tripId);

      return {
        availability: weather.availability,
        days: weather.days.map((day) => ({
          date: day.date,
          available: day.available,
          condition: day.condition,
          temperatureMaxC: day.temperatureMaxC,
          temperatureMinC: day.temperatureMinC,
          precipitationProbabilityMax: day.precipitationProbabilityMax,
          precipitationMm: day.precipitationMm,
          windSpeedMaxKmh: day.windSpeedMaxKmh,
        })),
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        return {
          availability: 'UNAVAILABLE',
          days: [],
        };
      }

      throw error;
    }
  }

  private buildDateRange(startDate: Date, endDate: Date): string[] {
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

  private moneyToCents(value: DecimalLike): bigint {
    const normalized = value.toFixed(2);

    const negative = normalized.startsWith('-');

    const unsigned = negative ? normalized.slice(1) : normalized;

    const [integerPart, decimalPart = '00'] = unsigned.split('.');

    const cents = BigInt(`${integerPart}${decimalPart.padEnd(2, '0').slice(0, 2)}`);

    return negative ? -cents : cents;
  }

  private centsToMoney(cents: bigint): string {
    const negative = cents < 0n;

    const absolute = negative ? -cents : cents;

    const major = absolute / 100n;

    const minor = absolute % 100n;

    return `${negative ? '-' : ''}${major.toString()}.${minor.toString().padStart(2, '0')}`;
  }

  private toDateKey(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
