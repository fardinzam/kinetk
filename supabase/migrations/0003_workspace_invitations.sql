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
CREATE POLICY "workspace members only" ON public.workspace_invitations
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );
