CREATE TABLE public.workspace_invitations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invited_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email              text NOT NULL,
  token              text NOT NULL UNIQUE,
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'revoked')),
  expires_at         timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email)
);

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.workspace_invitations FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.workspace_invitations FROM authenticated;

GRANT SELECT ON public.workspace_invitations TO authenticated;

CREATE POLICY "workspace_invitations select members" ON public.workspace_invitations
  FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
