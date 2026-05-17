import { NextResponse } from "next/server";
import { z } from "zod";

import { workflowEventSchema } from "@/domain/workflows/events";
import { requireUser } from "@/server/auth/session";
import {
  syncWorkflowEvents,
  SyncAccessError,
  WorkflowNotFoundForSyncError,
} from "@/server/sync/service";

const syncRequestSchema = z.object({
  workflowId: z.string().min(1),
  baseServerRevision: z.number().int().min(0),
  events: z.array(workflowEventSchema),
});

export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = syncRequestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid sync request" },
      { status: 400 },
    );
  }

  try {
    const result = await syncWorkflowEvents({
      userId: user.id,
      workflowId: parsed.data.workflowId,
      baseServerRevision: parsed.data.baseServerRevision,
      events: parsed.data.events,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SyncAccessError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (error instanceof WorkflowNotFoundForSyncError) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 },
      );
    }

    throw error;
  }
}
