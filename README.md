# FlowForge

FlowForge is a local-first webhook workflow builder for developers.

The goal is to build a production-minded workflow tool that demonstrates complex frontend state, tenant-safe backend design, event-log synchronization, background execution, and step-level observability.

## Core Thesis

A developer can design webhook-driven workflows on a fast local canvas, sync changes through an event log, trigger workflows through secure public endpoints, and debug every execution step from captured input/output snapshots.

## MVP Scope

The MVP should prove one complete vertical slice:

1. A user creates a workflow.
2. The user edits it locally on a visual canvas.
3. Changes persist immediately to IndexedDB.
4. Changes sync to the backend through an append-only event log.
5. A secure webhook trigger starts a workflow run.
6. A background worker executes each node.
7. The user inspects run history and step-level input/output/error logs.

## MVP Features

- Authenticated app shell
- Workspace membership and tenant-scoped authorization
- Workflow list and workflow detail page
- Visual graph editor with nodes, edges, pan, zoom, selection, delete, and config editing
- Node types: webhook trigger, transform JSON, condition, HTTP request, log
- IndexedDB local persistence
- Optimistic sync states: saved locally, syncing, synced, conflict or refresh needed
- Undo/redo for graph edits
- Append-only workflow event log
- Idempotent event sync using client event IDs
- Versioned workflow events with migration helpers for replay compatibility
- SSE or WebSocket updates scoped to workflow rooms
- Secure webhook trigger tokens stored as hashes
- Postgres fixed-window rate limiting for public webhook triggers before run creation
- Encrypted workspace secrets for HTTP request credentials
- Postgres-backed background execution queue
- Worker run safeguards for max execution time and max step count
- Run context with access to original trigger payload and prior node outputs
- Run history with step-level observability
- Conflict recovery for unsafe snapshot refreshes without silently discarding local work
- Tests for tenant isolation, duplicate events, event replay, and failed executions

## Explicit Non-Goals For V1

- Full CRDT implementation
- Gmail, Slack, Stripe, or other third-party integrations
- Email triggers
- Auto-layout
- Multiplayer cursors
- Complex branch merge UI
- Version history UI
- Complex scheduling
- Canvas virtualization unless profiling proves it is needed

## Architecture Notes

Webhook triggers should use opaque high-entropy public tokens, not guessable workflow IDs. Store token hashes in the database and return constant-shape responses for invalid or disabled triggers.

Public webhook requests should be rate limited before expensive workflow lookup or run creation. The MVP policy is 10 requests per second per trigger token using a Postgres fixed-window counter. Redis or Upstash can replace this later if webhook traffic grows.

Workflow sync should use append-only events with monotonically increasing server revisions. Clients apply local edits optimistically, send events with idempotency keys, and replay missed server events after reconnect. Events and snapshots carry schema versions, and clients migrate legacy event payloads before reducer application. If the revision gap cannot be resolved, the client should preserve pending local edits and show conflict recovery with a downloadable local copy before refreshing.

Execution should store run-level and step-level logs. Each step log should capture the node ID, node type, status, input JSON, output JSON, error JSON, start/end timestamps, duration, and retry attempt. The worker should maintain an in-memory run context with the original trigger payload, current payload, and prior node outputs so late steps can reference earlier data.

Secrets should be stored as encrypted workspace secrets, not in `.env` files or plaintext workflow JSON. Node configs reference secret IDs. The worker decrypts secret values only at execution time and masks or excludes secrets from logs, snapshots, events, and queue payloads.

Worker execution should be bounded. The MVP limit is 5 minutes wall-clock time and 50 executed or skipped steps per run, preventing valid but pathological workflows from tying up worker capacity.

The API, realtime gateway, webhook handler, and worker should connect to Supabase Postgres through the pooled connection endpoint. Worker concurrency should be budgeted so retry spikes cannot consume every database connection and lock out user-facing API traffic.

## Default Free-Tier Stack

- Next.js, React, and TypeScript
- Vercel Hobby for web/API hosting
- Supabase Free for Postgres, Auth, Realtime, and pooled database connections
- Postgres tables for workflow runs, worker leases, retries, and webhook rate limits
- IndexedDB for local-first browser persistence
- GitHub Actions for CI

Redis, BullMQ, and a separately hosted always-on worker are scale upgrades, not MVP requirements.

## Estimated Timeline

- Bare MVP: 4-5 weeks
- If learning IndexedDB, queues, WebSockets, and canvas math while building: 10-14 weeks

The target bar is:

> One workflow can be built, synced, triggered, executed, inspected, and recovered after reconnect.
