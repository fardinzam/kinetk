import { migrateWorkflowEvent } from "@/domain/workflows/migrations";
import { applyWorkflowEvent } from "@/domain/workflows/reducer";
import type { WorkflowGraph } from "@/domain/workflows/types";

export type ReplayEngineResult =
  | { type: "ok"; graph: WorkflowGraph; latestRevision: number }
  | { type: "snapshot_required" };

export async function replayMissedEvents(
  workflowId: string,
  afterRevision: number,
  currentGraph: WorkflowGraph,
  workflowName: string,
): Promise<ReplayEngineResult> {
  let response: Response;
  try {
    response = await fetch(
      `/api/workflows/${workflowId}/events?afterRevision=${afterRevision}`,
    );
  } catch {
    return { type: "snapshot_required" };
  }

  if (!response.ok) {
    return { type: "snapshot_required" };
  }

  const result = (await response.json()) as
    | { type: "snapshot_required" }
    | {
        type: "events";
        events: Array<Record<string, unknown>>;
        latestRevision: number;
      };

  if (result.type === "snapshot_required") {
    return { type: "snapshot_required" };
  }

  let graph = currentGraph;
  for (const rawEvent of result.events) {
    const migrated = migrateWorkflowEvent(
      rawEvent as Parameters<typeof migrateWorkflowEvent>[0],
    );
    graph = applyWorkflowEvent({ name: workflowName, graph }, migrated).graph;
  }

  return { type: "ok", graph, latestRevision: result.latestRevision };
}
