-- 202611170001_performance_indexes.sql
-- High-throughput indexes for hierarchical subtasks, comments, time entries and documents

CREATE INDEX IF NOT EXISTS tasks_parent_task_idx ON public.tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS task_comments_task_created_idx ON public.task_comments(task_id, created_at ASC);
CREATE INDEX IF NOT EXISTS time_entries_task_started_idx ON public.time_entries(task_id, started_at DESC);
CREATE INDEX IF NOT EXISTS project_members_user_project_idx ON public.project_members(user_id, project_id);
CREATE INDEX IF NOT EXISTS project_documents_project_updated_idx ON public.project_documents(project_id, updated_at DESC);
