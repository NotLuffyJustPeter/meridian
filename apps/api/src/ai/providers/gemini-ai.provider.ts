import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  buildRecommendationsPrompt,
  MERIDIAN_AI_SYSTEM_INSTRUCTION,
} from '../prompts/recommendations.prompt';
import {
  AI_ACTIVITY_CATEGORIES,
  type AiActivityCategory,
  type AiProviderRecommendation,
  type AiProviderRequest,
  type AiProviderResult,
} from '../types/ai-recommendation.types';
import {
  AiProviderConfigurationError,
  AiProviderResponseError,
  AiProviderUnavailableError,
  type AiProvider,
} from './ai.provider';

const DEFAULT_MODEL = 'gemini-3.7-flash';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const RECOMMENDATIONS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: {
      type: 'STRING',
      description: 'A concise overview of the proposed journey plan.',
    },
    recommendations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          day: {
            type: 'STRING',
            description: 'Trip date in YYYY-MM-DD format.',
          },
          title: {
            type: 'STRING',
          },
          category: {
            type: 'STRING',
            enum: [...AI_ACTIVITY_CATEGORIES],
          },
          suggestedStartTime: {
            type: 'STRING',
            nullable: true,
            description: 'HH:mm local trip time or null.',
          },
          suggestedEndTime: {
            type: 'STRING',
            nullable: true,
            description: 'HH:mm local trip time or null.',
          },
          location: {
            type: 'STRING',
            nullable: true,
          },
          reason: {
            type: 'STRING',
          },
          estimatedCost: {
            type: 'NUMBER',
            description: 'Approximate cost in trip currency.',
          },
          weatherAware: {
            type: 'BOOLEAN',
          },
        },
        required: [
          'day',
          'title',
          'category',
          'suggestedStartTime',
          'suggestedEndTime',
          'location',
          'reason',
          'estimatedCost',
          'weatherAware',
        ],
      },
    },
    insights: {
      type: 'ARRAY',
      items: {
        type: 'STRING',
      },
    },
  },
  required: ['summary', 'recommendations', 'insights'],
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  return typeof value === 'string' ? value : undefined;
}

function isActivityCategory(value: unknown): value is AiActivityCategory {
  return typeof value === 'string' && (AI_ACTIVITY_CATEGORIES as readonly string[]).includes(value);
}

@Injectable()
export class GeminiAiProvider implements AiProvider {
  private readonly logger = new Logger(GeminiAiProvider.name);

  constructor(private readonly configService: ConfigService) {}

  getModelName(): string {
    return this.configService.get<string>('GEMINI_MODEL')?.trim() || DEFAULT_MODEL;
  }

  async generateRecommendations(request: AiProviderRequest): Promise<AiProviderResult> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY')?.trim();

    if (!apiKey) {
      throw new AiProviderConfigurationError();
    }

    const model = this.getModelName();

    const url = `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`;

