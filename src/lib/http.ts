import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { InputError } from './validation';
import { currentOwner } from './session';

export async function writeOwner(request: NextRequest): Promise<string> {
  if (request.headers.get('x-requested-with') !== 'task-note') {
    throw new InputError('허용되지 않은 요청 방식입니다.', 403);
  }
  const origin = request.headers.get('origin');
  if (origin) {
    let sameOrigin = false;
    try {
      // Next.js can normalize request.url to localhost on a local server.
      // The Host header retains the actual browser-facing host and port.
      const target = new URL(request.url);
      target.host = request.headers.get('host') || target.host;
      sameOrigin = new URL(origin).origin === target.origin;
    } catch { /* Invalid or opaque origins are rejected below. */ }
    if (!sameOrigin) throw new InputError('다른 사이트의 변경 요청은 허용하지 않습니다.', 403);
  }
  const owner = await currentOwner();
  if (!owner) throw new InputError('화면을 새로고침한 뒤 다시 시도해 주세요.', 401);
  return owner;
}

export async function jsonBody(request: NextRequest): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    throw new InputError('JSON 형식으로 요청해 주세요.', 415);
  }
  if (!request.body) throw new InputError('입력 내용을 확인해 주세요.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 16 * 1024) { await reader.cancel(); throw new InputError('요청 데이터가 너무 큽니다.', 413); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError('올바른 JSON을 보내 주세요.');
  }
}

export function apiError(error: unknown) {
  if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('Task storage request failed', error instanceof Error ? error.name : 'UnknownError');
  return NextResponse.json({ error: '저장소에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 503 });
}

export function missingTask() { return NextResponse.json({ error: '과제를 찾을 수 없습니다.' }, { status: 404 }); }
