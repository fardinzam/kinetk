import { notFound } from "next/navigation";

import { RunHistoryList } from "@/components/runs/run-history-list";
import { WorkflowHeader } from "@/components/workflows/workflow-header";
import { WorkflowEditorWithPersistence } from "@/components/workflows/workflow-editor-with-persistence";
import { TriggerUrlPanel } from "@/components/workflows/trigger-url-panel";
import { requireUser } from "@/server/auth/session";
import { createRunQueries } from "@/server/runs/queries";
import {
  getWorkflowForUser,
  WorkflowNotFoundError,
} from "@/server/workflows/service";

type WorkflowDetailPageProps = {
  params: Promise<{ workflowId: string }>;
  searchParams: Promise<{ runId?: string }>;
};

async function getWorkflowOrNotFound(userId: string, workflowId: string) {
  try {
    return await getWorkflowForUser({ userId, workflowId });
  } catch (error) {
    if (error instanceof WorkflowNotFoundError) notFound();
    throw error;
  }
}

export default async function WorkflowDetailPage({
  params,
  searchParams,
}: WorkflowDetailPageProps) {
  const user = await requireUser();
  const { workflowId } = await params;
  const { runId } = await searchParams;
  const workflow = await getWorkflowOrNotFound(user.id, workflowId);

  // Build nodeStatusMap when viewing a specific run overlay
  let nodeStatusMap:
    | ReadonlyMap<string, { status: string; errorJson?: unknown }>
    | undefined;
  if (runId) {
    const q = createRunQueries();
    const canAccess = await q.userCanAccessWorkspace(
      user.id,
      workflow.workspaceId,
    );
    if (canAccess) {
      const steps = await q.findStepsByRunId(runId, workflow.workspaceId);
      nodeStatusMap = new Map(
        steps.map((s) => [
          s.nodeId,
          { status: s.status, errorJson: s.errorJson },
        ]),
      );
    }
  }

  return (
    <section>
      <WorkflowHeader workflow={workflow} />
      <TriggerUrlPanel workflowId={workflowId} />
      <WorkflowEditorWithPersistence
        workflowId={workflowId}
        workflowName={workflow.name}
        workspaceId={workflow.workspaceId}
        userId={user.id}
        displayName={user.user_metadata?.name ?? user.email}
        serverGraph={workflow.graph}
        serverRevision={workflow.version}
        nodeStatusMap={nodeStatusMap}
      />
      <RunHistoryList workflowId={workflowId} />
    </section>
  );
}
