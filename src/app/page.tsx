import { currentOwner } from '@/lib/session';
import { listTasks } from '@/lib/db';
import TaskDashboard from '@/components/task-dashboard';
import type { Task } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Home() {
  const owner = await currentOwner();
  let tasks: Task[] = [];
  if (owner) {
    try { tasks = await listTasks(owner); } catch { /* The client offers a retry if storage is unavailable. */ }
  }
  return <TaskDashboard initialTasks={tasks} />;
}
