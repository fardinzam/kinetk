"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { clearPendingEvents, addPendingEvent, getPendingEvents } from "@/client/db/pending-event-store";
import { deleteSnapshot, loadSnapshot, saveSnapshot } from "@/client/db/workflow-store";
import { openFlowForgeDB, type FlowForgeDatabase } from "@/client/db/indexed-db";
import { getSyncMetadata, setSyncMetadata } from "@/client/db/sync-metadata-store";
import {
  createLocalEventQueue,
  type LocalEventQueue,
} from "@/client/sync/local-event-queue";
import type { SyncStatus } from "@/client/sync/sync-status";
import { syncPendingEvents } from "@/client/sync/sync-engine";
import {
  subscribeToWorkflow,
  type WorkflowSubscription,
} from "@/client/realtime/workflow-subscription";
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

type NodeStepStatus = { status: string; errorJson?: unknown };

type Props = {
  workflowId: string;
  workflowName: string;
  workspaceId: string;
  serverGraph: WorkflowGraph;
  nodeStatusMap?: ReadonlyMap<string, NodeStepStatus>;
};

export function WorkflowEditorWithPersistence({ workflowId, workflowName, workspaceId, serverGraph, nodeStatusMap }: Props) {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [initialGraph, setInitialGraph] = useState<WorkflowGraph>(EMPTY_GRAPH);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("saved_locally");
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [localRevision, setLocalRevision] = useState(0);
  const [remountKey, setRemountKey] = useState(0);
  // db and queue stored in state for safe JSX access; refs used in callbacks
  const [dbState, setDbState] = useState<FlowForgeDatabase | null>(null);
  const [queueState, setQueueState] = useState<LocalEventQueue | null>(null);

  const dbRef = useRef<FlowForgeDatabase | null>(null);
  const queueRef = useRef<LocalEventQueue | null>(null);
  const graphRef = useRef<WorkflowGraph>(EMPTY_GRAPH);
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverGraphRef = useRef(serverGraph);
  const subRef = useRef<WorkflowSubscription | null>(null);

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

      const currentRevision = metadata?.serverRevision ?? 0;

      // Prefer the local IndexedDB snapshot (always current after edits).
      // Fall back to the server graph so other browsers see synced state.
      const graph = snapshot ?? serverGraphRef.current;
      graphRef.current = graph;
      setInitialGraph(graph);
      setLocalRevision(currentRevision);
      setIsLoaded(true);

      // Open realtime subscription for remote edits and run updates
      subRef.current = subscribeToWorkflow(workflowId, currentRevision, {
        onWorkflowEvents: async (events, latestRevision) => {
          const currentQueue = queueRef.current;
          const currentDb = dbRef.current;
          if (!currentDb) return;

          // Skip remote events if there are pending local edits
          // (local state is source of truth until synced)
          const pending = currentQueue ? await currentQueue.getPendingEvents() : [];
          if (pending.length > 0) return;

          let graph = graphRef.current;
          for (const event of events) {
            graph = applyWorkflowEvent({ name: workflowName, graph }, event).graph;
          }
          graphRef.current = graph;
          await saveSnapshot(currentDb, workflowId, graph);
          await setSyncMetadata(currentDb, workflowId, latestRevision);
          setInitialGraph(graph);
          setRemountKey((k) => k + 1);
        },
        onRunsUpdated: () => {
          router.refresh();
        },
        onSnapshotRequired: () => {
          setSyncStatus("refresh_required");
        },
      });
    }

    init();

    return () => {
      cancelled = true;
      subRef.current?.disconnect();
      subRef.current = null;
    };
  }, [workflowId, workflowName]); // eslint-disable-line react-hooks/exhaustive-deps

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
        key={remountKey}
        initialGraph={initialGraph}
        workspaceId={workspaceId}
        nodeStatusMap={nodeStatusMap}
        onLocalEvent={handleLocalEvent}
      />
    </section>
  );
}
