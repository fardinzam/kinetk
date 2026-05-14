# FlowForge Implementation Roadmap

## 1. Purpose

This roadmap defines the order to build FlowForge. It assumes the repository starts with planning docs only and the implementation must be built from zero.

The roadmap prioritizes a smooth, low-cost MVP:

- Next.js, React, and TypeScript
- Vercel Hobby for web/API
- Supabase Free for Auth, Postgres, Realtime, and pooled database connections
- IndexedDB for local-first editing
- Postgres tables for workflow queueing, retry scheduling, and webhook rate limiting
- A local/on-demand worker process for the MVP

Each phase is split into smaller groups. Do not skip phase gates; they keep later work from depending on unstable foundations.

## 2. Build Order Summary

1. Foundation and tooling
2. Supabase schema, Auth, and tenant model
3. Shared workflow domain types and reducers
4. Workflow shell and visual editor
5. IndexedDB local-first persistence
6. API workflow CRUD and append-only sync
7. Conflict recovery and schema migration
8. Secrets storage
9. Webhook trigger, rate limiting, and Postgres queue
10. Worker graph execution
11. Run history and observability UI
12. Realtime updates
13. End-to-end testing, deployment, and hardening

## 3. Phase 0: Project Foundation

### Group 0.1: Scaffold App

Goal: Create the Next.js app skeleton and baseline repository structure.

Create:

- `package.json`
- `next.config.ts`
- `tsconfig.json`
- `eslint.config.mjs`
- `playwright.config.ts`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/(app)/layout.tsx`
- `src/app/(app)/workflows/page.tsx`
- `src/lib/env.ts`
- `src/lib/result.ts`
- `src/lib/time.ts`
- `src/types/json.ts`

Commands:

```bash
npm init -y
npm install next react react-dom zod @supabase/supabase-js idb nanoid
npm install -D typescript @types/node @types/react @types/react-dom eslint eslint-config-next vitest @testing-library/react @testing-library/jest-dom jsdom playwright
npx tsc --init
npx playwright install
```

Required `package.json` scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "worker:dev": "tsx src/worker/index.ts"
  }
}
```

Additional worker dependency:

```bash
npm install -D tsx
```

Implementation decisions:

- Use App Router.
- Keep API routes under `src/app/api`.
- Keep reusable domain logic under `src/domain`.
- Keep database access under `src/server`.
- Keep browser-only persistence under `src/client`.
- Keep worker code under `src/worker`.

Done when:

- `npm run dev` starts the empty app.
- `npm run lint` passes.
- `npm run test` runs Vitest, even if no tests exist yet.

### Group 0.2: Environment Contract

Goal: Make required configuration explicit.

Create:

- `.env.example`
- `src/lib/env.ts`

Required environment variables:

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
APP_ENCRYPTION_KEY_BASE64=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Rules:

