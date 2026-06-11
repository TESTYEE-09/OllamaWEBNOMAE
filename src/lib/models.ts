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
    label: 'Nex N2 Pro',
    tier: 'quick',
    vision: false,
    description: 'Smart free model. Default.',
    contextWindow: 128_000,
    badge: 'FREE',
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
    id: 'meta-llama/llama-3.2-3b-instruct:free',
    label: 'Llama 3.2 3B',
    tier: 'quick',
    vision: false,
    description: 'Lightning fast, good for simple tasks.',
    contextWindow: 128_000,
    badge: 'FREE',
  },
  {
    id: 'microsoft/phi-3-medium-4k-instruct:free',
    label: 'Phi-3 Medium',
    tier: 'quick',
    vision: false,
    description: 'Microsoft small model, efficient.',
    contextWindow: 4_000,
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
