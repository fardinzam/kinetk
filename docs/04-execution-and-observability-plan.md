# Kinetk Execution and Observability Plan

## 1. Purpose

This document defines how Kinetk turns a saved workflow graph into an executable run and how it captures enough detail for developers to debug failures.

The goal is not to build a complete automation platform. The goal is to execute a constrained set of node types reliably and make every step inspectable.

## 2. Supported MVP Node Types

### 2.1 webhook_trigger

Starts a workflow run from a public webhook request.

Input:

```json
{
  "headers": {
    "content-type": "application/json"
  },
  "body": {
    "event": "payment.created"
  },
  "query": {}
}
```

Output:

```json
{
  "headers": {
    "content-type": "application/json"
  },
  "body": {
    "event": "payment.created"
  },
  "query": {}
}
```

### 2.2 transform_json

Transforms data from the run context into a new JSON object.

MVP implementation:

- Use a constrained JSON mapping expression, not arbitrary JavaScript execution.
- Example config:

```json
{
  "mappings": [
    {
      "target": "email",
      "source": "current.body.customer.email"
    },
    {
      "target": "amount",
      "source": "initial.body.amount"
    }
  ]
}
```

Input:

```json
{
  "body": {
    "customer": {
      "email": "developer@example.com"
    },
    "amount": 4900
  }
}
```

Output:

```json
{
  "email": "developer@example.com",
  "amount": 4900
}
```

### 2.3 condition

Routes execution based on a simple comparison.

Example config:

```json
{
  "leftPath": "amount",
  "operator": "greater_than",
  "rightValue": 1000
}
```

Supported operators:

- `equals`
- `not_equals`
- `greater_than`
- `less_than`
- `exists`
- `does_not_exist`

Outputs:

- `true`
- `false`

### 2.4 http_request

Sends an HTTP request using data from the run context.

Example config:

```json
{
  "method": "POST",
  "url": "https://example.com/webhook",
  "headers": {
    "content-type": "application/json",
    "authorization": {
      "secretId": "secret_123",
      "injectAs": "Bearer"
    }
  },
  "bodyMode": "current_payload"
}
```

Output:

```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "body": {
    "ok": true
  }
}
```

Security:

- Redact sensitive headers before logging.
- Store user-provided credentials as encrypted workspace secrets, referenced by `secretId` in node config.
- Decrypt referenced secrets only inside the worker immediately before sending the HTTP request.
- Block requests to private network ranges in production if possible.
- Enforce timeout.
- Enforce maximum response body size.

### 2.5 log

Records the current payload and marks the step as succeeded.

Output:

```json
{
  "logged": true
}
```

## 3. Graph Execution Model

The worker loads `workflows.current_state_json` at run start and treats it as the run's execution snapshot.

Execution steps:

1. Load the queued run.
2. Mark run as `running`.
3. Load workflow snapshot and validate graph.
4. Find the `webhook_trigger` node.
5. Start with the webhook payload as current payload.
6. Execute the trigger node.
7. Store the trigger output in `run_context.node_outputs`.
8. Execute each target node.
9. Store each node output in `run_context.node_outputs`.
10. Follow outgoing edges according to node output.
11. Write one `workflow_step_runs` row for every executed or skipped step.
12. Mark run as `succeeded` if all required steps complete.
13. Mark run as `failed` if a node fails after retries.

### 3.1 Run Context and Variable Scope

Nodes are not limited to the immediate parent payload. The worker maintains an in-memory `run_context` for the lifetime of the run:

```json
{
  "initial_payload": {
    "headers": {
      "content-type": "application/json"
    },
    "body": {
      "event": "payment.created",
      "transaction_id": "txn_123"
    },
    "query": {}
  },
  "current_payload": {
    "email": "developer@example.com"
  },
  "node_outputs": {
    "node_trigger_1": {
      "body": {
        "transaction_id": "txn_123"
      }
    },
    "node_transform_1": {
      "email": "developer@example.com"
    }
  }
}
```

Supported path roots:

- `current`: output from the immediate parent path.
- `initial`: original webhook payload for the run.
- `nodes.<node_id>`: output from a previously executed node.

Example mappings:

```json
{
  "mappings": [
    {
      "target": "transactionId",
      "source": "initial.body.transaction_id"
    },
    {
      "target": "email",
      "source": "nodes.node_transform_1.email"
    }
  ]
}
```

