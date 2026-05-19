import type { HttpRequestNodeConfig } from "@/domain/workflows/node-configs";
import { validateExecutableGraph } from "@/domain/workflows/validation";
import type { Queryable } from "@/server/db/pool";
import { fetchWorkflowSyncState } from "@/server/sync/revisions";

import type { ClaimedRun } from "../claim-run";
import { failRun, scheduleRetry, succeedRun } from "../complete-run";
import { createRunContext, setNodeOutput } from "../context/run-context";
import { nodeExecutors } from "../nodes/index";

import { getNextNodeIds } from "./graph-order";
import { getRetryDelayMs, MAX_HTTP_RETRIES } from "./retry-policy";
import { redactHttpRequestConfig } from "./redaction";

async function writeStepRun(
  db: Queryable,
  params: {
    runId: string;
    workspaceId: string;
    nodeId: string;
    nodeType: string;
    status: "succeeded" | "failed";
    inputJson: unknown;
    outputJson: unknown;
    errorJson: unknown;
    durationMs: number;
    attempt: number;
  },
): Promise<void> {
  await db.query(
    `
      insert into public.workflow_step_runs
        (run_id, workspace_id, node_id, node_type, status,
         input_json, output_json, error_json, duration_ms, attempt,
         started_at, finished_at)
      values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10,
              now() - ($9 * interval '1 millisecond'), now())
    `,
    [
      params.runId,
      params.workspaceId,
      params.nodeId,
      params.nodeType,
      params.status,
      JSON.stringify(params.inputJson ?? null),
      JSON.stringify(params.outputJson ?? null),
      JSON.stringify(params.errorJson ?? null),
      params.durationMs,
      params.attempt,
    ],
  );
}

export async function executeRun(
  run: ClaimedRun,
  db: Queryable,
): Promise<void> {
  const startTime = Date.now();

  // Load workflow graph
  const workflowState = await fetchWorkflowSyncState(db, run.workflowId);
  if (!workflowState) {
    await failRun(db, run.id, "Workflow not found");
    return;
  }

  // Validate graph
  const validation = validateExecutableGraph(workflowState.currentGraph);
  if (!validation.valid) {
    await failRun(
      db,
      run.id,
      validation.errors.map((e) => e.message).join("; "),
    );
    return;
  }

  // Find entry point
  const triggerNode = workflowState.currentGraph.nodes.find(
    (n) => n.type === "webhook_trigger",
  );
  if (!triggerNode) {
    await failRun(db, run.id, "No webhook trigger node found");
    return;
  }

  const nodesById = new Map(
    workflowState.currentGraph.nodes.map((n) => [n.id, n]),
  );

  let ctx = createRunContext(run.inputPayload);
  let stepCount = 0;
  const queue: string[] = [triggerNode.id];

  while (queue.length > 0) {
    // Guard: step limit
    if (stepCount >= run.maxSteps) {
      await failRun(db, run.id, "run_limit_exceeded", stepCount);
      return;
    }

    // Guard: timeout
    if (Date.now() - startTime >= run.timeoutMs) {
      await failRun(db, run.id, "timeout_exceeded", stepCount);
      return;
    }

    const nodeId = queue.shift()!;
    const node = nodesById.get(nodeId);
    if (!node) continue;

    const executor = nodeExecutors[node.type];
    const stepStart = Date.now();

    const safeConfig =
      node.type === "http_request"
        ? redactHttpRequestConfig(node.config as HttpRequestNodeConfig)
        : node.config;

    const result = await executor({ config: node.config, context: ctx, db });
    const durationMs = Date.now() - stepStart;
    stepCount++;

    await writeStepRun(db, {
      runId: run.id,
      workspaceId: run.workspaceId,
      nodeId: node.id,
      nodeType: node.type,
      status: result.ok ? "succeeded" : "failed",
      inputJson: safeConfig,
      outputJson: result.ok ? result.output : null,
      errorJson: result.ok ? null : { error: result.error },
      durationMs,
      attempt: run.runAttempt,
    });

    if (!result.ok) {
      if (result.retryable && run.runAttempt < MAX_HTTP_RETRIES) {
        await scheduleRetry(db, run.id, getRetryDelayMs(run.runAttempt));
      } else {
        await failRun(db, run.id, result.error, stepCount);
      }
      return;
    }

    ctx = setNodeOutput(ctx, nodeId, result.output);

    const nextIds = getNextNodeIds(
      workflowState.currentGraph,
      nodeId,
      result.branch,
    );
    queue.push(...nextIds);
  }

  await succeedRun(db, run.id, stepCount);
}
