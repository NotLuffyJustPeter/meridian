import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { JourneyContext } from './context/journey-context.types';
import { JourneyContextService } from './context/journey-context.service';
import { GenerateRecommendationsDto } from './dto/generate-recommendations.dto';
import type { AiProvider } from './providers/ai.provider';
import { AiProviderUnavailableError } from './providers/ai.provider';
import { AiService } from './ai.service';
import type { AiProviderRequest, AiProviderResult } from './types/ai-recommendation.types';

const OWNER_ID = '54c8aabc-d305-421d-8e61-b99e563131f9';

const TRIP_ID = 'b8658c9d-f7b0-4839-99f1-f0fcacb3b97e';

const context: JourneyContext = {
  trip: {
    id: TRIP_ID,
    name: 'Milan Weekend',
    destination: 'Milan, Italy',
    startDate: '2026-08-21',
    endDate: '2026-08-23',
    timezone: 'Europe/Rome',
    currency: 'EUR',
    status: 'PLANNED',
    travelDates: ['2026-08-21', '2026-08-22', '2026-08-23'],
  },
  itinerary: [],
  savedPlaces: [],
  budget: {
    configured: true,
    totalAmount: '800.00',
    totalSpent: '120.00',
    remainingAmount: '680.00',
    categories: [],
  },
  weather: {
    availability: 'AVAILABLE',
    days: [],
  },
};

const providerResult: AiProviderResult = {
  summary: 'A balanced Milan plan.',
  recommendations: [
    {
      day: '2026-08-21',
      title: 'Explore Brera',
      category: 'SIGHTSEEING',
      suggestedStartTime: '10:00',
      suggestedEndTime: '12:00',
      location: 'Brera, Milan',
      reason: 'Fits the culture focus.',
      estimatedCost: 25,
      weatherAware: false,
    },
  ],
  insights: ['Keep the afternoon flexible.'],
};

type BuildContextMock = (ownerId: string, tripId: string) => Promise<JourneyContext>;

type GenerateMock = (request: AiProviderRequest) => Promise<AiProviderResult>;

describe('AiService', () => {
  let service: AiService;

  let buildContext: jest.Mock<BuildContextMock>;

  let generate: jest.Mock<GenerateMock>;

  beforeEach(() => {
    buildContext = jest.fn<BuildContextMock>();

    generate = jest.fn<GenerateMock>();

    buildContext.mockResolvedValue(context);

    generate.mockResolvedValue(providerResult);

    const contextService = {
      build: buildContext,
    } as unknown as JourneyContextService;

    const provider: AiProvider = {
      generateRecommendations: generate,
      getModelName: () => 'gemini-test',
    };

    service = new AiService(contextService, provider);
  });

  it('builds owner-scoped context and returns an ephemeral normalized proposal', async () => {
    const dto = new GenerateRecommendationsDto();

    dto.notes = 'Prefer local places';

    const result = await service.generateRecommendations(OWNER_ID, TRIP_ID, dto);

    expect(buildContext).toHaveBeenCalledWith(OWNER_ID, TRIP_ID);

    expect(generate).toHaveBeenCalledTimes(1);

    const request = generate.mock.calls[0]?.[0];

    expect(request?.context.trip.destination).toBe('Milan, Italy');

    expect(request?.preferences.notes).toBe('Prefer local places');

    expect(result.tripId).toBe(TRIP_ID);

    expect(result.model).toBe('gemini-test');

    expect(result.recommendations[0]).toMatchObject({
      day: '2026-08-21',
      title: 'Explore Brera',
      estimatedCost: '25.00',
      currency: 'EUR',
    });

    expect(result.recommendations[0]?.id).toEqual(expect.any(String));
  });

  it('rejects provider output outside the trip dates', async () => {
    generate.mockResolvedValue({
      ...providerResult,
      recommendations: [
        {
          ...providerResult.recommendations[0],
          day: '2026-09-01',
        },
      ],
    });

    await expect(
      service.generateRecommendations(OWNER_ID, TRIP_ID, new GenerateRecommendationsDto()),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('rejects invalid provider time ranges', async () => {
    generate.mockResolvedValue({
      ...providerResult,
      recommendations: [
        {
          ...providerResult.recommendations[0],
          suggestedStartTime: '18:00',
          suggestedEndTime: '16:00',
        },
      ],
    });

    await expect(
      service.generateRecommendations(OWNER_ID, TRIP_ID, new GenerateRecommendationsDto()),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('maps provider availability failures to 503', async () => {
    generate.mockRejectedValue(new AiProviderUnavailableError());

    await expect(
      service.generateRecommendations(OWNER_ID, TRIP_ID, new GenerateRecommendationsDto()),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
