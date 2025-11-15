-- Tasks table for storing user tasks
CREATE TABLE IF NOT EXISTS public.user_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ,
    priority TEXT CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
    status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
    google_task_id TEXT, -- Optional: sync with Google Tasks API
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Reminders table for storing user reminders
CREATE TABLE IF NOT EXISTS public.user_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    reminder_time TIMESTAMPTZ NOT NULL,
    status TEXT CHECK (status IN ('active', 'completed', 'snoozed', 'cancelled')) DEFAULT 'active',
    repeat_type TEXT CHECK (repeat_type IN ('none', 'daily', 'weekly', 'monthly')) DEFAULT 'none',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    snoozed_until TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_tasks_uid ON public.user_tasks(uid);
CREATE INDEX IF NOT EXISTS idx_user_tasks_status ON public.user_tasks(status);
CREATE INDEX IF NOT EXISTS idx_user_tasks_due_date ON public.user_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_user_reminders_uid ON public.user_reminders(uid);
CREATE INDEX IF NOT EXISTS idx_user_reminders_status ON public.user_reminders(status);
CREATE INDEX IF NOT EXISTS idx_user_reminders_time ON public.user_reminders(reminder_time);

-- Enable Row Level Security
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks (users can only access their own tasks)
CREATE POLICY "Users can view own tasks" ON public.user_tasks
    FOR SELECT USING (auth.uid() = uid);
CREATE POLICY "Users can insert own tasks" ON public.user_tasks
    FOR INSERT WITH CHECK (auth.uid() = uid);
CREATE POLICY "Users can update own tasks" ON public.user_tasks
    FOR UPDATE USING (auth.uid() = uid);
CREATE POLICY "Users can delete own tasks" ON public.user_tasks
    FOR DELETE USING (auth.uid() = uid);

-- RLS Policies for reminders (users can only access their own reminders)
CREATE POLICY "Users can view own reminders" ON public.user_reminders
    FOR SELECT USING (auth.uid() = uid);
CREATE POLICY "Users can insert own reminders" ON public.user_reminders
    FOR INSERT WITH CHECK (auth.uid() = uid);
CREATE POLICY "Users can update own reminders" ON public.user_reminders
    FOR UPDATE USING (auth.uid() = uid);
CREATE POLICY "Users can delete own reminders" ON public.user_reminders
    FOR DELETE USING (auth.uid() = uid);

-- Service role policy (for backend with service role key)
CREATE POLICY "Service role full access tasks" ON public.user_tasks
    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access reminders" ON public.user_reminders
    FOR ALL USING (true) WITH CHECK (true);

