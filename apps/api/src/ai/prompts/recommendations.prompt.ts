import type { AiProviderRequest } from '../types/ai-recommendation.types';

export const MERIDIAN_AI_SYSTEM_INSTRUCTION = [
  'You are Meridian AI, an itinerary planning assistant.',
  'Create practical travel recommendations using only the journey context supplied by Meridian.',
  'Never claim that opening hours, ticket availability, reservations, prices, or live conditions were verified unless the supplied context explicitly contains that information.',
  'Treat estimatedCost as an approximate planning estimate in the trip currency.',
  'Use saved places when relevant, but do not invent a claim that a place is saved when it is not in the context.',
  'Respect existing itinerary activities and avoid obvious time conflicts.',
  'Use weather only when a matching travel day has available forecast data.',
  'If weather is unavailable or outside the forecast window, do not fabricate it.',
  'Keep recommendations inside the trip date range.',
  'Do not modify the itinerary. Return a proposal for user review.',
].join(' ');

export function buildRecommendationsPrompt(request: AiProviderRequest): string {
  return [
    'Generate a Meridian journey proposal.',
    '',
    'Planning preferences:',
    JSON.stringify(request.preferences, null, 2),
    '',
    'Journey context:',
    JSON.stringify(request.context, null, 2),
    '',
    'Output guidance:',
    '- Return 4 to 12 recommendations when the trip length reasonably allows it.',
    '- Spread recommendations across travel days instead of concentrating everything on one day.',
    '- suggestedStartTime and suggestedEndTime must be HH:mm or null.',
    '- recommendation day must be YYYY-MM-DD and must exist in trip.travelDates.',
    '- reason should briefly explain why the recommendation fits this traveler and context.',
    '- weatherAware is true only when forecast data materially influenced that recommendation.',
    '- estimatedCost must be a non-negative numeric estimate in the trip currency.',
    '- Keep insights concise and actionable.',
  ].join('\n');
}
