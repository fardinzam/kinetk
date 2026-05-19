import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/session";
import { serverEnv } from "@/server/env";
import {
  createInvitation,
  listInvitations,
  DuplicateInvitationError,
  InvitationAccessError,
} from "@/server/invitations/service";

type RouteContext = { params: Promise<{ workspaceId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireUser();
  const { workspaceId } = await context.params;

  try {
    const invitations = await listInvitations({
      workspaceId,
      requestingUserId: user.id,
    });
    return NextResponse.json({ invitations });
  } catch (err) {
    if (err instanceof InvitationAccessError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[invitations] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireUser();
  const { workspaceId } = await context.params;

  let email: string;
  try {
    const body = (await request.json()) as { email?: unknown };
    if (typeof body.email !== "string" || !body.email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email required" },
        { status: 400 },
      );
    }
    email = body.email.toLowerCase().trim();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  try {
    const result = await createInvitation({
      workspaceId,
      invitedByUserId: user.id,
      inviterEmail: user.email ?? "",
      email,
      appUrl: serverEnv.NEXT_PUBLIC_APP_URL,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateInvitationError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof InvitationAccessError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[invitations] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
