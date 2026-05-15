import "server-only";

import { migrateWorkflowEvent } from "@/domain/workflows/migrations";
import { workflowEventSchema } from "@/domain/workflows/events";
import type { Queryable } from "@/server/db/pool";
import { getPool } from "@/server/db/pool";

import type { CommittedEvent } from "./events";

const REPLAY_LIMIT = 1000;

export type ReplayResult =
  | { type: "events"; events: CommittedEvent[]; latestRevision: number }
  | { type: "snapshot_required" };

export async function getEventsAfterRevision(
  workspaceId: string,
  workflowId: string,
  afterRevision: number,
  db: Queryable = getPool(),
): Promise<ReplayResult> {
  const result = await db.query<{
    client_event_id: string;
    server_revision: number;
    event_type: string;
    event_schema_version: number;
    payload: unknown;
    created_at: string;
  }>(
    `
      select client_event_id, server_revision, event_type,
             event_schema_version, payload, created_at
      from public.workflow_events
      where workspace_id = $1
        and workflow_id = $2
        and server_revision > $3
      order by server_revision
      limit $4
    `,
    [workspaceId, workflowId, afterRevision, REPLAY_LIMIT + 1],
  );

  if (result.rows.length > REPLAY_LIMIT) {
    return { type: "snapshot_required" };
  }

  const events: CommittedEvent[] = result.rows.map((row) => {
    const raw = {
      clientEventId: row.client_event_id,
      type: row.event_type,
      eventSchemaVersion: row.event_schema_version,
      payload: row.payload,
      createdAt: row.created_at,
    };

    const parsed = workflowEventSchema.parse(migrateWorkflowEvent(raw as Parameters<typeof migrateWorkflowEvent>[0]));
    return { ...parsed, serverRevision: row.server_revision };
  });

  const latestRevision =
    events.length > 0 ? events[events.length - 1]!.serverRevision : afterRevision;

  return { type: "events", events, latestRevision };
}
