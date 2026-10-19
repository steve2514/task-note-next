export type Task = {
  id: string;
  title: string;
  course: string;
  due_date: string;
  description: string;
  is_completed: boolean;
  created_at: string;
};

export type TaskInput = Pick<Task, 'title' | 'course' | 'due_date' | 'description'>;
