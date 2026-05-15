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
};

export function WorkflowEditorWithPersistence({ workflowId, workflowName }: Props) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [initialGraph, setInitialGraph] = useState<WorkflowGraph>(EMPTY_GRAPH);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("saved_locally");

  const dbRef = useRef<FlowForgeDatabase | null>(null);
  const queueRef = useRef<LocalEventQueue | null>(null);
  const graphRef = useRef<WorkflowGraph>(EMPTY_GRAPH);

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

      const snapshot = await loadSnapshot(db, workflowId);
      const pending = await queueRef.current.getPendingEvents();

      let graph = snapshot ?? EMPTY_GRAPH;
      for (const event of pending) {
        graph = applyWorkflowEvent({ name: workflowName, graph }, event).graph;
      }

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
