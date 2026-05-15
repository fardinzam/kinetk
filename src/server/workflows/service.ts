import type { WorkflowGraph } from "@/domain/workflows/types";

import type { WorkflowQueries, WorkflowSummary } from "./queries";

export class WorkflowAccessError extends Error {
  readonly code = "workspace_access_denied";

  constructor() {
    super("User cannot access this workspace");
  }
}

export type CreateWorkflowInput = {
  userId: string;
  workspaceId: string;
  name: string;
};

export type ListWorkflowsInput = {
  userId: string;
  workspaceId: string;
};

export const emptyWorkflowGraph: WorkflowGraph = {
  nodes: [],
  edges: [],
  viewport: {
    x: 0,
    y: 0,
    zoom: 1,
  },
};

async function getWorkflowQueries(
  queries?: WorkflowQueries,
): Promise<WorkflowQueries> {
  if (queries) {
    return queries;
  }

  const workflowQueriesModule = await import("./queries");
  return workflowQueriesModule.createWorkflowQueries();
}

async function assertWorkspaceAccess(
  userId: string,
  workspaceId: string,
  queries: WorkflowQueries,
) {
  if (!(await queries.userCanAccessWorkspace(userId, workspaceId))) {
    throw new WorkflowAccessError();
  }
}

export async function createWorkflowForWorkspace(
  input: CreateWorkflowInput,
  queries?: WorkflowQueries,
): Promise<WorkflowSummary> {
  const workflowQueries = await getWorkflowQueries(queries);
  await assertWorkspaceAccess(input.userId, input.workspaceId, workflowQueries);

  return workflowQueries.createWorkflow({
    workspaceId: input.workspaceId,
    name: input.name.trim(),
    graph: emptyWorkflowGraph,
    schemaVersion: 1,
  });
}

export async function listWorkflowsForWorkspace(
  input: ListWorkflowsInput,
  queries?: WorkflowQueries,
): Promise<WorkflowSummary[]> {
  const workflowQueries = await getWorkflowQueries(queries);
  await assertWorkspaceAccess(input.userId, input.workspaceId, workflowQueries);

  return workflowQueries.listWorkflowsForWorkspace(input.workspaceId);
}
