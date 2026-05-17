import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/server/auth/session";
import {
  getWorkflowForUser,
  WorkflowNotFoundError,
  WorkflowAccessError,
} from "@/server/workflows/service";
import {
  createTrigger,
  disableTrigger,
  getTriggerForWorkflow,
  rotateTrigger,
  TriggerAccessError,
  TriggerNotFoundError,
} from "@/server/triggers/service";

type TriggerRouteContext = {
  params: Promise<{ workflowId: string }>;
};

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rotate") }),
  z.object({ action: z.literal("disable") }),
]);

function handleTriggerError(error: unknown) {
  if (
    error instanceof TriggerAccessError ||
    error instanceof WorkflowAccessError
  ) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  if (
    error instanceof TriggerNotFoundError ||
    error instanceof WorkflowNotFoundError
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  throw error;
}

export async function GET(_request: Request, context: TriggerRouteContext) {
  const user = await requireUser();
  const { workflowId } = await context.params;

  try {
    const workflow = await getWorkflowForUser({ userId: user.id, workflowId });
    const trigger = await getTriggerForWorkflow({
      userId: user.id,
      workflowId,
      workspaceId: workflow.workspaceId,
    });
    return NextResponse.json({ trigger });
  } catch (error) {
    return handleTriggerError(error);
  }
}

export async function POST(_request: Request, context: TriggerRouteContext) {
  const user = await requireUser();
  const { workflowId } = await context.params;

  try {
    const workflow = await getWorkflowForUser({ userId: user.id, workflowId });
    const result = await createTrigger({
      userId: user.id,
      workflowId,
      workspaceId: workflow.workspaceId,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleTriggerError(error);
  }
}

export async function PATCH(request: Request, context: TriggerRouteContext) {
  const user = await requireUser();
  const { workflowId } = await context.params;
  const parsed = patchSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const workflow = await getWorkflowForUser({ userId: user.id, workflowId });
    const trigger = await getTriggerForWorkflow({
      userId: user.id,
      workflowId,
      workspaceId: workflow.workspaceId,
    });
    if (!trigger) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (parsed.data.action === "rotate") {
      const result = await rotateTrigger({
        userId: user.id,
        triggerId: trigger.id,
      });
      return NextResponse.json(result);
    }

    const updated = await disableTrigger({
      userId: user.id,
      triggerId: trigger.id,
    });
    return NextResponse.json({ trigger: updated });
  } catch (error) {
    return handleTriggerError(error);
  }
}
