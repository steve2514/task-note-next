'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Task, TaskInput } from '@/lib/types';

const emptyInput: TaskInput = { title: '', course: '', due_date: '', description: '' };
type Filter = 'all' | 'pending' | 'done';
type Feedback = { text: string; error?: boolean } | null;

async function requestAPI(path = '', method = 'GET', data?: unknown) {
  let response: Response;
  try {
    response = await fetch(`/api/tasks${path}`, {
      method, cache: 'no-store', headers: {
        'X-Requested-With': 'task-note',
        ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
  } catch { throw new Error('서버에 연결하지 못했습니다. 연결 상태를 확인해 주세요.'); }
  if (response.status === 204) return null;
  let body;
  try { body = await response.json(); } catch { throw new Error('응답을 확인하지 못했습니다. 목록을 새로고침해 주세요.'); }
  if (!response.ok) throw new Error(body.error || '요청을 처리하지 못했습니다.');
  return body;
}

function sorted(tasks: Task[]) {
  return [...tasks].sort((a, b) => a.due_date.localeCompare(b.due_date) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

export default function TaskDashboard({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [input, setInput] = useState<TaskInput>(emptyInput);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [pending, setPending] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [today, setToday] = useState('');
  const lock = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setToday(new Intl.DateTimeFormat('ko-KR', { dateStyle: 'full' }).format(new Date()));
    requestAPI().then(body => {
      if (active) { setTasks(body.tasks); setLoaded(true); }
    }).catch(error => {
      if (active) setFeedback({ text: error.message, error: true });
    }).finally(() => { if (active) setPending(false); });
    return () => { active = false; };
  }, []);

  function reset() { setInput(emptyInput); setEditing(null); }
  function acceptTask(task: Task) { setTasks(previous => sorted([...previous.filter(item => item.id !== task.id), task])); }
  async function operate(action: () => Promise<void>, success: string) {
    if (lock.current) return;
    lock.current = true; setPending(true); setFeedback(null);
    try { await action(); setFeedback({ text: success }); }
    catch (error) { setFeedback({ text: error instanceof Error ? error.message : '다시 시도해 주세요.', error: true }); }
    finally { lock.current = false; setPending(false); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!loaded) return;
    void operate(async () => {
      const body = await requestAPI(editing ? `/${editing}` : '', editing ? 'PUT' : 'POST', input);
      acceptTask(body.task); reset();
    }, editing ? '과제를 수정했습니다.' : '새 과제를 등록했습니다.');
  }
  function edit(task: Task) {
    setInput({ title: task.title, course: task.course, due_date: task.due_date, description: task.description });
    setEditing(task.id); setFeedback(null); titleInput.current?.focus();
  }
  async function refresh() {
    await operate(async () => { const body = await requestAPI(); setTasks(body.tasks); setLoaded(true); }, '목록을 새로고침했습니다.');
  }
  const completed = tasks.filter(task => task.is_completed).length;
  const shown = tasks.filter(task => filter === 'all' || (filter === 'done' ? task.is_completed : !task.is_completed));
  const change = (field: keyof TaskInput, value: string) => setInput(previous => ({ ...previous, [field]: value }));

  return <>
    <header className="header">
      <a className="brand" href="/" aria-label="과제노트 홈"><span className="brand-icon" aria-hidden="true">✓</span>과제노트</a>
      <span className="header-caption">나의 작은 학기 관리 도구</span>
      <span className="demo-badge">학습 프로젝트</span>
    </header>
    <main>
      <section className="intro"><div><p className="eyebrow">MY ASSIGNMENTS</p><h1>해야 할 일을 가볍게 정리해요</h1><p className="intro-copy">과제를 기록하고, 하나씩 완료해 보세요.</p></div><p className="today">{today}</p></section>
      <section className="stats" aria-label="과제 현황">
        <div><span>전체 과제</span><strong>{tasks.length}</strong></div>
        <div><span><i className="dot orange" />진행 중</span><strong>{tasks.length - completed}</strong></div>
        <div><span><i className="dot green" />완료</span><strong>{completed}</strong></div>
      </section>
      <div className="workspace">
        <section className="panel editor" aria-labelledby="form-heading">
          <div className="section-heading"><h2 id="form-heading">{editing ? '과제 수정' : '새 과제 등록'}</h2><span className="small-label">필수 항목 *</span></div>
          <p className="section-copy">{editing ? '바꿀 내용을 입력하고 저장해 주세요.' : '지금 해야 할 과제를 남겨 주세요.'}</p>
          <form onSubmit={submit}>
            <label htmlFor="title">과제명 <span>*</span></label>
            <input ref={titleInput} id="title" name="title" placeholder="예: 중간 보고서 작성" maxLength={100} required value={input.title} onChange={event => change('title', event.target.value)} disabled={pending} />
            <label htmlFor="course">과목명 <span>*</span></label>
            <input id="course" name="course" placeholder="예: 웹서버보안프로그래밍" maxLength={100} required value={input.course} onChange={event => change('course', event.target.value)} disabled={pending} />
            <label htmlFor="due-date">마감일 <span>*</span></label>
            <input id="due-date" name="due_date" type="date" required value={input.due_date} onChange={event => change('due_date', event.target.value)} disabled={pending} />
            <label htmlFor="description">설명 <span className="optional">선택</span></label>
            <textarea id="description" name="description" rows={3} placeholder="준비할 내용이나 간단한 메모" maxLength={1000} value={input.description} onChange={event => change('description', event.target.value)} disabled={pending} />
            <button className="primary" type="submit" disabled={pending || !loaded}>{editing ? '변경 사항 저장' : '＋ 과제 등록'}</button>
            {editing && <button className="secondary cancel-edit" type="button" onClick={reset} disabled={pending}>수정 취소</button>}
          </form>
          <p className="form-tip">입력한 과제는 서버에 저장됩니다.</p>
        </section>
        <section className="panel task-panel" aria-labelledby="list-heading">
          <div className="section-heading"><h2 id="list-heading">나의 과제 목록</h2><button className="refresh" type="button" aria-label="과제 목록 새로고침" disabled={pending} onClick={() => void refresh()}>↻ 새로고침</button></div>
          <div className="list-toolbar"><div className="filters" role="group" aria-label="과제 상태 필터">
            {([['all', '전체'], ['pending', '진행 중'], ['done', '완료']] as const).map(([value, label]) => <button type="button" key={value} onClick={() => setFilter(value)} aria-pressed={filter === value}>{label}</button>)}
          </div><span className="sort-label">마감일 빠른 순</span></div>
          {feedback && <p className={`feedback${feedback.error ? ' error' : ''}`} role={feedback.error ? 'alert' : 'status'} aria-live="polite">{feedback.text}</p>}
          <div className="task-list" aria-busy={pending}>
            {!loaded ? <div className="empty"><strong>{pending ? '과제를 불러오고 있어요' : '목록을 불러오지 못했어요'}</strong>{pending ? '잠시만 기다려 주세요.' : '새로고침 버튼으로 다시 시도해 주세요.'}</div> : !shown.length ? <div className="empty"><strong>{tasks.length ? '해당하는 과제가 없어요' : '첫 번째 과제를 등록해 보세요'}</strong>{tasks.length ? '다른 필터에서 과제를 확인해 보세요.' : '등록 폼에 과제명과 마감일을 입력해 주세요.'}</div> : shown.map(task => <article className={`task${task.is_completed ? ' is-done' : ''}`} key={task.id}>
              <button type="button" className="complete-button" aria-label={`${task.title} ${task.is_completed ? '미완료로' : '완료로'} 변경`} aria-pressed={task.is_completed} disabled={pending} onClick={() => void operate(async () => { acceptTask((await requestAPI(`/${task.id}/status`, 'PATCH', { is_completed: !task.is_completed })).task); }, '완료 상태를 변경했습니다.')}>{task.is_completed ? '✓' : ''}</button>
              <div className="task-body"><h3>{task.title}</h3><div className="task-meta"><span className="course-tag">{task.course}</span><time className="date-tag" dateTime={task.due_date}>{task.due_date.replaceAll('-', '.')}</time><span className="state-tag">{task.is_completed ? '완료' : '진행 중'}</span></div>{task.description && <p className="task-description">{task.description}</p>}</div>
              <div className="task-actions"><button type="button" aria-label={`${task.title} 수정`} disabled={pending} onClick={() => edit(task)}>수정</button><button type="button" className="delete-button" aria-label={`${task.title} 삭제`} disabled={pending} onClick={() => { setDeleting(task); dialog.current?.showModal(); }}>삭제</button></div>
            </article>)}
          </div>
        </section>
      </div>
      <p className="demo-note">이 브라우저의 과제만 표시합니다. 쿠키를 지우면 기존 과제에 접근할 수 없습니다.</p>
    </main>
    <footer><span>과제노트</span><span>웹서버보안프로그래밍 프로젝트</span></footer>
    <dialog ref={dialog} onClose={() => setDeleting(null)}>
      <h2>이 과제를 삭제할까요?</h2><p className="delete-name">{deleting?.title}</p><p className="section-copy">삭제한 과제는 복구할 수 없습니다.</p>
      <div className="dialog-actions"><button className="secondary" type="button" disabled={pending} onClick={() => dialog.current?.close()}>취소</button><button className="danger" type="button" disabled={pending} onClick={() => { if (!deleting) return; const id = deleting.id; void operate(async () => { await requestAPI(`/${id}`, 'DELETE'); setTasks(previous => previous.filter(task => task.id !== id)); if (editing === id) reset(); dialog.current?.close(); }, '과제를 삭제했습니다.'); }}>삭제하기</button></div>
    </dialog>
  </>;
}