Execution rules:

- `run_context` is held in worker memory and rebuilt only within the active run.
- Persisted step logs remain the durable audit trail; `run_context` itself is not stored as one large blob.
- A node may only reference `nodes.<node_id>` for nodes that have already executed in the current path.
- If a referenced node output is unavailable, the node fails with `context_path_not_found`.
- Before any value from `run_context` is logged, normal redaction and size-limit rules still apply.

Run limits:

- `max_steps`: 50 executed or skipped steps per run.
- `timeout_ms`: 300000 milliseconds, or 5 minutes, wall-clock time per run.
- The worker checks both limits before each node execution and after each retry delay.
- If either limit is exceeded, the worker marks the run as `failed`, writes a structured limit error, and stops downstream execution.

These limits protect worker capacity from valid graphs that still create runaway behavior through retries, large payload processing, or unexpectedly long external calls.

## 4. Graph Validation

Before execution, the worker validates:

- Exactly one `webhook_trigger` node exists.
- Node IDs are unique.
- Edge IDs are unique.
- Every edge source and target exists.
- The graph has no unsupported node type.
- The graph does not contain a cycle.
- Every non-trigger node is reachable from the trigger.

If validation fails:

- Mark run as `failed`.
- Store `error_summary`.
- Create a synthetic step log with `node_type = "graph_validation"`.

## 5. Condition Branching

Condition nodes choose one outgoing edge by `sourceHandle`:

- `true`
- `false`

Example:

```json
{
  "id": "edge_true",
  "sourceNodeId": "condition_1",
  "sourceHandle": "true",
  "targetNodeId": "http_request_1",
  "targetHandle": "input"
}
```

If no matching branch exists:

- The condition step succeeds.
- Execution ends for that branch.

For MVP, branch execution can be single-path. Parallel fan-out can be future work.

## 6. Error Handling

### 6.1 Node Failure

A node fails when:

- Required config is missing.
- A JSON path cannot be resolved and the node requires it.
- A `run_context` path references a node output that has not executed on the current path.
- A condition uses an unsupported operator.
- An HTTP request times out.
- An HTTP request returns a retry-exhausted 5xx response.
- A referenced secret is missing, disabled, or fails authentication tag verification.
- The run exceeds `max_steps`.
- The run exceeds `timeout_ms`.
- The worker throws an unexpected exception.

On node failure:

1. Capture sanitized input.
2. Capture structured error JSON.
3. Mark step as `failed`.
4. Mark run as `failed`.
5. Stop downstream execution.

### 6.2 Error JSON Shape

```json
{
  "code": "http_request_failed",
  "message": "HTTP request failed with status 500",
  "details": {
    "status": 500,
    "retryable": true
  }
}
```

### 6.3 Run Error Summary

`workflow_runs.error_summary` should be concise:

```txt
HTTP request node "Notify API" failed with status 500 after 3 attempts.
```

The full error belongs in `workflow_step_runs.error_json`.

## 7. Retries

Only `http_request` nodes retry in the MVP.

Retryable failures:

- Network timeout
- Connection reset
- HTTP 429
- HTTP 500
- HTTP 502
- HTTP 503
- HTTP 504

Non-retryable failures:

- HTTP 400
- HTTP 401
- HTTP 403
- HTTP 404
- Invalid URL
- Blocked private network URL
- Invalid node configuration

Backoff policy:

```txt
attempt 1: immediate
attempt 2: 2 seconds
attempt 3: 8 seconds
```

Max attempts:

```txt
3
```

Each attempt should update or create step logs in a way that makes retry behavior visible. Recommended MVP approach:

- One `workflow_step_runs` row per attempt.
- Same `run_id` and `node_id`.
- Incremented `attempt`.

## 8. Step-Level Logging

Each step log captures:

- `run_id`
- `workspace_id`
- `node_id`
- `node_type`
- `status`
- `input_json`
- `output_json`
- `error_json`
- `attempt`
- `started_at`
- `finished_at`
- `duration_ms`

### 8.1 Input Snapshot

`input_json` is the payload the node received.

For `webhook_trigger`, this is the incoming webhook request.

For downstream nodes, this is the previous node's output.

### 8.2 Output Snapshot

`output_json` is the payload emitted by the node.

For failed nodes, `output_json` is usually null.

### 8.3 Secret Redaction

Secrets are stored separately from workflow graph JSON:

