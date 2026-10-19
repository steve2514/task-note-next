import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTask, validateStatus, InputError } from '../src/lib/validation.ts';

const valid = { title: '보고서', course: '웹서버보안프로그래밍', due_date: '2026-10-19' };
test('정상 입력을 정리하고 선택 설명을 빈 문자열로 처리한다', () => {
  assert.deepEqual(validateTask({ ...valid, title: '  보고서  ' }), { ...valid, description: '' });
});
test('필수값을 비울 수 없다', () => {
  for (const key of ['title', 'course']) assert.throws(() => validateTask({ ...valid, [key]: '  ' }), InputError);
});
test('문자열 길이 경계값을 검증한다', () => {
  validateTask({ ...valid, title: '가'.repeat(100), description: '나'.repeat(1000) });
  for (const [key, size] of [['title', 101], ['course', 101], ['description', 1001]]) {
    assert.throws(() => validateTask({ ...valid, [key]: '가'.repeat(size) }), InputError);
  }
});
test('윤년과 잘못된 달력 날짜를 구분한다', () => {
  assert.equal(validateTask({ ...valid, due_date: '2028-02-29' }).due_date, '2028-02-29');
  for (const date of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-1-1', '0000-01-01']) {
    assert.throws(() => validateTask({ ...valid, due_date: date }), InputError);
  }
});
test('객체 이외의 요청과 예상하지 않은 필드를 거부한다', () => {
  for (const value of [null, [], 'text', { ...valid, owner_id: 'other' }, { ...valid, is_completed: true }]) {
    assert.throws(() => validateTask(value), InputError);
  }
});
test('문자열 필드에 숫자와 null을 받을 수 없다', () => {
  for (const key of ['title', 'course', 'description']) {
    for (const value of [null, 123, true]) assert.throws(() => validateTask({ ...valid, [key]: value }), InputError);
  }
});
test('완료 상태는 boolean 한 필드만 받는다', () => {
  assert.equal(validateStatus({ is_completed: true }), true);
  assert.equal(validateStatus({ is_completed: false }), false);
  for (const value of [1, 'true', null]) assert.throws(() => validateStatus({ is_completed: value }), InputError);
  assert.throws(() => validateStatus({ is_completed: true, title: 'extra' }), InputError);
});
test('HTML과 SQL 형태의 입력은 일반 문자열로 허용하되 제어 문자는 거부한다', () => {
  const title = "<img src=x onerror=alert(1)> '; DROP TABLE tasks; --";
  assert.equal(validateTask({ ...valid, title }).title, title);
  assert.throws(() => validateTask({ ...valid, title: 'bad\u0000text' }), InputError);
});
