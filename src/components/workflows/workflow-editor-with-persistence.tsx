"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { addPendingEvent, getPendingEvents } from "@/client/db/pending-event-store";
import { loadSnapshot, saveSnapshot } from "@/client/db/workflow-store";
import { openFlowForgeDB, type FlowForgeDatabase } from "@/client/db/indexed-db";
import {
  createLocalEventQueue,
  type LocalEventQueue,
} from "@/client/sync/local-event-queue";
import type { SyncStatus } from "@/client/sync/sync-status";
import { syncPendingEvents } from "@/client/sync/sync-engine";
import type { WorkflowEvent } from "@/domain/workflows/events";
import { applyWorkflowEvent } from "@/domain/workflows/reducer";
import type { WorkflowGraph } from "@/domain/workflows/types";

import { WorkflowEditor } from "../editor/workflow-editor";

const EMPTY_GRAPH: WorkflowGraph = {
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

type Props = {
  workflowId: string;
  workflowName: string;
  serverGraph: WorkflowGraph;
};

export function WorkflowEditorWithPersistence({ workflowId, workflowName, serverGraph }: Props) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [initialGraph, setInitialGraph] = useState<WorkflowGraph>(EMPTY_GRAPH);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("saved_locally");

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
      queueRef.current = createLocalEventQueue(workflowId, {
        add: (wfId, event) => addPendingEvent(db, wfId, event),
        getAll: (wfId) => getPendingEvents(db, wfId),
        remove: async (wfId, clientEventId) => {
          const { removePendingEvent } = await import(
            "@/client/db/pending-event-store"
          );
          await removePendingEvent(db, wfId, clientEventId);
        },
      });

      // Prefer the local IndexedDB snapshot (always current after edits).
      // Fall back to the server graph so other browsers see synced state.
      const graph = (await loadSnapshot(db, workflowId)) ?? serverGraphRef.current;

      if (cancelled) return;

      graphRef.current = graph;
      setInitialGraph(graph);
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

  if (!isLoaded) {
    return <p>Loading editor...</p>;
  }

  return (
    <section>
      <p>Status: {syncStatus}</p>
      <WorkflowEditor
        initialGraph={initialGraph}
        onLocalEvent={handleLocalEvent}
      />
    </section>
  );
}
