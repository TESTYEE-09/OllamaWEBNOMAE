export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high';

export type ModelEntry = {
  id: string;
  label: string;
  tier: 'quick' | 'pro';
  vision: boolean;
  supportsThink: boolean;
  description: string;
  contextWindow: number;
  badge?: string;
};

export const MODELS: ModelEntry[] = [
  {
    id: 'minimax-m3',
    label: 'M3',
    tier: 'quick',
    vision: false,
    supportsThink: true,
    description: 'Newest flagship. Smart + fast. Default for quick.',
    contextWindow: 128_000,
    badge: 'NEW',
  },
  {
    id: 'gemma4:31b',
    label: 'Gemma 4 31B',
    tier: 'quick',
    vision: true,
    supportsThink: false,
    description: 'Cloud vision. Best for images, PDFs, OCR.',
    contextWindow: 128_000,
    badge: 'CLOUD',
  },
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash',
    tier: 'quick',
    vision: true,
    supportsThink: false,
    description: 'Fastest with vision. Great for quick answers.',
    contextWindow: 1_000_000,
  },
  {
    id: 'qwen3-vl:235b-instruct',
    label: 'Qwen3 VL 235B',
    tier: 'quick',
    vision: true,
    supportsThink: false,
    description: 'Best vision model. Complex images, diagrams, PDFs.',
    contextWindow: 256_000,
  },
  {
    id: 'gpt-oss:20b',
    label: 'GPT-OSS 20B',
    tier: 'quick',
    vision: false,
    supportsThink: true,
    description: 'OpenAI open-weight with thinking. Fast + smart.',
    contextWindow: 128_000,
  },
];

export const DEFAULT_MODEL_ID = 'minimax-m3';

export function getModel(id: string): ModelEntry {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}
