import { NextRequest } from 'next/server';
import { currentUserId } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { createConversation, createMessage, getConversation, updateConversation, getMessages } from '@/lib/db';
import { streamChat } from '@/lib/ollama';

function isHtmlLike(content: string): boolean {
  const cleaned = content.replace(/```[a-z]*\n?/g, '').replace(/```$/g, '').trimStart();
  return cleaned.startsWith('<!DOCTYPE') || cleaned.startsWith('<html') || cleaned.startsWith('<svg') || cleaned.startsWith('<script');
}

export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { conversation_id, message, model_id, thinking } = await req.json();

  let convId = conversation_id;
  if (!convId) {
    convId = uuidv4();
    const title = message.content?.slice(0, 40) || 'New Chat';
    createConversation(convId, userId, title, model_id || 'minimax-m3', thinking || 'off');
  } else {
    const conv = getConversation(convId, userId);
    if (!conv) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }

  const userMsgId = uuidv4();
  createMessage(userMsgId, convId, 'user', message.content, {
    images_json: message.images?.length ? JSON.stringify(message.images) : undefined,
  });

  if (!conversation_id) {
    updateConversation(convId, { title: message.content?.slice(0, 40) || 'New Chat' });
  }

  const history = getMessages(convId);
  const ollamaMessages = history.map((m: any) => ({
    role: m.role as 'system' | 'user' | 'assistant',
    content: m.content,
    ...(m.images_json ? { images: JSON.parse(m.images_json) } : {}),
  }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = '';
      let fullThinking = '';
      let canvasHtml = '';

      try {
        for await (const chunk of streamChat({
          model: model_id || 'minimax-m3',
          messages: ollamaMessages,
          thinking: thinking || 'off',
        })) {
          if (chunk.type === 'content') {
            fullContent += chunk.delta;
            const candidate = (fullContent || '').replace(/```[a-z]*\n?/g, '').replace(/```$/g, '');
            if (isHtmlLike(candidate)) {
              canvasHtml = candidate;
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', delta: chunk.delta, canvasHtml: canvasHtml ? candidate : undefined })}\n\n`));
          } else if (chunk.type === 'thinking') {
            fullThinking += chunk.delta;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'thinking', delta: chunk.delta })}\n\n`));
          } else if (chunk.type === 'done') {
            const assistantMsgId = uuidv4();
            createMessage(assistantMsgId, convId, 'assistant', fullContent, {
              model_id: model_id || 'minimax-m3',
              thinking: fullThinking || undefined,
            });
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', conversation_id: convId, message_id: assistantMsgId })}\n\n`));
          }
        }
      } catch (err: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: err.message || 'Stream error' })}\n\n`));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
