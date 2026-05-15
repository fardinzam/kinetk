import "server-only";

import type { WorkflowEvent } from "@/domain/workflows/events";
import { migrateWorkflowEvent } from "@/domain/workflows/migrations";
import { applyWorkflowEvent } from "@/domain/workflows/reducer";
import { withTransaction } from "@/server/db/pool";
import { createWorkflowQueries } from "@/server/workflows/queries";

import {
  findExistingRevisions,
  insertWorkflowEvents,
  type CommittedEvent,
} from "./events";
import {
  claimRevisions,
  fetchWorkflowSyncState,
  updateWorkflowGraph,
} from "./revisions";

export type { CommittedEvent };

export type SyncInput = {
  userId: string;
  workflowId: string;
  baseServerRevision: number;
  events: WorkflowEvent[];
};

export type SyncOutput = {
  committedEvents: CommittedEvent[];
  latestRevision: number;
};

export class WorkflowSyncError extends Error {}
export class SyncAccessError extends WorkflowSyncError {}
export class WorkflowNotFoundForSyncError extends WorkflowSyncError {}

export async function syncWorkflowEvents(
  input: SyncInput,
): Promise<SyncOutput> {
  return withTransaction(async (txDb) => {
    const workflowQueries = createWorkflowQueries(txDb);

    const syncState = await fetchWorkflowSyncState(txDb, input.workflowId);
    if (!syncState) {
      throw new WorkflowNotFoundForSyncError(
        `Workflow ${input.workflowId} not found`,
      );
    }

    const canAccess = await workflowQueries.userCanAccessWorkspace(
      input.userId,
      syncState.workspaceId,
    );
    if (!canAccess) {
      throw new SyncAccessError(
        `User ${input.userId} cannot access workflow ${input.workflowId}`,
      );
    }

    const clientEventIds = input.events.map((e) => e.clientEventId);
    const existingRevisions = await findExistingRevisions(
      txDb,
      input.workflowId,
      clientEventIds,
    );

    const newEvents = input.events.filter(
      (e) => !existingRevisions.has(e.clientEventId),
    );

    let baseRevision = syncState.currentVersion;

    if (newEvents.length > 0) {
      baseRevision = await claimRevisions(txDb, input.workflowId, newEvents.length);

      await insertWorkflowEvents(txDb, {
        workflowId: input.workflowId,
        workspaceId: syncState.workspaceId,
        actorUserId: input.userId,
        events: newEvents.map((event, i) => ({
          event,
          serverRevision: baseRevision + i + 1,
        })),
      });

      let { currentGraph } = syncState;
      for (const event of newEvents) {
        const migrated = migrateWorkflowEvent(event);
        currentGraph = applyWorkflowEvent(
          { name: syncState.name, graph: currentGraph },
          migrated,
        ).graph;
      }

      await updateWorkflowGraph(txDb, input.workflowId, currentGraph);
    }

    const committedEvents: CommittedEvent[] = input.events.map((event) => {
      const serverRevision =
        existingRevisions.get(event.clientEventId) ??
        baseRevision + newEvents.indexOf(event) + 1;
      return { ...event, serverRevision };
    });

    const latestRevision =
      committedEvents.length > 0
        ? Math.max(...committedEvents.map((e) => e.serverRevision))
        : syncState.currentVersion;

    return { committedEvents, latestRevision };
  });
}
