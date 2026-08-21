import {
  BadGatewayException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { JourneyContextService } from './context/journey-context.service';
import type { GenerateRecommendationsDto } from './dto/generate-recommendations.dto';
import {
  AI_PROVIDER,
  AiProviderConfigurationError,
  AiProviderResponseError,
  AiProviderUnavailableError,
  type AiProvider,
} from './providers/ai.provider';
import type {
  AiProviderRecommendation,
  AiRecommendationsResponse,
} from './types/ai-recommendation.types';

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

@Injectable()
export class AiService {
  constructor(
    private readonly journeyContextService: JourneyContextService,
    @Inject(AI_PROVIDER)
    private readonly aiProvider: AiProvider,
  ) {}

  async generateRecommendations(
    ownerId: string,
    tripId: string,
    dto: GenerateRecommendationsDto,
  ): Promise<AiRecommendationsResponse> {
    const context = await this.journeyContextService.build(ownerId, tripId);

    let result: Awaited<ReturnType<AiProvider['generateRecommendations']>>;

    try {
      result = await this.aiProvider.generateRecommendations({
        context,
        preferences: {
          pace: dto.pace,
          interests: [...dto.interests],
          budgetPreference: dto.budgetPreference,
          notes: dto.notes?.trim() || null,
        },
      });
    } catch (error) {
      if (
        error instanceof AiProviderConfigurationError ||
        error instanceof AiProviderUnavailableError
      ) {
        throw new ServiceUnavailableException(error.message);
      }

      if (error instanceof AiProviderResponseError) {
        throw new BadGatewayException(error.message);
      }

      throw error;
    }

    const validDates = new Set(context.trip.travelDates);

    const recommendations = result.recommendations.map((recommendation) => {
      this.validateRecommendation(recommendation, validDates);

      return {
        id: randomUUID(),
        day: recommendation.day,
        title: recommendation.title.trim(),
        category: recommendation.category,
        suggestedStartTime: recommendation.suggestedStartTime,
        suggestedEndTime: recommendation.suggestedEndTime,
        location: recommendation.location?.trim() || null,
        reason: recommendation.reason.trim(),
        estimatedCost: recommendation.estimatedCost.toFixed(2),
        currency: context.trip.currency,
        weatherAware: recommendation.weatherAware,
      };
    });

    return {
      tripId,
      generatedAt: new Date().toISOString(),
      model: this.aiProvider.getModelName(),
      summary: result.summary.trim(),
      recommendations,
      insights: result.insights.map((insight) => insight.trim()),
    };
  }

  private validateRecommendation(
    recommendation: AiProviderRecommendation,
    validDates: Set<string>,
  ): void {
    if (!validDates.has(recommendation.day)) {
      throw new BadGatewayException('AI generated a recommendation outside the trip dates');
    }

    const { suggestedStartTime, suggestedEndTime } = recommendation;

    if (suggestedStartTime && !TIME_PATTERN.test(suggestedStartTime)) {
      throw new BadGatewayException('AI generated an invalid start time');
    }

    if (suggestedEndTime && !TIME_PATTERN.test(suggestedEndTime)) {
      throw new BadGatewayException('AI generated an invalid end time');
    }

    if (suggestedStartTime && suggestedEndTime && suggestedEndTime < suggestedStartTime) {
      throw new BadGatewayException('AI generated an invalid time range');
    }
  }
}
