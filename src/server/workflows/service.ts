import type { WorkflowGraph } from "@/domain/workflows/types";

import type {
  WorkflowQueries,
  WorkflowRecord,
  WorkflowSummary,
} from "./queries";

export class WorkflowAccessError extends Error {
  readonly code = "workspace_access_denied";

  constructor() {
    super("User cannot access this workspace");
  }
}

export class WorkflowNotFoundError extends Error {
  readonly code = "workflow_not_found";

  constructor() {
    super("Workflow not found");
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

export type GetWorkflowInput = {
  userId: string;
  workflowId: string;
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

export async function getWorkflowForUser(
  input: GetWorkflowInput,
  queries?: WorkflowQueries,
): Promise<WorkflowRecord> {
  const workflowQueries = await getWorkflowQueries(queries);
  const workflow = await workflowQueries.findWorkflowWithGraphById(
    input.workflowId,
  );

  if (!workflow) {
    throw new WorkflowNotFoundError();
  }

  if (
    !(await workflowQueries.userCanAccessWorkspace(
      input.userId,
      workflow.workspaceId,
    ))
  ) {
    throw new WorkflowNotFoundError();
  }

  return workflow;
}
