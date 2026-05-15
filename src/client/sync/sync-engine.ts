import { getSyncMetadata, setSyncMetadata } from "@/client/db/sync-metadata-store";
import type { FlowForgeDatabase } from "@/client/db/indexed-db";
import type { LocalEventQueue } from "./local-event-queue";
import type { SyncStatus } from "./sync-status";

export type SyncEngineOptions = {
  workflowId: string;
  db: FlowForgeDatabase;
  queue: LocalEventQueue;
  onStatusChange(status: SyncStatus): void;
};

export async function syncPendingEvents(options: SyncEngineOptions): Promise<void> {
  const { workflowId, db, queue, onStatusChange } = options;

  const events = await queue.getPendingEvents();
  if (events.length === 0) return;

  const metadata = await getSyncMetadata(db, workflowId);
  const baseServerRevision = metadata?.serverRevision ?? 0;

  let response: Response;
  try {
    response = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId, baseServerRevision, events }),
    });
  } catch {
    onStatusChange("reconnect_needed");
    return;
  }

  if (!response.ok) {
    onStatusChange("refresh_required");
    return;
  }

  const result = (await response.json()) as {
    committedEvents: Array<{ clientEventId: string; serverRevision: number }>;
    latestRevision: number;
  };

  for (const committed of result.committedEvents) {
    await queue.markCommitted(committed.clientEventId);
  }

  await setSyncMetadata(db, workflowId, result.latestRevision);
  onStatusChange("synced");
}
