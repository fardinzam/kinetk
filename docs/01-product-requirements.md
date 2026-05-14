# FlowForge Product Requirements Document

## 1. Problem Statement

Developers who build and debug webhook integrations need a fast way to model small automation workflows, trigger them with real HTTP payloads, and inspect exactly what happened at each step. Existing automation tools often hide execution details behind high-level success or failure states, while developer-built scripts lack visual structure, collaboration, and persistent run history.

FlowForge exists to provide a local-first visual workflow builder for webhook automation with transparent, step-level execution debugging.

## 2. Product Goal

Build a production-minded full-stack application where an integration developer can create a webhook-driven workflow, edit it instantly on a visual canvas, sync it safely to the cloud, execute it through a secure public trigger, and inspect every node's input, output, and error state.

The MVP should prove one complete vertical slice:

1. Create a workflow.
2. Edit the graph locally.
3. Sync graph changes to the backend.
4. Trigger the workflow through a secure webhook URL.
5. Execute the workflow asynchronously.
6. Inspect run history and step-level logs.
7. Recover cleanly after a temporary network disconnect.

## 3. Target Persona

### The Integration Developer

The primary user is a developer or technical operator responsible for connecting APIs, testing webhook payloads, and debugging integration failures.

They care about:

- Fast iteration while building workflows
- Clear visibility into payload shape changes
- Secure webhook URLs
- Accurate failure reasons
- Repeatable test runs
- Confidence that private workflow data and logs are tenant-isolated

They do not need a broad no-code automation marketplace in the MVP.

## 4. MVP Functional Requirements

### 4.1 Authentication and Workspaces

- Users can sign up, sign in, and sign out.
- Users belong to one or more workspaces.
- A workflow belongs to exactly one workspace.
- All workflow, event, trigger, run, and log access is scoped to workspace membership.
- The MVP supports two roles:
  - `owner`: can manage workspace members and all workflows.
  - `member`: can create, edit, run, and inspect workflows.

### 4.2 Workflow Builder

- Users can create, rename, duplicate, and delete workflows.
- Users can open a workflow canvas.
- Users can add supported node types:
  - `webhook_trigger`
  - `transform_json`
  - `condition`
  - `http_request`
  - `log`
- Users can drag nodes on the canvas.
- Users can connect compatible node handles with directed edges.
- Users can delete nodes and edges.
- Users can select a node and edit its configuration in a side panel.
- Users can pan and zoom the canvas.
- Users can use undo and redo for graph edits.
- The canvas should preserve node positions and edge connections across reloads.

### 4.3 Local-First Engine

- Workflow edits are written to IndexedDB before network sync.
- The UI must remain usable while offline.
- The app displays sync status:
  - `Saved locally`
  - `Syncing`
  - `Synced`
  - `Reconnect needed`
  - `Refresh required`
- Local edits are represented as durable workflow events with client-generated IDs.
- When connectivity returns, unsynced events are sent to the backend in order.
- Duplicate client events must not create duplicate graph changes.
- If a snapshot refresh is required and local edits cannot be safely rebased, the app must preserve pending local events and offer a conflict recovery UI before replacing local state.

### 4.4 Synchronization

- The backend stores workflow edits in an append-only event log.
- Each committed event receives a monotonic `server_revision` per workflow.
- The client tracks the last applied `server_revision`.
- On reconnect, the client requests missed events after its last known revision.
- If the server cannot satisfy replay safely, the client fetches the latest workflow snapshot.
- Real-time updates are delivered only to authorized members of the workflow's workspace.

### 4.5 Execution Engine

- Each workflow exposes a secure webhook trigger URL.
- Webhook URLs use opaque high-entropy trigger tokens, not workflow IDs.
- Trigger tokens are stored as hashes.
- Public webhook traffic is rate limited before workflow lookup or run creation.
- A valid webhook request enqueues a workflow run.
- Workflow execution happens in a background worker, not in the request/response path.
- For the no-cost MVP, queued runs are stored and claimed from Postgres instead of Redis.
- The worker parses the workflow graph and executes supported nodes.
- The webhook request returns quickly after the run is accepted.
- The MVP supports at-least-once worker execution with idempotent run handling.
- Each run has bounded execution limits: maximum 5 minutes wall-clock time and maximum 50 executed steps.

### 4.6 Observability

- Users can view a list of workflow runs.
- Users can open a single run detail view.
- A run detail view shows:
  - Overall run status
  - Trigger payload snapshot
  - Step timeline
  - Per-step input JSON
  - Per-step output JSON
  - Per-step error JSON
  - Duration per step
  - Retry attempt count
- Failed steps are visually tied back to the corresponding canvas node.
- Secrets and sensitive headers are masked or excluded from logs.

### 4.7 Secrets

