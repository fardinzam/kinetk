import { loadSnapshot } from "@/client/db/workflow-store";
import { getPendingEvents } from "@/client/db/pending-event-store";
import type { FlowForgeDatabase } from "@/client/db/indexed-db";

export async function downloadLocalCopy(
  workflowId: string,
  db: FlowForgeDatabase,
): Promise<void> {
  const snapshot = await loadSnapshot(db, workflowId);
  const pendingEvents = await getPendingEvents(db, workflowId);

  const payload = JSON.stringify(
    { workflowId, snapshot, pendingEvents },
    null,
    2,
  );
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `workflow-${workflowId}-local-copy.json`;
  anchor.click();

  URL.revokeObjectURL(url);
}
