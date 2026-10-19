import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { addTask, listTasks } from '@/lib/db';
import { COOKIE, cookieOptions, currentOwner, sessionOwner } from '@/lib/session';
import { apiError, jsonBody, writeOwner } from '@/lib/http';
import { validateTask } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const existing = await currentOwner();
    const token = existing ? null : randomUUID();
    const owner = existing ?? sessionOwner(token!)!;
    const response = NextResponse.json({ tasks: await listTasks(owner) }, { headers: { 'Cache-Control': 'private, no-store' } });
    if (token) response.cookies.set(COOKIE, token, cookieOptions);
    return response;
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const owner = await writeOwner(request);
    const input = validateTask(await jsonBody(request));
    return NextResponse.json({ task: await addTask(owner, input) }, { status: 201 });
  } catch (error) { return apiError(error); }
}
