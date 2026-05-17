import { workflowEventSchema } from "./events";
import type { WorkflowEvent } from "./events";
import { workflowGraphSchema } from "./schemas";
import type { WorkflowGraph } from "./types";

export class UnsupportedWorkflowSchemaVersionError extends Error {
  readonly code = "snapshot_required";

  constructor(
    readonly version: number,
    readonly subject: "event" | "snapshot",
  ) {
    super(`Unsupported workflow ${subject} schema version: ${version}`);
    this.name = "UnsupportedWorkflowSchemaVersionError";
  }
}

type VersionedWorkflowEvent = Omit<WorkflowEvent, "eventSchemaVersion"> & {
  eventSchemaVersion: number;
};

export function migrateWorkflowEvent(
  event: VersionedWorkflowEvent,
): WorkflowEvent {
  if (event.eventSchemaVersion !== 1) {
    throw new UnsupportedWorkflowSchemaVersionError(
      event.eventSchemaVersion,
      "event",
    );
  }

  return workflowEventSchema.parse(event);
}

export function migrateWorkflowSnapshot(input: {
  schemaVersion: number;
  graph: unknown;
}): WorkflowGraph {
  if (input.schemaVersion !== 1) {
    throw new UnsupportedWorkflowSchemaVersionError(
      input.schemaVersion,
      "snapshot",
    );
  }

  return workflowGraphSchema.parse(input.graph);
}
