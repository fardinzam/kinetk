import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/session";
import {
  getWorkflowForUser,
  WorkflowNotFoundError,
  WorkflowAccessError,
} from "@/server/workflows/service";
import { getEventsAfterRevision } from "@/server/sync/replay";

type EventsRouteContext = {
  params: Promise<{ workflowId: string }>;
};

export async function GET(request: Request, context: EventsRouteContext) {
  const user = await requireUser();
  const { workflowId } = await context.params;
  const url = new URL(request.url);
  const afterRevision = Number(url.searchParams.get("afterRevision") ?? "0");

  if (!Number.isInteger(afterRevision) || afterRevision < 0) {
    return NextResponse.json(
      { error: "afterRevision must be a non-negative integer" },
      { status: 400 },
    );
  }

  try {
    const workflow = await getWorkflowForUser({ userId: user.id, workflowId });
    const result = await getEventsAfterRevision(
      workflow.workspaceId,
      workflowId,
      afterRevision,
    );

    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof WorkflowAccessError ||
      error instanceof WorkflowNotFoundError
    ) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 },
      );
    }

    throw error;
  }
}
