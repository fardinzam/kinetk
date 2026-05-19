import { cookies } from "next/headers";

import { CreateWorkflowDialog } from "@/components/workflows/create-workflow-dialog";
import { WorkflowList } from "@/components/workflows/workflow-list";
import { requireUser } from "@/server/auth/session";
import { listWorkflowsForWorkspace } from "@/server/workflows/service";
import { getActiveWorkspaceForUser } from "@/server/workspaces/service";

export default async function WorkflowsPage() {
  const user = await requireUser();
  const cookieStore = await cookies();
  const activeWorkspaceId =
    cookieStore.get("active_workspace_id")?.value ?? undefined;

  const activeWorkspace = await getActiveWorkspaceForUser(
    { id: user.id, email: user.email, name: user.user_metadata?.name },
    activeWorkspaceId,
  );

  const workflows = await listWorkflowsForWorkspace({
    userId: user.id,
    workspaceId: activeWorkspace.id,
  });

  return (
    <section>
      <header>
        <h1>Workflows</h1>
        <CreateWorkflowDialog workspaceId={activeWorkspace.id} />
      </header>
      <WorkflowList workflows={workflows} />
    </section>
  );
}
