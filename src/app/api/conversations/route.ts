import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { currentUserId } from '@/lib/auth';
import { createConversation, getConversations, getConversation, updateConversation, deleteConversation, getMessages } from '@/lib/db';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const conversations = getConversations(userId);
  return NextResponse.json(conversations);
}

export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { title, model_id, thinking } = await req.json();
  const id = uuidv4();
  createConversation(id, userId, title || 'New Chat', model_id || 'minimax-m3', thinking || 'off');
  return NextResponse.json({ id });
}