    const payload = {
      systemInstruction: {
        parts: [
          {
            text: MERIDIAN_AI_SYSTEM_INSTRUCTION,
          },
        ],
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: buildRecommendationsPrompt(request),
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RECOMMENDATIONS_SCHEMA,
      },
    };

    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
    } catch (error: unknown) {
      const detail =
        error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown fetch failure';

      const cause =
        error instanceof Error &&
        typeof error.cause === 'object' &&
        error.cause !== null &&
        'code' in error.cause &&
        typeof (
          error.cause as {
            code?: unknown;
          }
        ).code === 'string'
          ? (
              error.cause as {
                code: string;
              }
            ).code
          : null;

      this.logger.warn(
        [
          'Gemini network request failed',
          `model=${model}`,
          `detail=${detail}`,
          cause ? `cause=${cause}` : null,
        ]
          .filter(Boolean)
          .join(' | ')
          .slice(0, 500),
      );

      throw new AiProviderUnavailableError('Unable to reach Gemini');
    }

    if (!response.ok) {
      const upstreamMessage = await this.readUpstreamErrorMessage(response);

      if (response.status === 429 || response.status >= 500) {
        throw new AiProviderUnavailableError(
          upstreamMessage
            ? `Gemini request failed: ${upstreamMessage}`
            : `Gemini request failed with status ${response.status}`,
        );
      }

      throw new AiProviderResponseError(
        upstreamMessage
          ? `Gemini rejected the request: ${upstreamMessage}`
          : `Gemini request was rejected with status ${response.status}`,
      );
    }

    let body: unknown;

    try {
      body = (await response.json()) as unknown;
    } catch {
      throw new AiProviderResponseError('Gemini returned invalid JSON');
    }

    const text = this.readCandidateText(body);

    let structured: unknown;

    try {
      structured = JSON.parse(text) as unknown;
    } catch {
      throw new AiProviderResponseError('Gemini returned malformed structured output');
    }

    return this.parseResult(structured);
  }

  private async readUpstreamErrorMessage(response: Response): Promise<string | null> {
    try {
      const payload: unknown = await response.json();

      if (!isRecord(payload)) {
        return null;
      }

      const error = payload['error'];

      if (!isRecord(error)) {
        return null;
      }

      const message = readString(error['message']);

      if (!message) {
        return null;
      }

      return message.replace(/\s+/g, ' ').trim().slice(0, 300);
    } catch {
      return null;
    }
  }

  private readCandidateText(body: unknown): string {
    if (!isRecord(body)) {
      throw new AiProviderResponseError();
    }

    const candidates = body['candidates'];

    if (!Array.isArray(candidates) || candidates.length === 0) {
      throw new AiProviderResponseError('Gemini response did not contain candidates');
    }

    const candidate: unknown = candidates[0];

    if (!isRecord(candidate)) {
      throw new AiProviderResponseError();
    }

    const content = candidate['content'];

    if (!isRecord(content)) {
      throw new AiProviderResponseError();
    }

    const parts = content['parts'];

    if (!Array.isArray(parts)) {
      throw new AiProviderResponseError();
    }

    const text = parts
      .filter(isRecord)
      .map((part) => readString(part['text']))
      .find((value): value is string => value !== null);

    if (!text) {
      throw new AiProviderResponseError('Gemini response did not contain text');
    }

    return text;
  }

  private parseResult(value: unknown): AiProviderResult {
    if (!isRecord(value)) {
      throw new AiProviderResponseError();
    }

    const summary = readString(value['summary']);

    const recommendations = value['recommendations'];

    const insights = value['insights'];

    if (!summary || !Array.isArray(recommendations) || !Array.isArray(insights)) {
      throw new AiProviderResponseError();
    }

    const parsedRecommendations: AiProviderRecommendation[] = recommendations.map(
      (recommendation) => this.parseRecommendation(recommendation),
    );

    const parsedInsights = insights.map((insight) => {
      const text = readString(insight);

      if (!text) {
        throw new AiProviderResponseError('Gemini returned an invalid insight');
      }

      return text;
    });

    if (
      parsedRecommendations.length === 0 ||
      parsedRecommendations.length > 20 ||
      parsedInsights.length > 12
    ) {
      throw new AiProviderResponseError('Gemini returned an unexpected number of recommendations');
    }

    return {
      summary,
      recommendations: parsedRecommendations,
      insights: parsedInsights,
    };
  }

  private parseRecommendation(value: unknown): AiProviderRecommendation {
    if (!isRecord(value)) {
      throw new AiProviderResponseError('Gemini returned an invalid recommendation');
    }

    const day = readString(value['day']);

    const title = readString(value['title']);

    const category = value['category'];

    const suggestedStartTime = readNullableString(value['suggestedStartTime']);

    const suggestedEndTime = readNullableString(value['suggestedEndTime']);

    const location = readNullableString(value['location']);

    const reason = readString(value['reason']);

    const estimatedCost = value['estimatedCost'];

    const weatherAware = value['weatherAware'];

    if (
      !day ||
      !title ||
      !isActivityCategory(category) ||
      suggestedStartTime === undefined ||
      suggestedEndTime === undefined ||
      location === undefined ||
      !reason ||
      typeof estimatedCost !== 'number' ||
      !Number.isFinite(estimatedCost) ||
      estimatedCost < 0 ||
      typeof weatherAware !== 'boolean'
    ) {
      throw new AiProviderResponseError('Gemini returned invalid recommendation fields');
    }

    return {
      day,
      title,
      category,
      suggestedStartTime,
      suggestedEndTime,
      location,
      reason,
      estimatedCost,
      weatherAware,
    };
  }
}
