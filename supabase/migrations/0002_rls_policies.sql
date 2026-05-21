-- RLS lockdown: authenticated clients may SELECT tenant-visible rows only.
-- All writes must go through trusted server code using service_role or the raw pg pool.

-- ─── helper functions ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_workspace_member(
  target_workspace_id uuid,
  target_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND wm.user_id = target_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(
  target_workspace_id uuid,
  target_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND wm.user_id = target_user_id
      AND wm.role = 'owner'
  );
$$;

REVOKE ALL ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_workspace_owner(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_owner(uuid, uuid) TO authenticated;

-- ─── privilege lockdown ──────────────────────────────────────────────────────
-- Service role / postgres bypasses RLS. Browser roles get SELECT only.

REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM authenticated;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- ─── remove old broad policies ───────────────────────────────────────────────

DROP POLICY IF EXISTS "workspace members only" ON public.workflows;
DROP POLICY IF EXISTS "workspace members only" ON public.workflow_events;
DROP POLICY IF EXISTS "workspace members only" ON public.webhook_triggers;
DROP POLICY IF EXISTS "workspace members only" ON public.workflow_secrets;
DROP POLICY IF EXISTS "workspace members only" ON public.workflow_runs;
DROP POLICY IF EXISTS "workspace members only" ON public.workflow_step_runs;
DROP POLICY IF EXISTS "own profile only" ON public.users;
DROP POLICY IF EXISTS "workspace members only" ON public.workspaces;
DROP POLICY IF EXISTS "same workspace" ON public.workspace_members;

-- ─── enable RLS ──────────────────────────────────────────────────────────────

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_step_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_rate_limits ENABLE ROW LEVEL SECURITY;

-- ─── SELECT-only policies ────────────────────────────────────────────────────

CREATE POLICY "users select own profile"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "workspaces select members"
ON public.workspaces
FOR SELECT
TO authenticated
USING (public.is_workspace_member(id, auth.uid()));

CREATE POLICY "workspace_members select members"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "workflows select members"
ON public.workflows
FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "workflow_events select members"
ON public.workflow_events
FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "webhook_triggers select members"
ON public.webhook_triggers
FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "workflow_secrets select members"
ON public.workflow_secrets
FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "workflow_runs select members"
ON public.workflow_runs
FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "workflow_step_runs select members"
ON public.workflow_step_runs
FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()));

-- No policy for webhook_rate_limits.
-- It is internal infrastructure and should not be readable or writable through PostgREST.

-- ─── invitation table hardening if migration 0003 has already run ────────────

DO $$
BEGIN
  IF to_regclass('public.workspace_invitations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "workspace members only" ON public.workspace_invitations';
    EXECUTE 'DROP POLICY IF EXISTS "workspace_invitations select members" ON public.workspace_invitations';

    EXECUTE '
      CREATE POLICY "workspace_invitations select members"
      ON public.workspace_invitations
      FOR SELECT
      TO authenticated
      USING (public.is_workspace_member(workspace_id, auth.uid()))
    ';
  END IF;
END $$;