- HTTP request credentials and other user-provided secrets are stored in an encrypted secret store, not in `.env` files or plaintext workflow JSON.
- Secret values are encrypted per workspace using AES-256-GCM before persistence.
- Workflow node configuration references secrets by stable secret IDs.
- The worker decrypts a secret only at the moment a node executes and must never persist decrypted values in logs, snapshots, events, or queue payloads.
- Users can create, update, delete, and rotate secrets within a workspace.

## 5. Non-Functional Requirements

### 5.1 Performance

- Canvas drag interactions should target 60fps.
- Per-frame canvas interaction work should stay under 16ms on a modern laptop for a workflow with 100 nodes and 150 edges.
- Node drag should not persist every pixel movement as a durable event. Only the final position on drag end should create a durable `node_moved` event.
- Real-time drag previews may be ephemeral, but they are not required for MVP.

### 5.2 Security

- All authenticated API requests must verify workspace membership.
- Public webhook trigger lookup must not expose workflow IDs or tenant identifiers.
- Invalid, disabled, and unknown webhook triggers should return constant-shape responses where practical.
- Webhook trigger tokens must be rotatable.
- Trigger tokens must be stored hashed.
- Webhook requests must enforce a rate limit of 10 requests per second per trigger token before creating workflow runs.
- The MVP rate limiter uses a Postgres fixed-window counter keyed by trigger hash and epoch second.
- Run logs must be tenant-scoped.
- Real-time channels must authorize workspace membership before join.

### 5.3 Reliability

- Sync events must be idempotent through `client_event_id`.
- Workflow execution must tolerate retry of the same queued job.
- Failed HTTP request nodes should use bounded retry with exponential backoff.
- A disconnected client must recover through event replay or snapshot refresh.
- A `Refresh required` state must not silently discard local work; the user must be able to inspect conflicts or download a local recovery copy before accepting the server snapshot.
- Run timeouts and step-count limits must stop runaway logical loops, excessive retries, and oversized execution paths.

### 5.4 Usability

- A developer should be able to create and trigger a working workflow within 5 minutes on a seeded demo account.
- Failure states must explain what happened and where.
- The app should avoid blocking spinners during workflow editing; local editing should remain responsive.

### 5.5 Cost Constraints

- The MVP should target no-cost hosted operation where practical.
- Default hosted services are Vercel Hobby and Supabase Free.
- Redis, BullMQ, and a separately hosted always-on worker are scale upgrades, not MVP requirements.
- Queueing, retry scheduling, and webhook rate limiting should use Postgres tables for the MVP.
- The implementation should avoid Firebase Blaze-only backend dependencies for the default architecture.

## 6. User Stories

- As an integration developer, I want to create a webhook workflow visually so I can understand the order of operations at a glance.
- As an integration developer, I want workflow edits to save instantly so I can keep working even when the network is unstable.
- As an integration developer, I want to see whether changes are local, syncing, or synced so I can trust the editor state.
- As an integration developer, I want to trigger a workflow with a real webhook payload so I can test realistic integration behavior.
- As an integration developer, I want to see exactly why my webhook failed at the `transform_json` step so I can debug payload shape issues.
- As an integration developer, I want to inspect the JSON input and output for every step so I can verify each transformation.
- As a workspace owner, I want webhook triggers and run logs isolated by workspace so users cannot access other tenants' data.
- As a developer returning after a disconnect, I want the editor to replay missed changes or refresh safely so the canvas does not silently drift from the backend.

## 7. MVP Acceptance Criteria

- A user can sign in, create a workspace, and create a workflow.
- A user can add and connect the MVP node types on a canvas.
- Edits are saved to IndexedDB and survive page reload.
- Unsynced edits are sent to the backend as append-only events.
- Duplicate sync events do not duplicate graph changes.
- A webhook trigger URL can start a workflow run.
- The worker executes a graph containing trigger, transform, condition, HTTP request, and log nodes.
- A run detail page shows step-level input, output, error, duration, and status.
- A member of another workspace cannot access the workflow, trigger, run, or step logs.
- After WebSocket or SSE disconnect, the client can recover through missed event replay or snapshot refresh.
- If snapshot refresh would discard unsynced work, the client shows conflict recovery with at least a diff summary and a downloadable local copy.
- Webhook bursts above 10 requests per second per trigger token are rejected without enqueuing runs.
- A workflow run exceeding 5 minutes or 50 executed steps is failed with a clear limit error.

## 8. Out Of Scope For MVP

- Full CRDT implementation
- Third-party app integrations such as Gmail, Slack, Stripe, or GitHub
- Email triggers
- Scheduled triggers
- Multiplayer cursors
- Auto-layout
- Branch merge UI
- Workflow version browsing UI
- Complex secret vault features beyond the MVP encrypted workspace secret store, such as sharing policies, audit approval workflows, and KMS envelope encryption UI
- Marketplace templates
- Mobile-first workflow editing
