import { NextRequest, NextResponse } from 'next/server';
import { currentUserId } from '@/lib/auth';
import { getConversation, updateConversation, deleteConversation, getMessages } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const conv = getConversation(params.id, userId);
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const messages = getMessages(params.id);
  return NextResponse.json({ conversation: conv, messages });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const conv = getConversation(params.id, userId);
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const updates = await req.json();
  updateConversation(params.id, updates);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const conv = getConversation(params.id, userId);
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  deleteConversation(params.id);
  return NextResponse.json({ ok: true });
}
