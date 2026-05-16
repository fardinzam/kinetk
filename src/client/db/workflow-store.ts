import type { WorkflowGraph } from "@/domain/workflows/types";

import type { FlowForgeDatabase } from "./indexed-db";

export async function saveSnapshot(
  db: FlowForgeDatabase,
  workflowId: string,
  graph: WorkflowGraph,
): Promise<void> {
  await db.put("workflow_snapshots", {
    workflowId,
    graph,
    savedAt: new Date().toISOString(),
  });
}

export async function loadSnapshot(
  db: FlowForgeDatabase,
  workflowId: string,
): Promise<WorkflowGraph | null> {
  const record = await db.get("workflow_snapshots", workflowId);
  return record?.graph ?? null;
}

export async function deleteSnapshot(
  db: FlowForgeDatabase,
  workflowId: string,
): Promise<void> {
  await db.delete("workflow_snapshots", workflowId);
}
