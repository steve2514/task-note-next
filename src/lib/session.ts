import 'server-only';
import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';

export const COOKIE = 'task_note_session';
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' && Boolean(process.env.VERCEL),
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 60,
};

export function sessionOwner(token: string | undefined): string | null {
  if (!token || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(token)) return null;
  return createHash('sha256').update(token).digest('hex');
}

export async function currentOwner(): Promise<string | null> {
  return sessionOwner((await cookies()).get(COOKIE)?.value);
}
