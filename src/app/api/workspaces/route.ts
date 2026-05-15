import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/session";
import {
  bootstrapDefaultWorkspace,
  listWorkspacesForUser,
} from "@/server/workspaces/service";

export async function GET() {
  const user = await requireUser();

  await bootstrapDefaultWorkspace({
    id: user.id,
    email: user.email,
    name: user.user_metadata.name,
  });

  const workspaces = await listWorkspacesForUser(user.id);

  return NextResponse.json({ workspaces });
}
