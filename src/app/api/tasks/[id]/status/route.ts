import { NextResponse, type NextRequest } from 'next/server';
import { setStatus } from '@/lib/db';
import { apiError, jsonBody, missingTask, writeOwner } from '@/lib/http';
import { validateStatus } from '@/lib/validation';

export const runtime = 'nodejs';
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const owner = await writeOwner(request);
    const status = validateStatus(await jsonBody(request));
    const task = await setStatus(owner, (await context.params).id, status);
    return task ? NextResponse.json({ task }) : missingTask();
  } catch (error) { return apiError(error); }
}
