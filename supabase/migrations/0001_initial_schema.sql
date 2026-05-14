create extension if not exists pgcrypto;

create table public.users (
  id uuid primary key,
  email text not null unique,
  name text,
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index workspace_members_user_id_idx on public.workspace_members(user_id);

create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  current_state_json jsonb not null default '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}'::jsonb,
  version int not null default 0,
  schema_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, workspace_id)
);

create index workflows_workspace_id_idx on public.workflows(workspace_id);
create index workflows_workspace_deleted_at_idx on public.workflows(workspace_id, deleted_at);

create table public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  workflow_id uuid not null,
  actor_user_id uuid not null references public.users(id) on delete restrict,
  client_event_id text not null,
  server_revision int not null,
  event_type text not null check (
    event_type in (
      'workflow_renamed',
      'node_added',
      'node_updated',
      'node_moved',
      'node_deleted',
      'edge_added',
      'edge_deleted'
    )
  ),
  event_schema_version int not null default 1,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (workflow_id, workspace_id)
    references public.workflows(id, workspace_id)
    on delete cascade,
  unique (workflow_id, client_event_id),
  unique (workflow_id, server_revision)
);

create index workflow_events_workspace_workflow_revision_idx
  on public.workflow_events(workspace_id, workflow_id, server_revision);

create table public.webhook_triggers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  workflow_id uuid not null,
  token_hash text not null unique,
  status text not null check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  last_used_at timestamptz,
  foreign key (workflow_id, workspace_id)
    references public.workflows(id, workspace_id)
    on delete cascade
);

create index webhook_triggers_workspace_workflow_idx
  on public.webhook_triggers(workspace_id, workflow_id);

create table public.webhook_rate_limits (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null,
  window_start timestamptz not null,
  request_count int not null default 0,
  updated_at timestamptz not null default now(),
  unique (token_hash, window_start)
);

create index webhook_rate_limits_window_start_idx
  on public.webhook_rate_limits(window_start);

create table public.workflow_secrets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  ciphertext text not null,
  nonce text not null,
  auth_tag text not null,
  key_version text not null,
  status text not null check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  rotated_at timestamptz,
  unique (workspace_id, name)
);

create index workflow_secrets_workspace_id_idx
  on public.workflow_secrets(workspace_id);

create table public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  workflow_id uuid not null,
  trigger_id uuid references public.webhook_triggers(id) on delete set null,
  status text not null check (
    status in ('queued', 'running', 'succeeded', 'failed', 'canceled')
  ),
  input_snapshot_json jsonb not null,
  idempotency_key text not null,
  step_count int not null default 0,
  max_steps int not null default 50,
  timeout_ms int not null default 300000,
  run_attempt int not null default 0,
  next_attempt_at timestamptz,
  lease_expires_at timestamptz,
  locked_by text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  error_summary text,
  foreign key (workflow_id, workspace_id)
    references public.workflows(id, workspace_id)
    on delete cascade,
  unique (workflow_id, idempotency_key)
);

create index workflow_runs_workspace_workflow_queued_at_idx
  on public.workflow_runs(workspace_id, workflow_id, queued_at desc);
create index workflow_runs_status_next_attempt_at_idx
  on public.workflow_runs(status, next_attempt_at);
create index workflow_runs_lease_expires_at_idx
  on public.workflow_runs(lease_expires_at);

alter table public.workflow_runs
  add constraint workflow_runs_id_workspace_id_key unique (id, workspace_id);

create table public.workflow_step_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  run_id uuid not null,
  node_id text not null,
  node_type text not null,
  status text not null check (
    status in ('pending', 'running', 'succeeded', 'failed', 'skipped')
  ),
  input_json jsonb,
  output_json jsonb,
  error_json jsonb,
  attempt int not null default 1,
  duration_ms int,
  started_at timestamptz,
  finished_at timestamptz,
  foreign key (run_id, workspace_id)
    references public.workflow_runs(id, workspace_id)
    on delete cascade
);

create index workflow_step_runs_workspace_run_idx
  on public.workflow_step_runs(workspace_id, run_id);
create index workflow_step_runs_run_node_idx
  on public.workflow_step_runs(run_id, node_id);
