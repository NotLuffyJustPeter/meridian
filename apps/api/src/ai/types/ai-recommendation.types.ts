import type { AiBudgetPreference, AiInterest, AiPace } from '../dto/generate-recommendations.dto';
import type { JourneyContext } from '../context/journey-context.types';

export const AI_ACTIVITY_CATEGORIES = [
  'SIGHTSEEING',
  'FOOD',
  'TRANSPORT',
  'LODGING',
  'SHOPPING',
  'ENTERTAINMENT',
  'OTHER',
] as const;

export type AiActivityCategory = (typeof AI_ACTIVITY_CATEGORIES)[number];

export interface AiPreferences {
  pace: AiPace;
  interests: AiInterest[];
  budgetPreference: AiBudgetPreference;
  notes: string | null;
}

export interface AiProviderRequest {
  context: JourneyContext;
  preferences: AiPreferences;
}

export interface AiProviderRecommendation {
  day: string;
  title: string;
  category: AiActivityCategory;
  suggestedStartTime: string | null;
  suggestedEndTime: string | null;
  location: string | null;
  reason: string;
  estimatedCost: number;
  weatherAware: boolean;
}

export interface AiProviderResult {
  summary: string;
  recommendations: AiProviderRecommendation[];
  insights: string[];
}

export interface AiRecommendation {
  id: string;
  day: string;
  title: string;
  category: AiActivityCategory;
  suggestedStartTime: string | null;
  suggestedEndTime: string | null;
  location: string | null;
  reason: string;
  estimatedCost: string;
  currency: string;
  weatherAware: boolean;
}

export interface AiRecommendationsResponse {
  tripId: string;
  generatedAt: string;
  model: string;
  summary: string;
  recommendations: AiRecommendation[];
  insights: string[];
}
