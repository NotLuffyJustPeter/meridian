import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { AiProviderRequest } from '../types/ai-recommendation.types';
import { AiProviderResponseError } from './ai.provider';
import { GeminiAiProvider } from './gemini-ai.provider';

const request: AiProviderRequest = {
  preferences: {
    pace: 'BALANCED',
    interests: ['CULTURE'],
    budgetPreference: 'BALANCED',
    notes: null,
  },
  context: {
    trip: {
      id: 'b8658c9d-f7b0-4839-99f1-f0fcacb3b97e',
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
      configured: false,
      totalAmount: null,
      totalSpent: '0.00',
      remainingAmount: null,
      categories: [],
    },
    weather: {
      availability: 'OUT_OF_RANGE',
      days: [],
    },
  },
};

describe('GeminiAiProvider', () => {
  let provider: GeminiAiProvider;

  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    const config = {
      get: <T>(key: string): T | undefined => {
        if (key === 'GEMINI_API_KEY') {
          return 'test-key' as T;
        }

        if (key === 'GEMINI_MODEL') {
          return 'gemini-test' as T;
        }

        return undefined;
      },
    } as unknown as ConfigService;

    provider = new GeminiAiProvider(config);

    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('requests structured JSON and parses the proposal', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summary: 'Milan plan',
                      recommendations: [
                        {
                          day: '2026-08-21',
                          title: 'Brera walk',
                          category: 'SIGHTSEEING',
                          suggestedStartTime: '10:00',
                          suggestedEndTime: '12:00',
                          location: 'Brera',
                          reason: 'Culture fit',
                          estimatedCost: 10,
                          weatherAware: false,
                        },
                      ],
                      insights: ['Keep the afternoon flexible.'],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );

    const result = await provider.generateRecommendations(request);

    expect(result.summary).toBe('Milan plan');

    expect(result.recommendations[0]?.estimatedCost).toBe(10);

    const call = fetchSpy.mock.calls[0];

    expect(call).toBeDefined();

    const input = call?.[0];

    expect(typeof input).toBe('string');

    if (typeof input !== 'string') {
      throw new Error('Expected fetch URL to be a string');
    }

    const url = new URL(input);

    expect(url.pathname).toContain('gemini-test:generateContent');

    const init = call?.[1];

    const headers = new Headers(init?.headers);

    expect(headers.get('x-goog-api-key')).toBe('test-key');

    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;

    expect(body).toEqual(
      expect.objectContaining({
        generationConfig: expect.objectContaining({
          responseMimeType: 'application/json',
          responseSchema: expect.objectContaining({
            type: 'OBJECT',
          }),
        }),
      }),
    );
  });

  it('surfaces a safe Gemini 400 message', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 400,
            message: 'Invalid JSON payload received.',
            status: 'INVALID_ARGUMENT',
          },
        }),
        {
          status: 400,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );

    await expect(provider.generateRecommendations(request)).rejects.toThrow(
      'Gemini rejected the request: Invalid JSON payload received.',
    );
  });

  it('rejects malformed structured content', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '{"summary":"broken"}',
                  },
                ],
              },
            },
          ],
        }),
        {
          status: 200,
        },
      ),
    );

    await expect(provider.generateRecommendations(request)).rejects.toBeInstanceOf(
      AiProviderResponseError,
    );
  });
});
