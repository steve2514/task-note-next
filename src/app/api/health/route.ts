import { NextResponse } from 'next/server';
import { checkDatabase } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await checkDatabase();
    return NextResponse.json({ status: 'ok', app: 'task-note-next' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ status: 'unavailable' }, { status: 503 });
  }
}