- Browser code may only read `NEXT_PUBLIC_*`.
- API and worker code may read `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `APP_ENCRYPTION_KEY_BASE64`.
- `APP_ENCRYPTION_KEY_BASE64` must decode to 32 bytes for AES-256-GCM.

Done when:

- Missing required env vars fail fast in server code.
- Client code cannot import server-only env helpers.

### Group 0.3: Test Harness

Goal: Establish testing before feature work.

Create:

- `vitest.config.ts`
- `src/test/setup.ts`
- `src/test/factories.ts`

Test commands:

```bash
npm run test
npm run test:watch
npm run e2e
```

Done when:

- Unit tests can run in `jsdom`.
- Domain tests can run without Supabase.
- Playwright can open the home page locally.

Phase gate:

- App starts.
- Lint passes.
- Unit test command passes.
- Environment contract is documented.

## 4. Phase 1: Database, Auth, and Tenant Foundation

### Group 1.1: Supabase Project Setup

Goal: Create the Supabase-backed data foundation.

Create:

- `supabase/migrations/0001_initial_schema.sql`
- `src/server/supabase/server.ts`
- `src/server/supabase/admin.ts`
- `src/server/db/pool.ts`

Tables in first migration:

- `users`
- `workspaces`
- `workspace_members`
- `workflows`
- `workflow_events`
- `webhook_triggers`
- `webhook_rate_limits`
- `workflow_secrets`
- `workflow_runs`
- `workflow_step_runs`

Rules:

- `users.id` mirrors Supabase Auth user ID.
- Every tenant-owned table includes `workspace_id` directly or through a required parent relation.
- Use service-layer tenant checks for MVP.
- Keep RLS as a later hardening step unless explicitly implemented and tested.

Done when:

- Migration applies cleanly to local Supabase or local Postgres.
- All tables, indexes, and uniqueness constraints from `docs/03-api-and-data-schema.md` exist.

### Group 1.2: Authentication Screens

Goal: Let users sign in and out through Supabase Auth.

Create:

- `src/app/(auth)/sign-in/page.tsx`
- `src/app/(auth)/sign-up/page.tsx`
- `src/app/auth/callback/route.ts`
- `src/components/auth/auth-form.tsx`
- `src/server/auth/session.ts`

Behavior:

- Unauthenticated app routes redirect to `/sign-in`.
- Successful sign-in redirects to `/workflows`.
- Sign-out returns to `/sign-in`.

Done when:

- A user can sign up.
- A user can sign in.
- App routes reject unauthenticated users.

### Group 1.3: Workspace Bootstrap

Goal: Ensure every signed-in user can work inside a workspace.

Create:

- `src/server/workspaces/service.ts`
- `src/server/workspaces/queries.ts`
- `src/app/api/workspaces/route.ts`

Behavior:

- On first sign-in, create a default workspace.
- Create a `workspace_members` row with role `owner`.
- Return only workspaces where the current user is a member.

Tests:

- User sees only their workspaces.
- Non-member cannot access another workspace.
- Bootstrap is idempotent.

Phase gate:

- Auth works.
- Default workspace exists.
- Cross-tenant workspace access is denied.

## 5. Phase 2: Workflow Domain Model

### Group 2.1: Shared Types

Goal: Define workflow shapes once and reuse them everywhere.

Create:

- `src/domain/workflows/types.ts`
- `src/domain/workflows/node-configs.ts`
- `src/domain/workflows/events.ts`
- `src/domain/workflows/schemas.ts`

Include types for:

- `WorkflowGraph`
- `WorkflowNode`
- `WorkflowEdge`
- `NodeType`
- `WorkflowEvent`
- `WorkflowEventType`
- `WorkflowSchemaVersion`
- `EventSchemaVersion`
- Node configs for `webhook_trigger`, `transform_json`, `condition`, `http_request`, and `log`

Rules:

- Validate external input with Zod.
- Keep graph state serializable as JSON.
- Node config must reference secrets by `secretId`, never raw values.

Done when:

- Types compile.
- Invalid node configs fail Zod validation.

### Group 2.2: Reducer and Event Application

Goal: Apply append-only workflow events deterministically.

Create:

- `src/domain/workflows/reducer.ts`
- `src/domain/workflows/validation.ts`
- `src/domain/workflows/migrations.ts`
- `src/domain/workflows/reducer.test.ts`
- `src/domain/workflows/migrations.test.ts`

Reducer behavior:

- Apply `workflow_renamed`.
- Apply `node_added`.
- Apply `node_updated`.
- Apply `node_moved`.
- Apply `node_deleted` and remove connected edges.
- Apply `edge_added`.
- Apply `edge_deleted`.
- Ignore duplicate `client_event_id` at the client queue layer.

Migration behavior:

- `migrateWorkflowEvent(event)` returns the current event shape.
- `migrateWorkflowSnapshot(snapshot)` returns the current graph shape.
- Unsupported versions throw a typed error that sync can convert to `snapshot_required`.

Done when:

- Reducer tests pass.
- Migration tests pass.
- Reducer never mutates the input graph in place.

### Group 2.3: Graph Validation

Goal: Reject invalid executable graphs before worker execution.

Validation rules:

- Exactly one `webhook_trigger`.
- Unique node IDs.
- Unique edge IDs.
- Edge source and target nodes exist.
- Unsupported node type fails.
- No cycles.
- Every non-trigger node is reachable from the trigger.

Done when:

- Unit tests cover each validation rule.
- Validation returns structured errors with codes.

Phase gate:

- Workflow types are stable.
- Reducer and migration tests pass.
- Graph validation tests pass.

## 6. Phase 3: Workflow CRUD and App Shell

### Group 3.1: Workflow List

Goal: Create and list workflows.

Create:

- `src/app/(app)/workflows/page.tsx`
- `src/app/api/workflows/route.ts`
- `src/server/workflows/service.ts`
- `src/server/workflows/queries.ts`
- `src/components/workflows/workflow-list.tsx`
- `src/components/workflows/create-workflow-dialog.tsx`

Behavior:

- User can create a workflow in the active workspace.
- User can see only workflows in their workspace.
- New workflow starts with empty graph and schema version `1`.

Tests:

- Create workflow succeeds for workspace member.
- Create workflow fails for non-member.
- List excludes other workspace workflows.

### Group 3.2: Workflow Detail Shell

Goal: Open a workflow route before the full editor exists.

Create:

- `src/app/(app)/workflows/[workflowId]/page.tsx`
- `src/app/api/workflows/[workflowId]/route.ts`
- `src/components/workflows/workflow-header.tsx`

Behavior:

- Load workflow by `id` and workspace membership.
- Show workflow name, sync status placeholder, and empty canvas placeholder.

Done when:

- User can create and open a workflow.
- Non-member receives `404` or `403` without leaking tenant details.

Phase gate:

- Authenticated user can create, list, and open workflows.
- Cross-tenant workflow access tests pass.

## 7. Phase 4: Visual Workflow Builder

### Group 4.1: Canvas Foundation

Goal: Render and edit graph nodes on a canvas.

Create:

- `src/components/editor/workflow-editor.tsx`
- `src/components/editor/canvas.tsx`
- `src/components/editor/node-card.tsx`
- `src/components/editor/edge-layer.tsx`
- `src/components/editor/editor-toolbar.tsx`
- `src/components/editor/editor-state.ts`

Use:

- React state for active editor graph.
- SVG or canvas layer for edges.
- Stable node positions from `WorkflowGraph`.

Behavior:

- Pan canvas.
- Zoom canvas.
- Select node.
- Drag node.
- Delete selected node.

Done when:

- A seeded graph renders.
- Node drag updates in memory.
- Delete removes node and connected edges.

### Group 4.2: Node and Edge Editing

Goal: Let users build the MVP graph manually.

Create:

- `src/components/editor/node-palette.tsx`
- `src/components/editor/node-config-panel.tsx`
- `src/components/editor/connection-handles.tsx`

Behavior:

- Add `webhook_trigger`.
- Add `transform_json`.
- Add `condition`.
- Add `http_request`.
- Add `log`.
- Connect compatible handles.
- Delete edges.
- Edit node config in side panel.

Rules:

- Only one `webhook_trigger` may exist.
- Node config edits create `node_updated` events.
- Drag end creates one `node_moved` event, not continuous durable events.

Done when:

- User can build a valid trigger -> transform -> log workflow.
- Graph validation errors are visible but do not block editing.

### Group 4.3: Undo and Redo

Goal: Make graph editing recoverable.

Create:

- `src/domain/workflows/history.ts`
- `src/domain/workflows/history.test.ts`
- `src/components/editor/use-editor-history.ts`

Behavior:

- Undo last local graph edit.
- Redo undone graph edit.
- New edit clears redo stack.

Done when:

- Unit tests cover add, move, delete, undo, redo.
- Toolbar buttons reflect available undo/redo state.

Phase gate:

- User can build a valid workflow visually.
- Node config editor supports every MVP node type.
- Undo/redo works for local edits.

## 8. Phase 5: Local-First Persistence

### Group 5.1: IndexedDB Storage

Goal: Persist graph snapshots and pending events locally.

Create:

- `src/client/db/indexed-db.ts`
- `src/client/db/workflow-store.ts`
- `src/client/db/pending-event-store.ts`
- `src/client/db/sync-metadata-store.ts`

Object stores:

- `workflow_snapshots`
- `pending_events`
- `sync_metadata`

Behavior:

- Save workflow snapshot after local edit.
- Save pending event before network sync.
- Restore snapshot on page reload.
- Preserve pending events across reload.

Done when:

- Edits survive reload before backend sync.
- Pending events survive reload.

### Group 5.2: Local Event Queue

Goal: Convert editor actions into durable client events.

Create:

- `src/client/sync/local-event-queue.ts`
- `src/client/sync/sync-status.ts`
- `src/client/sync/local-event-queue.test.ts`

Statuses:

- `Saved locally`
- `Syncing`
- `Synced`
- `Reconnect needed`
- `Refresh required`

Behavior:

- Generate stable `client_event_id`.
- Store pending event before applying optimistic network sync.
- Mark event committed when server returns matching `client_event_id`.

Phase gate:

- User can edit offline.
- Reload restores local graph and pending event queue.
- Sync status accurately reflects local state.

## 9. Phase 6: Append-Only Sync API

### Group 6.1: Sync Endpoint

Goal: Persist pending workflow events to Postgres.

Create:

- `src/app/api/sync/route.ts`
- `src/server/sync/service.ts`
- `src/server/sync/revisions.ts`
- `src/server/sync/events.ts`

Behavior:

- Accept `workflowId`, `baseServerRevision`, and events.
- Validate workspace membership.
- Derive `workspace_id` server-side.
- Deduplicate by `unique(workflow_id, client_event_id)`.
- Assign monotonic `server_revision`.
- Update `workflows.current_state_json`.
- Return committed events and latest revision.

Done when:

- Duplicate event returns original committed event.
- Two events receive increasing revisions.
- Cross-tenant sync is rejected.

### Group 6.2: Event Replay Endpoint

Goal: Let clients recover after reconnect.

Create:

- `src/app/api/workflows/[workflowId]/events/route.ts`
- `src/server/sync/replay.ts`

Behavior:

- Fetch events after `afterRevision`.
- Return `snapshot_required` if replay window is unsafe.
- Include `eventSchemaVersion` on every event.

Done when:

- Client can fetch missed events after known revision.
- Unsupported or unavailable replay returns `snapshot_required`.

### Group 6.3: Client Sync Loop

Goal: Push local events and apply committed remote events.

Create:

- `src/client/sync/sync-engine.ts`
- `src/client/sync/replay-engine.ts`
- `src/client/sync/conflict-recovery.ts`

Behavior:

- Send pending events in order.
- Mark local events committed by `client_event_id`.
- Replay missed remote events in `serverRevision` order.
- Run `migrateWorkflowEvent` before applying events.
- Enter `Refresh required` if replay is unsafe.

Phase gate:

- Offline edit -> reconnect -> sync works.
- Duplicate sync does not duplicate graph changes.
- Old revision returns conflict recovery path.

## 10. Phase 7: Conflict Recovery

### Group 7.1: Snapshot Required UI

Goal: Avoid silently discarding local edits.

Create:

- `src/components/sync/refresh-required-banner.tsx`
- `src/components/sync/conflict-recovery-dialog.tsx`
- `src/client/sync/export-local-copy.ts`

Behavior:

- Show server revision, local base revision, and count of pending local events.
- Show diff summary when possible.
- Provide `Download local copy`.
- Require explicit confirmation before replacing local state.

Done when:

- User can export local graph and pending events as JSON.
- Refresh does not happen without confirmation when pending edits exist.

Phase gate:

- `snapshot_required` is safe for users with unsynced local edits.

## 11. Phase 8: Secrets

### Group 8.1: Encryption Utilities

Goal: Store secrets safely.

Create:

- `src/server/secrets/crypto.ts`
- `src/server/secrets/service.ts`
- `src/server/secrets/crypto.test.ts`

Behavior:

- Decode `APP_ENCRYPTION_KEY_BASE64`.
- Encrypt with AES-256-GCM.
- Store ciphertext, nonce, auth tag, and key version.
- Decrypt only in server/worker code.

Done when:

- Encrypt/decrypt round trip passes.
- Wrong auth tag fails.
- Plaintext never appears in returned metadata.

### Group 8.2: Secrets API and UI

Create:

- `src/app/api/secrets/route.ts`
- `src/components/secrets/secret-list.tsx`
- `src/components/secrets/secret-form.tsx`
- `src/components/editor/secret-picker.tsx`

Behavior:

- List secret metadata.
- Create secret.
- Rotate secret value.
- Disable secret.
- Select secret ID in HTTP request node config.

Phase gate:

- HTTP request node can reference `secretId`.
- API never returns plaintext or ciphertext.
- Cross-tenant secret access is rejected.

## 12. Phase 9: Webhook Trigger and Postgres Queue

### Group 9.1: Trigger Token Management

Create:

- `src/server/triggers/tokens.ts`
- `src/server/triggers/service.ts`
- `src/app/api/workflows/[workflowId]/triggers/route.ts`
- `src/components/workflows/trigger-url-panel.tsx`

Behavior:

- Generate high-entropy token.
- Store token hash only.
- Show raw token once.
- Rotate token.
- Disable trigger.

Done when:

- Raw token is not persisted.
- Trigger URL can be copied from workflow detail.

### Group 9.2: Webhook Rate Limit

Create:

- `src/server/rate-limit/webhook-rate-limit.ts`
- `src/server/rate-limit/webhook-rate-limit.test.ts`

Behavior:

- Use `(token_hash, window_start)` as fixed-window key.
- Allow first 10 requests in one second.
- Reject request 11 in the same second.
- Do not create a run when rejected.

Done when:

- Rate-limit unit tests pass.
- Rate-limited response uses constant shape where practical.

### Group 9.3: Public Webhook Endpoint

Create:

- `src/app/api/hooks/[token]/route.ts`
- `src/server/webhooks/handler.ts`

Behavior:

- Hash incoming token.
- Apply rate limit.
- Lookup active trigger.
- Load active workflow.
- Create `workflow_runs` row with `status = 'queued'`.
- Return quickly with `accepted: true` and `runId`.
- Unknown, disabled, and invalid triggers return `accepted: false`.

Phase gate:

- Valid webhook creates queued run.
- Invalid webhook does not leak tenant details.
- Rate-limited webhook does not create run.

## 13. Phase 10: Worker Execution Engine

### Group 10.1: Worker Process

Create:

- `src/worker/index.ts`
- `src/worker/claim-run.ts`
- `src/worker/complete-run.ts`
- `src/worker/worker-env.ts`

Behavior:

- Poll queued runs.
- Claim one run with `FOR UPDATE SKIP LOCKED`.
- Set `locked_by`, `lease_expires_at`, and `run_attempt`.
- Exit cleanly on SIGINT/SIGTERM.

Command:

```bash
npm run worker:dev
```

Done when:

- Worker claims one queued run.
- Two workers cannot claim the same run.

### Group 10.2: Run Context

Create:

- `src/worker/context/run-context.ts`
- `src/worker/context/path-resolver.ts`
- `src/worker/context/run-context.test.ts`

Behavior:

- Maintain `initial_payload`.
- Maintain `current_payload`.
- Maintain `node_outputs`.
- Resolve `current.*`, `initial.*`, and `nodes.<node_id>.*`.
- Missing node output fails with `context_path_not_found`.

### Group 10.3: Node Executors

Create:

- `src/worker/nodes/webhook-trigger.ts`
- `src/worker/nodes/transform-json.ts`
- `src/worker/nodes/condition.ts`
- `src/worker/nodes/http-request.ts`
- `src/worker/nodes/log.ts`
- `src/worker/nodes/index.ts`

Behavior:

- `webhook_trigger`: emits original payload.
- `transform_json`: maps context paths to output object.
- `condition`: routes `true` or `false`.
- `http_request`: sends request with timeout, response size limit, and secret injection.
- `log`: succeeds and records payload.

### Group 10.4: Execution Orchestrator

Create:

- `src/worker/execution/execute-run.ts`
- `src/worker/execution/graph-order.ts`
- `src/worker/execution/retry-policy.ts`
- `src/worker/execution/redaction.ts`

Behavior:

- Validate graph before execution.
- Execute from trigger.
- Follow condition branch by handle.
- Write one `workflow_step_runs` row per attempt.
- Retry HTTP request failures with backoff.
- Enforce 5-minute timeout.
- Enforce 50-step max.
- Redact secrets before logging.

Phase gate:

- Worker executes trigger -> transform -> log successfully.
- Worker retries HTTP 500 three times and fails.
- Worker never logs plaintext secrets.
- Worker fails runaway run with `run_limit_exceeded`.

## 14. Phase 11: Observability UI

### Group 11.1: Run History

Create:

- `src/app/api/workflows/[workflowId]/history/route.ts`
- `src/components/runs/run-history-list.tsx`
- `src/server/runs/queries.ts`

Behavior:

- Show run status.
- Show queued time, started time, finished time.
- Show duration and error summary.
- Paginate by cursor.

### Group 11.2: Run Detail

Create:

- `src/app/(app)/runs/[runId]/page.tsx`
- `src/app/api/runs/[runId]/route.ts`
- `src/components/runs/run-detail.tsx`
- `src/components/runs/step-timeline.tsx`
- `src/components/runs/json-viewer.tsx`

Behavior:

- Show trigger payload.
- Show each step.
- Show input JSON, output JSON, and error JSON.
- Show retry attempt count.
- Link failed step back to canvas node.

### Group 11.3: Canvas Failure Highlight

Behavior:

- From run detail, open workflow with `runId`.
- Highlight failed node.
- Show error code badge.
- Selecting failed node opens matching step log.

Phase gate:

- User can trigger workflow and inspect successful run.
- User can inspect failed HTTP request run.
- Failed node is visually tied to step log.

## 15. Phase 12: Realtime Updates

### Group 12.1: Server Stream

Create:

- `src/app/api/workflows/[workflowId]/stream/route.ts`
- `src/server/realtime/workflow-stream.ts`

Behavior:

- Authenticate user.
- Authorize workflow membership.
- Stream committed events after known revision.
- Emit `workflow.snapshot_required` on revision gap.

### Group 12.2: Client Subscription

Create:

- `src/client/realtime/workflow-subscription.ts`

Behavior:

- Connect while workflow editor is open.
- Apply remote events in revision order.
- Pause and request replay on gap.
- Update run list on `workflow.run_updated`.

Phase gate:

- Two browser sessions receive committed workflow edits.
- Revision gap triggers replay or conflict recovery.

## 16. Phase 13: Final Hardening and Deployment

### Group 13.1: End-to-End Tests

Create:

- `tests/e2e/auth.spec.ts`
- `tests/e2e/workflow-happy-path.spec.ts`
- `tests/e2e/sync-recovery.spec.ts`
- `tests/e2e/webhook-execution.spec.ts`

Required flows:

- Sign up and create default workspace.
- Create workflow.
- Add trigger, transform, condition, HTTP request, and log nodes.
- Sync graph.
- Trigger webhook.
- Inspect run history and step logs.
- Simulate reconnect and replay.
- Verify conflict recovery preserves local copy.

### Group 13.2: CI

Create:

- `.github/workflows/ci.yml`

Commands in CI:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run e2e
```

