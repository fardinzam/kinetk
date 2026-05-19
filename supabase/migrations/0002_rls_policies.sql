-- ─── workspace-scoped tables ──────────────────────────────────────────────────
-- Pattern: allow access only to rows whose workspace_id the user is a member of

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members only" ON public.workflows
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE public.workflow_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members only" ON public.workflow_events
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE public.webhook_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members only" ON public.webhook_triggers
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE public.workflow_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members only" ON public.workflow_secrets
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members only" ON public.workflow_runs
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE public.workflow_step_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members only" ON public.workflow_step_runs
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- ─── users ────────────────────────────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile only" ON public.users
  FOR ALL USING (id = auth.uid());

-- ─── workspaces ───────────────────────────────────────────────────────────────
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members only" ON public.workspaces
  FOR ALL USING (
    id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- ─── workspace_members ────────────────────────────────────────────────────────
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "same workspace" ON public.workspace_members
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- ─── webhook_rate_limits ──────────────────────────────────────────────────────
-- Written only by the unauthenticated webhook handler via the service-role pg pool.
-- Enable RLS with no anon/authenticated policy to block all REST access.
ALTER TABLE public.webhook_rate_limits ENABLE ROW LEVEL SECURITY;
