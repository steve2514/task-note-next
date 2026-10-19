import { test } from 'node:test';
import assert from 'node:assert/strict';

const base = process.env.TEST_BASE_URL;
test('실행 중인 Next.js API와 DB 통합 검증', { skip: !base && 'TEST_BASE_URL을 설정하면 API 통합 검증을 실행합니다.' }, async (t) => {
  const root = base.replace(/\/$/, '');
  let cookie, cookieB, id;
  const input = { title: '자동 검증 과제', course: '웹서버보안프로그래밍', due_date: '2026-10-19', description: '테스트가 끝나면 삭제하는 가상 데이터' };
  const headers = () => ({ 'X-Requested-With': 'task-note', 'Content-Type': 'application/json', Origin: root, Cookie: cookie });
  const request = (path, method, value, extra = {}) => fetch(root + '/api/tasks' + path, { method, headers: { ...headers(), ...extra }, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
  try {
    await t.test('GET이 HttpOnly 세션 쿠키를 발급하고 캐시를 방지한다', async () => {
      const response = await fetch(root + '/api/tasks');
      assert.equal(response.status, 200);
      const set = response.headers.get('set-cookie');
      assert.match(set, /HttpOnly/i); assert.match(set, /SameSite=lax/i);
      assert.match(response.headers.get('cache-control'), /no-store/);
      cookie = set.split(';')[0];
      const other = await fetch(root + '/api/tasks');
      cookieB = other.headers.get('set-cookie').split(';')[0];
    });
    await t.test('과제를 생성하고 서버 DB에서 다시 조회한다', async () => {
      const response = await request('', 'POST', input);
      assert.equal(response.status, 201); const body = await response.json(); id = body.task.id;
      assert.equal(body.task.is_completed, false);
      const list = await fetch(root + '/api/tasks', { headers: { Cookie: cookie } });
      assert.equal((await list.json()).tasks.find(task => task.id === id).title, input.title);
    });
    await t.test('다른 브라우저 세션이 과제를 읽거나 수정하거나 삭제할 수 없다', async () => {
      const list = await fetch(root + '/api/tasks', { headers: { Cookie: cookieB } });
      assert.equal((await list.json()).tasks.length, 0);
      assert.equal((await request('/' + id, 'PUT', input, { Cookie: cookieB })).status, 404);
      assert.equal((await request('/' + id + '/status', 'PATCH', { is_completed: true }, { Cookie: cookieB })).status, 404);
      assert.equal((await request('/' + id, 'DELETE', undefined, { Cookie: cookieB })).status, 404);
    });
    await t.test('수정과 완료 전환을 저장한다', async () => {
      const updated = await request('/' + id, 'PUT', { ...input, title: '수정한 과제' });
      assert.equal(updated.status, 200); assert.equal((await updated.json()).task.title, '수정한 과제');
      for (const status of [true, false]) {
        const result = await request('/' + id + '/status', 'PATCH', { is_completed: status });
        assert.equal(result.status, 200); assert.equal((await result.json()).task.is_completed, status);
      }
    });
    await t.test('빈 입력, 날짜 오류, 상태 자료형과 없는 ID를 거부한다', async () => {
      assert.equal((await request('', 'POST', { ...input, title: '  ' })).status, 400);
      assert.equal((await request('', 'POST', { ...input, due_date: '2026-02-30' })).status, 400);
      assert.equal((await request('/' + id + '/status', 'PATCH', { is_completed: 'true' })).status, 400);
      assert.equal((await request('/missing', 'DELETE')).status, 404);
    });
    await t.test('다른 출처, 잘못된 요청 형식과 큰 본문을 거부한다', async () => {
      assert.equal((await request('', 'POST', input, { Origin: 'https://outside.example' })).status, 403);
      assert.equal((await request('', 'POST', input, { 'X-Requested-With': '' })).status, 403);
      assert.equal((await request('', 'POST', input, { 'Content-Type': 'text/plain' })).status, 415);
      assert.equal((await request('', 'POST', { ...input, description: 'x'.repeat(17000) })).status, 413);
      assert.equal((await request('', 'POST', input, { Cookie: '' })).status, 401);
    });
    await t.test('SQL과 HTML 형태의 값을 저장해도 테이블과 데이터가 유지된다', async () => {
      const title = "<img src=x onerror=alert(1)> '; DROP TABLE tasks; --";
      const changed = await request('/' + id, 'PUT', { ...input, title });
      assert.equal(changed.status, 200); assert.equal((await changed.json()).task.title, title);
      const response = await fetch(root + '/api/health'); assert.equal(response.status, 200);
      assert.equal((await response.json()).app, 'task-note-next');
    });
    await t.test('삭제 후 다시 조회되지 않는다', async () => {
      const deleted = await request('/' + id, 'DELETE'); assert.equal(deleted.status, 204);
      const list = await fetch(root + '/api/tasks', { headers: { Cookie: cookie } });
      assert.equal((await list.json()).tasks.length, 0); id = null;
    });
  } finally {
    if (id) await request('/' + id, 'DELETE');
  }
});
