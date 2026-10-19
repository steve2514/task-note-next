import { NextResponse, type NextRequest } from 'next/server';
import { deleteTask, editTask } from '@/lib/db';
import { apiError, jsonBody, missingTask, writeOwner } from '@/lib/http';
import { validateTask } from '@/lib/validation';

type Context = { params: Promise<{ id: string }> };
export const runtime = 'nodejs';

export async function PUT(request: NextRequest, context: Context) {
  try {
    const owner = await writeOwner(request);
    const input = validateTask(await jsonBody(request));
    const task = await editTask(owner, (await context.params).id, input);
    return task ? NextResponse.json({ task }) : missingTask();
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const owner = await writeOwner(request);
    const removed = await deleteTask(owner, (await context.params).id);
    return removed ? new NextResponse(null, { status: 204 }) : missingTask();
  } catch (error) { return apiError(error); }
}