Done when:

- Pull requests run lint, typecheck, unit tests, and E2E tests.

### Group 13.3: Deployment Prep

Create:

- `docker-compose.yml`
- `docs/deployment.md`

Deployment notes must include:

- Vercel project setup.
- Supabase project setup.
- Required environment variables.
- How to run worker locally.
- Why always-on hosted worker is deferred for no-cost MVP.

Phase gate:

- Fresh checkout can run locally from docs.
- CI passes.
- Vercel deployment can connect to Supabase.

## 17. Non-MVP Upgrade Path

Only start these after the MVP vertical slice works:

- Replace Postgres queue with Redis and BullMQ.
- Move worker to an always-on container host.
- Add Supabase RLS policies after service-layer checks are stable.
- Add multiplayer cursors.
- Add workflow version browsing UI.
- Add scheduled triggers.
- Add third-party integrations.
- Add KMS-backed envelope encryption.

## 18. Implementation Rules

- Build phases in order.
- Keep each group independently testable.
- Write domain tests before API/UI wiring.
- Do not add Redis, BullMQ, Firebase, or an always-on worker during the MVP unless the cost constraint changes.
- Do not store raw secrets in workflow JSON, event payloads, queue rows, logs, or snapshots.
- Do not let `Refresh required` discard local edits without export and confirmation.
- Do not let worker execution happen inside the webhook request path.
- Do not claim tenant isolation without cross-workspace denial tests.
