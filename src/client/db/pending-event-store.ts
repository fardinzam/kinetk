import type { WorkflowEvent } from "@/domain/workflows/events";

import type { FlowForgeDatabase } from "./indexed-db";

export async function addPendingEvent(
  db: FlowForgeDatabase,
  workflowId: string,
  event: WorkflowEvent,
): Promise<void> {
  await db.add("pending_events", { workflowId, event });
}

export async function getPendingEvents(
  db: FlowForgeDatabase,
  workflowId: string,
): Promise<WorkflowEvent[]> {
  const records = await db.getAllFromIndex(
    "pending_events",
    "by_workflow",
    workflowId,
  );
  return records.map((r) => r.event);
}

export async function removePendingEvent(
  db: FlowForgeDatabase,
  workflowId: string,
  clientEventId: string,
): Promise<void> {
  const tx = db.transaction("pending_events", "readwrite");
  let cursor = await tx.store.index("by_workflow").openCursor(workflowId);

  while (cursor) {
    if (cursor.value.event.clientEventId === clientEventId) {
      await cursor.delete();
      break;
    }
    cursor = await cursor.continue();
  }

  await tx.done;
}

export async function clearPendingEvents(
  db: FlowForgeDatabase,
  workflowId: string,
): Promise<void> {
  const tx = db.transaction("pending_events", "readwrite");
  let cursor = await tx.store.index("by_workflow").openCursor(workflowId);

  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  await tx.done;
}