- `workflow_secrets.ciphertext`
- `workflow_secrets.nonce`
- `workflow_secrets.auth_tag`
- `workflow_secrets.key_version`

Values are encrypted with AES-256-GCM. The worker loads a secret by `workspace_id` and `secretId`, verifies the GCM auth tag, decrypts it in memory, uses it for the outbound request, and drops the plaintext before persisting logs.

Before writing logs:

- Redact authorization headers.
- Redact cookie headers.
- Redact headers matching `x-api-key`.
- Redact configured secret fields.
- Redact exact decrypted secret values if they appear in input, output, response headers, or error details.

Redaction value:

```json
"[REDACTED]"
```

### 8.4 Size Limits

To keep logs usable:

- Maximum stored input JSON: 256 KB
- Maximum stored output JSON: 256 KB
- Maximum stored error JSON: 64 KB

If truncated, add metadata:

```json
{
  "_truncated": true,
  "_originalBytes": 580000
}
```

## 9. Worker Idempotency

Webhook handling creates a `workflow_runs` row with `status = "queued"`. For the no-cost MVP, this row is the queue item.

The queued row includes:

```json
{
  "runId": "run_123",
  "workspaceId": "workspace_123",
  "workflowId": "workflow_123",
  "status": "queued",
  "nextAttemptAt": "2026-05-13T20:03:00.000Z",
  "leaseExpiresAt": null,
  "lockedBy": null
}
```

The worker starts by loading the run by `runId` and `workspaceId`.

If the run is already `succeeded`, `failed`, or `canceled`, the worker exits without re-executing.

If the run is `queued`, the worker atomically claims it with a short lease and marks it `running`.

Postgres claim pattern:

```sql
select id
from workflow_runs
where status = 'queued'
  and (next_attempt_at is null or next_attempt_at <= now())
  and (lease_expires_at is null or lease_expires_at <= now())
order by queued_at
for update skip locked
limit 1;
```

After selecting a row in the same transaction, the worker sets:

- `status = 'running'`
- `locked_by = worker instance id`
- `lease_expires_at = now() + interval '60 seconds'`
- `run_attempt = run_attempt + 1`

If the worker crashes mid-run, a later retry may find a partially logged run. The MVP should either:

- Clear incomplete step logs for that run before retrying, or
- Append another attempt and make the duplicate attempt visible.

Recommended MVP choice:

- Use one `workflow_runs` row per queued run.
- On worker retry, append new step attempts.
- Do not mark run complete until final success or final failure.
- Use `next_attempt_at` for retry backoff instead of a Redis delayed queue.

## 10. Run Safeguards

The worker must treat graph validation as necessary but insufficient. A graph can be acyclic and still consume too much worker time through retries, slow HTTP responses, or long single-path chains.

Required safeguards:

- Maximum execution time: 5 minutes per run.
- Maximum step count: 50 steps per run, counting executed and skipped nodes.
- Maximum HTTP request timeout: each HTTP request node must have a bounded per-attempt timeout shorter than the run timeout.
- Maximum response body size: oversized responses fail the step before persistence.

Limit error shape:

```json
{
  "code": "run_limit_exceeded",
  "message": "Workflow run exceeded the maximum step count of 50.",
  "details": {
    "limit": "max_steps",
    "maxSteps": 50,
    "stepCount": 51
  }
}
```

When a limit is exceeded:

1. Write the current step as `failed` if execution was in a step.
2. Mark the run as `failed`.
3. Store `workflow_runs.error_summary`.
4. Do not enqueue downstream work for the run.

## 11. Observability UI

### 11.1 Run History List

Display:

- Run status
- Trigger time
- Duration
- Error summary
- Number of steps

### 11.2 Run Detail View

Display:

- Run status header
- Original webhook payload
- Step timeline
- Selected step detail panel
- Input JSON viewer
- Output JSON viewer
- Error JSON viewer
- Retry attempts
- Link back to the failed canvas node

### 11.3 Canvas Failure Highlight

When viewing a failed run:

- Highlight failed node in the canvas.
- Show a badge with the error code.
- Clicking the node opens the step log detail.

## 12. Testing Suite

### 12.1 Unit Tests

Graph reducer:

- Applies `node_added`.
- Applies `node_moved`.
- Deletes connected edges when a node is deleted.
- Ignores duplicate `client_event_id`.
- Treats update to missing deleted node deterministically.

