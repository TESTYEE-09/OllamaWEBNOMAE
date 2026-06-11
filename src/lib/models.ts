export type ModelEntry = {
  id: string;
  label: string;
  tier: 'quick' | 'pro';
  vision: boolean;
  description: string;
  contextWindow: number;
  badge?: string;
};

export const MODELS: ModelEntry[] = [
  {
    id: 'nex-agi/nex-n2-pro:free',
    label: 'nomaebot NEW',
    tier: 'quick',
    vision: false,
    description: 'Default free model. Fast & smart.',
    contextWindow: 128_000,
    badge: 'FREE',
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    label: 'Gemini 2.0 Flash',
    tier: 'quick',
    vision: true,
    description: 'Best free vision model. Images & PDFs.',
    contextWindow: 1_000_000,
    badge: 'VISION',
  },
  {
    id: 'meta-llama/llama-3.2-11b-vision-instruct:free',
    label: 'Llama 3.2 11B Vision',
    tier: 'quick',
    vision: true,
    description: 'Open vision model from Meta.',
    contextWindow: 128_000,
    badge: 'VISION',
  },
  {
    id: 'google/gemma-3-27b-it:free',
    label: 'Gemma 3 27B',
    tier: 'quick',
    vision: false,
    description: 'Google open model, strong for its size.',
    contextWindow: 32_000,
    badge: 'FREE',
  },
  {
    id: 'mistralai/mistral-7b-instruct:free',
    label: 'Mistral 7B',
    tier: 'pro',
    vision: false,
    description: 'Strong 7B model from Mistral.',
    contextWindow: 32_000,
    badge: 'FREE',
  },
];

export const DEFAULT_MODEL_ID = 'nex-agi/nex-n2-pro:free';

export function getModel(id: string): ModelEntry {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}
