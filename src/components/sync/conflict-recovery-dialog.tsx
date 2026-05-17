"use client";

import { useEffect, useState } from "react";

import type { FlowForgeDatabase } from "@/client/db/indexed-db";
import { downloadLocalCopy } from "@/client/sync/conflict-recovery";
import type { LocalEventQueue } from "@/client/sync/local-event-queue";
import type { WorkflowEvent } from "@/domain/workflows/events";

type DiffSummary = {
  nodesAdded: number;
  nodesDeleted: number;
  nodesMoved: number;
  nodesUpdated: number;
  edgesAdded: number;
  edgesDeleted: number;
};

function buildDiffSummary(events: WorkflowEvent[]): DiffSummary {
  const summary: DiffSummary = {
    nodesAdded: 0,
    nodesDeleted: 0,
    nodesMoved: 0,
    nodesUpdated: 0,
    edgesAdded: 0,
    edgesDeleted: 0,
  };

  for (const event of events) {
    switch (event.type) {
      case "node_added":
        summary.nodesAdded++;
        break;
      case "node_deleted":
        summary.nodesDeleted++;
        break;
      case "node_moved":
        summary.nodesMoved++;
        break;
      case "node_updated":
        summary.nodesUpdated++;
        break;
      case "edge_added":
        summary.edgesAdded++;
        break;
      case "edge_deleted":
        summary.edgesDeleted++;
        break;
    }
  }

  return summary;
}

function formatDiffSummary(summary: DiffSummary): string {
  const parts: string[] = [];
  if (summary.nodesAdded > 0)
    parts.push(
      `${summary.nodesAdded} node${summary.nodesAdded !== 1 ? "s" : ""} added`,
    );
  if (summary.nodesDeleted > 0)
    parts.push(
      `${summary.nodesDeleted} node${summary.nodesDeleted !== 1 ? "s" : ""} deleted`,
    );
  if (summary.nodesMoved > 0)
    parts.push(
      `${summary.nodesMoved} node${summary.nodesMoved !== 1 ? "s" : ""} moved`,
    );
  if (summary.nodesUpdated > 0)
    parts.push(
      `${summary.nodesUpdated} node${summary.nodesUpdated !== 1 ? "s" : ""} updated`,
    );
  if (summary.edgesAdded > 0)
    parts.push(
      `${summary.edgesAdded} edge${summary.edgesAdded !== 1 ? "s" : ""} added`,
    );
  if (summary.edgesDeleted > 0)
    parts.push(
      `${summary.edgesDeleted} edge${summary.edgesDeleted !== 1 ? "s" : ""} deleted`,
    );
  return parts.join(" · ") || "No graph changes";
}

type ConflictRecoveryDialogProps = {
  workflowId: string;
  db: FlowForgeDatabase;
  queue: LocalEventQueue;
  localRevision: number;
  onDismiss(): void;
  onDiscardConfirmed(): void;
};

export function ConflictRecoveryDialog({
  workflowId,
  db,
  queue,
  localRevision,
  onDismiss,
  onDiscardConfirmed,
}: ConflictRecoveryDialogProps) {
  const [pendingEvents, setPendingEvents] = useState<WorkflowEvent[]>([]);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  useEffect(() => {
    queue.getPendingEvents().then(setPendingEvents);
  }, [queue]);

  const diffSummary = buildDiffSummary(pendingEvents);
  const pendingCount = pendingEvents.length;

  return (
    <div role="dialog" aria-modal="true" aria-label="Conflict recovery">
      <h2>Sync conflict — unsaved local changes</h2>

      <dl>
        <dt>Local version</dt>
        <dd>revision {localRevision}</dd>
        <dt>Pending edits</dt>
        <dd>{pendingCount}</dd>
      </dl>

      {pendingCount > 0 && (
        <p aria-label="Diff summary">{formatDiffSummary(diffSummary)}</p>
      )}

      <button onClick={() => downloadLocalCopy(workflowId, db)} type="button">
        Download local copy
      </button>

      {!confirmingDiscard ? (
        <button onClick={() => setConfirmingDiscard(true)} type="button">
          Discard local changes and reload
        </button>
      ) : (
        <button onClick={onDiscardConfirmed} type="button">
          Are you sure? This will permanently discard {pendingCount} unsaved
          edit{pendingCount !== 1 ? "s" : ""}. Confirm discard
        </button>
      )}

      <button onClick={onDismiss} type="button">
        Cancel
      </button>
    </div>
  );
}
