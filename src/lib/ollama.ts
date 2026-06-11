const OLLAMA_BASE = 'https://ollama.com/api';

type ThinkingValue = false | 'low' | 'medium' | 'high';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
};

export async function* streamChat(params: {
  model: string;
  messages: ChatMessage[];
  thinking: ThinkingValue;
  signal?: AbortSignal;
}) {
  const res = await fetch(`${OLLAMA_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      stream: true,
      think: params.thinking,
    }),
    signal: params.signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama API error ${res.status}: ${text}`);
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
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.message?.content) {
          yield { type: 'content' as const, delta: parsed.message.content };
        }
        if (parsed.message?.thinking) {
          yield { type: 'thinking' as const, delta: parsed.message.thinking };
        }
        if (parsed.done) {
          yield { type: 'done' as const };
        }
      } catch {
        // skip malformed lines
      }
    }
  }
}
