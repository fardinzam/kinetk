import { describe, expect, it } from "vitest";

import {
  createWorkflowForWorkspace,
  getWorkflowForUser,
  listWorkflowsForWorkspace,
} from "./service";
import type {
  CreateWorkflowRecord,
  WorkflowQueries,
  WorkflowRecord,
  WorkflowSummary,
} from "./queries";

const EMPTY_GRAPH = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };

function createWorkflowQueries(): WorkflowQueries & {
  workflows: WorkflowSummary[];
  addMembership(userId: string, workspaceId: string): void;
} {
  const memberships = new Map<string, Set<string>>();
  const workflows: WorkflowSummary[] = [];

  function membershipKey(workspaceId: string) {
    return workspaceId;
  }

  return {
    workflows,
    addMembership(userId: string, workspaceId: string) {
      const key = membershipKey(workspaceId);
      const members = memberships.get(key) ?? new Set<string>();
      members.add(userId);
      memberships.set(key, members);
    },
    async userCanAccessWorkspace(userId, workspaceId) {
      return memberships.get(membershipKey(workspaceId))?.has(userId) ?? false;
    },
    async createWorkflow(input: CreateWorkflowRecord) {
      const workflow = {
        id: `workflow_${workflows.length + 1}`,
        workspaceId: input.workspaceId,
        name: input.name,
        schemaVersion: input.schemaVersion,
        version: 0,
        createdAt: new Date("2026-05-15T00:00:00.000Z"),
        updatedAt: new Date("2026-05-15T00:00:00.000Z"),
      };
      workflows.push(workflow);
      return workflow;
    },
    async listWorkflowsForWorkspace(workspaceId) {
      return workflows.filter(
        (workflow) => workflow.workspaceId === workspaceId,
      );
    },
    async findWorkflowById(workflowId) {
      return workflows.find((workflow) => workflow.id === workflowId) ?? null;
    },
    async findWorkflowWithGraphById(
      workflowId,
    ): Promise<WorkflowRecord | null> {
      const workflow = workflows.find((w) => w.id === workflowId);
      if (!workflow) return null;
      return { ...workflow, graph: EMPTY_GRAPH };
    },
  };
}

describe("workflow service", () => {
  it("creates a workflow for a workspace member with an empty v1 graph", async () => {
    const queries = createWorkflowQueries();
    queries.addMembership("user_1", "workspace_1");

    const workflow = await createWorkflowForWorkspace(
      {
        userId: "user_1",
        workspaceId: "workspace_1",
        name: "Webhook intake",
      },
      queries,
    );

    expect(workflow).toMatchObject({
      id: "workflow_1",
      workspaceId: "workspace_1",
      name: "Webhook intake",
      schemaVersion: 1,
      version: 0,
    });
    expect(queries.workflows).toHaveLength(1);
  });

  it("rejects workflow creation for a non-member", async () => {
    const queries = createWorkflowQueries();

    await expect(
      createWorkflowForWorkspace(
        {
          userId: "outsider",
          workspaceId: "workspace_1",
          name: "Webhook intake",
        },
        queries,
      ),
    ).rejects.toMatchObject({ code: "workspace_access_denied" });
    expect(queries.workflows).toHaveLength(0);
  });

  it("lists only workflows from a workspace the user can access", async () => {
    const queries = createWorkflowQueries();
    queries.addMembership("user_1", "workspace_1");
    queries.addMembership("user_2", "workspace_2");

    await createWorkflowForWorkspace(
      { userId: "user_1", workspaceId: "workspace_1", name: "Owned workflow" },
      queries,
    );
    await createWorkflowForWorkspace(
      { userId: "user_2", workspaceId: "workspace_2", name: "Other workflow" },
      queries,
    );

    await expect(
      listWorkflowsForWorkspace(
        { userId: "user_1", workspaceId: "workspace_1" },
        queries,
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "workflow_1",
        name: "Owned workflow",
      }),
    ]);
  });

  it("loads a workflow when the user belongs to its workspace", async () => {
    const queries = createWorkflowQueries();
    queries.addMembership("user_1", "workspace_1");
    const workflow = await createWorkflowForWorkspace(
      { userId: "user_1", workspaceId: "workspace_1", name: "Owned workflow" },
      queries,
    );

    await expect(
      getWorkflowForUser(
        { userId: "user_1", workflowId: workflow.id },
        queries,
      ),
    ).resolves.toMatchObject({
      id: workflow.id,
      workspaceId: "workspace_1",
      name: "Owned workflow",
    });
  });

  it("hides workflows from non-members", async () => {
    const queries = createWorkflowQueries();
    queries.addMembership("owner", "workspace_1");
    const workflow = await createWorkflowForWorkspace(
      { userId: "owner", workspaceId: "workspace_1", name: "Private workflow" },
      queries,
    );

    await expect(
      getWorkflowForUser(
        { userId: "outsider", workflowId: workflow.id },
        queries,
      ),
    ).rejects.toMatchObject({ code: "workflow_not_found" });
  });
});
