import { CreateWorkflowDialog } from "@/components/workflows/create-workflow-dialog";
import { WorkflowList } from "@/components/workflows/workflow-list";
import { requireUser } from "@/server/auth/session";
import { listWorkflowsForWorkspace } from "@/server/workflows/service";
import { listWorkspacesForUser } from "@/server/workspaces/service";

export default async function WorkflowsPage() {
  const user = await requireUser();
  const workspaces = await listWorkspacesForUser(user.id);
  const activeWorkspace = workspaces[0];
  const workflows = activeWorkspace
    ? await listWorkflowsForWorkspace({
        userId: user.id,
        workspaceId: activeWorkspace.id,
      })
    : [];

  return (
    <section>
      <header>
        <h1>Workflows</h1>
        {activeWorkspace ? (
          <CreateWorkflowDialog workspaceId={activeWorkspace.id} />
        ) : null}
      </header>
      <WorkflowList workflows={workflows} />
    </section>
  );
}