Graph validation:

- Rejects graph without trigger.
- Rejects graph with multiple triggers.
- Rejects graph with cycle.
- Rejects edge pointing to missing node.

Node execution:

- Transform maps JSON paths.
- Transform can read from `current`, `initial`, and previously executed `nodes.<node_id>` outputs.
- Missing `run_context` paths fail with `context_path_not_found`.
- Condition evaluates supported operators.
- HTTP request classifies retryable and non-retryable failures.
- HTTP request resolves encrypted secret references without logging plaintext.
- Secret decrypt fails if the auth tag is invalid.
- Redaction removes sensitive headers.
- Run limit guard fails execution after 50 steps.
- Run timeout guard fails execution after 5 minutes.

Permission helpers:

- Allows workspace member.
- Rejects non-member.

### 12.2 Integration Tests

Sync reconciliation:

- Client submits event batch.
- Server assigns revisions.
- Duplicate `client_event_id` returns original committed event.
- Reconnect fetches events after last revision.
- Old revision returns `snapshot_required`.
- Snapshot refresh with pending local edits shows conflict recovery and preserves a downloadable local copy.

Tenant isolation:

- User A cannot fetch User B's workflow.
- User A cannot sync to User B's workflow.
- User A cannot fetch User B's run history.
- User A cannot join User B's stream.

Webhook trigger:

- Valid token enqueues run.
- Invalid token returns constant-shape response.
- Disabled token does not enqueue run.
- Token lookup does not require exposing workflow ID.
- Requests above 10 per second per trigger token are rejected before creating workflow runs.
- Postgres queue claim does not allow two workers to execute the same queued run.

Worker:

- Valid graph creates run and step logs.
- Failed transform marks run failed.
- Failed HTTP request retries then records final error.
- Run exceeding `max_steps` records `run_limit_exceeded`.
- Run exceeding `timeout_ms` records `run_limit_exceeded`.

### 12.3 E2E Tests

Use Playwright for the MVP happy path:

1. Sign in as demo user.
2. Create workflow.
3. Add webhook trigger, transform, condition, and log nodes.
4. Connect nodes.
5. Confirm sync status becomes `Synced`.
6. Trigger webhook through API request.
7. Open run history.
8. Verify run appears.
9. Open run detail.
10. Verify step input/output JSON is visible.

Use Playwright for failure path:

1. Create workflow with HTTP request node pointing to a test endpoint returning 500.
2. Trigger webhook.
3. Verify run eventually fails.
4. Verify failed node is highlighted.
5. Verify error JSON includes status 500 and attempt count.

## 13. Interview-Ready Answers

### What happens when a workflow fails?

The worker writes a run record and a step record for each executed node. The failed node captures input JSON, structured error JSON, duration, and attempt number. The run detail UI links the error back to the canvas node so the developer can see exactly where the payload failed.

### How do retries work?

Only HTTP request nodes retry. The worker classifies failures as retryable or non-retryable. Retryable failures use bounded exponential backoff with three attempts. Each attempt is visible in step logs.

### How do you prevent logs from leaking secrets?

User-provided credentials are stored as encrypted workspace secrets using AES-256-GCM, not in `.env` and not directly in workflow JSON. Node config stores only a `secretId`. The worker decrypts a secret in memory at the moment of execution, uses it for the outbound request, and sanitizes inputs, outputs, headers, and errors before writing step logs. Authorization, cookie, API key headers, and exact secret values are redacted. Log queries are also scoped by workspace membership.

### Why not execute arbitrary JavaScript in transform nodes?

Arbitrary JavaScript introduces sandboxing and security problems. The MVP uses constrained JSON path mappings. That keeps execution predictable, testable, and safe enough for a focused developer tool.

### How do you prevent a valid workflow from running forever?

Graph validation rejects cycles, but the worker also enforces runtime limits. Each run has a 5 minute wall-clock timeout and a 50 step maximum. The worker checks those limits before each node and after retry delays, then fails the run with a structured `run_limit_exceeded` error if the limits are exceeded.

### Can a later node use data from the original webhook?

Yes. The worker maintains an in-memory `run_context` with the original `initial_payload`, the immediate `current_payload`, and a `node_outputs` map keyed by node ID. Node configs can reference `initial.body.transaction_id` or `nodes.node_transform_1.email`, so a late HTTP request can use trigger data even after several transformations.
