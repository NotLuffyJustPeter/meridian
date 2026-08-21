import type { AiProviderRequest, AiProviderResult } from '../types/ai-recommendation.types';

export const AI_PROVIDER = Symbol('AI_PROVIDER');

export interface AiProvider {
  generateRecommendations(request: AiProviderRequest): Promise<AiProviderResult>;

  getModelName(): string;
}

export class AiProviderConfigurationError extends Error {
  constructor(message = 'AI provider is not configured') {
    super(message);
    this.name = 'AiProviderConfigurationError';
  }
}

export class AiProviderUnavailableError extends Error {
  constructor(message = 'AI provider is unavailable') {
    super(message);
    this.name = 'AiProviderUnavailableError';
  }
}

export class AiProviderResponseError extends Error {
  constructor(message = 'AI provider returned an invalid response') {
    super(message);
    this.name = 'AiProviderResponseError';
  }
}
