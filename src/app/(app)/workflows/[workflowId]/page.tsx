import { notFound } from "next/navigation";

import { WorkflowEditor } from "@/components/editor/workflow-editor";
import { WorkflowHeader } from "@/components/workflows/workflow-header";
import { requireUser } from "@/server/auth/session";
import {
  emptyWorkflowGraph,
  getWorkflowForUser,
  WorkflowNotFoundError,
} from "@/server/workflows/service";

type WorkflowDetailPageProps = {
  params: Promise<{
    workflowId: string;
  }>;
};

async function getWorkflowOrNotFound(userId: string, workflowId: string) {
  try {
    return await getWorkflowForUser({
      userId,
      workflowId,
    });
  } catch (error) {
    if (error instanceof WorkflowNotFoundError) {
      notFound();
    }

    throw error;
  }
}

export default async function WorkflowDetailPage({
  params,
}: WorkflowDetailPageProps) {
  const user = await requireUser();
  const { workflowId } = await params;
  const workflow = await getWorkflowOrNotFound(user.id, workflowId);

  return (
    <section>
      <WorkflowHeader workflow={workflow} />
      <WorkflowEditor initialGraph={emptyWorkflowGraph} />
    </section>
  );
}
