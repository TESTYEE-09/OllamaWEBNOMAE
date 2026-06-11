import { NextResponse } from 'next/server';
import { MODELS } from '@/lib/models';

export async function GET() {
  return NextResponse.json(MODELS);
}
