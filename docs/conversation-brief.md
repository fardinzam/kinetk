# Conversation Brief

## Project Direction

The selected direction is a local-first visual workflow builder, narrowed from a broad Zapier-style platform into a developer-focused webhook workflow tool.

Working name: FlowForge.

## Why This Product Direction

This product direction emphasizes:

- Complex non-linear frontend state through a graph editor
- Local-first UX with IndexedDB and optimistic updates
- Undo/redo through command or event modeling
- Backend event-log synchronization
- Tenant-safe authorization
- Secure public webhook trigger handling
- Background job execution
- Step-level observability
- Real-time collaboration or update propagation
- Practical testing and deployment discipline

## Important Scope Decisions

The project should not start as a general automation platform. It should focus on webhook workflows for developers.

The MVP should avoid full CRDTs, many third-party integrations, auto-layout, and multiplayer polish. The strongest first release is a single complete vertical slice where a workflow can be created, edited, synced, triggered, executed, and inspected.

## Security Concerns

Webhook endpoints should not expose workflow IDs or tenant identifiers. Use opaque trigger tokens, store only token hashes, scope every lookup by workspace, and return generic responses for invalid or disabled triggers.

Tenant isolation should be tested directly, especially around workflow access, trigger execution, run history, and real-time update channels.

## Observability Concerns

A simple success/failure status is not enough. Developers need to inspect why a workflow failed.

The app should include run history with step-level logs. Each workflow run should have child step records that capture input JSON, output JSON, errors, duration, attempt number, and node metadata.

## Sync Concerns

Local-first plus real-time collaboration creates state drift risk.

The proposed strategy is append-only workflow events with server revisions and client event IDs. Clients apply changes locally, sync them to the server, ignore duplicate acknowledgements, and replay missed events on reconnect. If replay cannot be trusted, the client should do a full snapshot resync.

Durable graph edits should be separate from ephemeral presence or drag updates. A node drag should commit one durable NodeMoved event on drag end, not a stream of every pixel movement.
