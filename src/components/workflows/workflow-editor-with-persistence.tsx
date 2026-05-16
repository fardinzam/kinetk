"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { clearPendingEvents, addPendingEvent, getPendingEvents } from "@/client/db/pending-event-store";
import { deleteSnapshot, loadSnapshot, saveSnapshot } from "@/client/db/workflow-store";
import { openFlowForgeDB, type FlowForgeDatabase } from "@/client/db/indexed-db";
import { getSyncMetadata } from "@/client/db/sync-metadata-store";
import {
  createLocalEventQueue,
  type LocalEventQueue,
} from "@/client/sync/local-event-queue";
import type { SyncStatus } from "@/client/sync/sync-status";
import { syncPendingEvents } from "@/client/sync/sync-engine";
import type { WorkflowEvent } from "@/domain/workflows/events";
import { applyWorkflowEvent } from "@/domain/workflows/reducer";
import type { WorkflowGraph } from "@/domain/workflows/types";

import { ConflictRecoveryDialog } from "../sync/conflict-recovery-dialog";
import { RefreshRequiredBanner } from "../sync/refresh-required-banner";
import { WorkflowEditor } from "../editor/workflow-editor";

const EMPTY_GRAPH: WorkflowGraph = {
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

type Props = {
  workflowId: string;
  workflowName: string;
  workspaceId: string;
  serverGraph: WorkflowGraph;
};

export function WorkflowEditorWithPersistence({ workflowId, workflowName, workspaceId, serverGraph }: Props) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [initialGraph, setInitialGraph] = useState<WorkflowGraph>(EMPTY_GRAPH);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("saved_locally");
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [localRevision, setLocalRevision] = useState(0);
  // db and queue stored in state for safe JSX access; refs used in callbacks
  const [dbState, setDbState] = useState<FlowForgeDatabase | null>(null);
  const [queueState, setQueueState] = useState<LocalEventQueue | null>(null);

  const dbRef = useRef<FlowForgeDatabase | null>(null);
  const queueRef = useRef<LocalEventQueue | null>(null);
  const graphRef = useRef<WorkflowGraph>(EMPTY_GRAPH);
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverGraphRef = useRef(serverGraph);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const db = await openFlowForgeDB();
      if (cancelled) return;

      dbRef.current = db;
      setDbState(db);
      const queue = createLocalEventQueue(workflowId, {
        add: (wfId, event) => addPendingEvent(db, wfId, event),
        getAll: (wfId) => getPendingEvents(db, wfId),
        remove: async (wfId, clientEventId) => {
          const { removePendingEvent } = await import(
            "@/client/db/pending-event-store"
          );
          await removePendingEvent(db, wfId, clientEventId);
        },
      });
      queueRef.current = queue;
      setQueueState(queue);

      const [snapshot, metadata] = await Promise.all([
        loadSnapshot(db, workflowId),
        getSyncMetadata(db, workflowId),
      ]);

      if (cancelled) return;

      // Prefer the local IndexedDB snapshot (always current after edits).
      // Fall back to the server graph so other browsers see synced state.
      const graph = snapshot ?? serverGraphRef.current;
      graphRef.current = graph;
      setInitialGraph(graph);
      setLocalRevision(metadata?.serverRevision ?? 0);
      setIsLoaded(true);
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [workflowId, workflowName]);

  const handleLocalEvent = useCallback(
    async (event: WorkflowEvent) => {
      const db = dbRef.current;
      const queue = queueRef.current;
      if (!db || !queue) return;

      await queue.enqueue(event);

      const newGraph = applyWorkflowEvent(
        { name: workflowName, graph: graphRef.current },
        event,
      ).graph;
      graphRef.current = newGraph;

      await saveSnapshot(db, workflowId, newGraph);
      setSyncStatus("saved_locally");

      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
      syncDebounceRef.current = setTimeout(() => {
        setSyncStatus("syncing");
        syncPendingEvents({
          workflowId,
          db,
          queue,
          onStatusChange: setSyncStatus,
        });
      }, 500);
    },
    [workflowId, workflowName],
  );

  async function handleDiscardAndReload() {
    const db = dbRef.current;
    if (!db) return;
    await clearPendingEvents(db, workflowId);
    await deleteSnapshot(db, workflowId);
    window.location.reload();
  }

  if (!isLoaded) {
    return <p>Loading editor...</p>;
  }

  return (
    <section>
      <p>Status: {syncStatus}</p>
      {syncStatus === "refresh_required" && (
        <RefreshRequiredBanner onResolve={() => setShowRecoveryDialog(true)} />
      )}
      {showRecoveryDialog && dbState && queueState && (
        <ConflictRecoveryDialog
          workflowId={workflowId}
          db={dbState}
          queue={queueState}
          localRevision={localRevision}
          onDismiss={() => setShowRecoveryDialog(false)}
          onDiscardConfirmed={handleDiscardAndReload}
        />
      )}
      <WorkflowEditor
        initialGraph={initialGraph}
        workspaceId={workspaceId}
        onLocalEvent={handleLocalEvent}
      />
    </section>
  );
}
