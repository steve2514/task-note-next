import type { TaskInput } from './types.ts';

export class InputError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'InputError';
    this.status = status;
  }
}

export function objectInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InputError('JSON 객체를 보내 주세요.');
  }
  return value as Record<string, unknown>;
}

export function validateTask(value: unknown): TaskInput {
  const data = objectInput(value);
  if (Object.keys(data).some(key => !['title', 'course', 'due_date', 'description'].includes(key))) {
    throw new InputError('지원하지 않는 입력 항목입니다.');
  }
  const result = {} as TaskInput;
  for (const [key, label, limit] of [['title', '과제명', 100], ['course', '과목명', 100], ['description', '설명', 1000]] as const) {
    const raw = data[key] ?? (key === 'description' && !Object.hasOwn(data, key) ? '' : null);
    if (typeof raw !== 'string') throw new InputError(`${label}은 문자로 입력해 주세요.`);
    const text = raw.trim();
    if (key !== 'description' && !text) throw new InputError(`${label}을 입력해 주세요.`);
    if (text.length > limit) throw new InputError(`${label}은 ${limit}자 이내로 입력해 주세요.`);
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) throw new InputError('지원하지 않는 제어 문자가 있습니다.');
    result[key] = text;
  }
  if (typeof data.due_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.due_date)) {
    throw new InputError('마감일을 YYYY-MM-DD 형식으로 입력해 주세요.');
  }
  const parsed = new Date(`${data.due_date}T00:00:00Z`);
  if (data.due_date.startsWith('0000-') || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== data.due_date) {
    throw new InputError('실제로 존재하는 마감일을 입력해 주세요.');
  }
  result.due_date = data.due_date;
  return result;
}

export function validateStatus(value: unknown): boolean {
  const data = objectInput(value);
  if (Object.keys(data).length !== 1 || typeof data.is_completed !== 'boolean') {
    throw new InputError('완료 여부는 true 또는 false로 입력해 주세요.');
  }
  return data.is_completed;
}
