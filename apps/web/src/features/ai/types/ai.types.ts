export type AiPace =
  | 'RELAXED'
  | 'BALANCED'
  | 'FULL';

export type AiInterest =
  | 'CULTURE'
  | 'FOOD'
  | 'ARCHITECTURE'
  | 'HISTORY'
  | 'NATURE'
  | 'SHOPPING'
  | 'NIGHTLIFE'
  | 'LOCAL_EXPERIENCES';

export type AiBudgetPreference =
  | 'ECONOMY'
  | 'BALANCED'
  | 'COMFORT';

export type AiActivityCategory =
  | 'SIGHTSEEING'
  | 'FOOD'
  | 'TRANSPORT'
  | 'LODGING'
  | 'SHOPPING'
  | 'ENTERTAINMENT'
  | 'OTHER';

export interface GenerateAiRecommendationsInput {
  pace: AiPace;
  interests: AiInterest[];
  budgetPreference:
    AiBudgetPreference;
  notes?: string;
}

export interface AiRecommendation {
  id: string;
  day: string;
  title: string;
  category:
    AiActivityCategory;
  suggestedStartTime:
    | string
    | null;
  suggestedEndTime:
    | string
    | null;
  location:
    | string
    | null;
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
  recommendations:
    AiRecommendation[];
  insights: string[];
}
