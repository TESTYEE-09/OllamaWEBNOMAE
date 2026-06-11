const BASE = 'https://openrouter.ai/api/v1';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
};

export async function* streamChat(params: {
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
}) {
  const body: any = {
    model: params.model,
    messages: params.messages.map(m => ({
      role: m.role,
      content: m.images?.length
        ? [{ type: 'text', text: m.content }, ...m.images.map(img => ({ type: 'image_url', image_url: { url: img } }))]
        : m.content,
    })),
    stream: true,
  };

  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://nomaebot.site',
      'X-Title': 'nomaebot NEW',
    },
    body: JSON.stringify(body),
    signal: params.signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${text}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') {
        if (trimmed === 'data: [DONE]') yield { type: 'done' as const };
        continue;
      }
      if (!trimmed.startsWith('data: ')) continue;
      try {
        const parsed = JSON.parse(trimmed.slice(6));
        const choice = parsed.choices?.[0];
        if (!choice) continue;
        if (choice.delta?.content) {
          yield { type: 'content' as const, delta: choice.delta.content };
        }
        if (choice.finish_reason === 'stop' || choice.finish_reason === 'end_turn') {
          yield { type: 'done' as const };
        }
      } catch {
        // skip malformed lines
      }
    }
  }
}
