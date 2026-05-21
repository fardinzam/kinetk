import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requireUser } from "@/server/auth/session";
import { createServerSupabaseClient } from "@/server/supabase/server";
import {
  getActiveWorkspaceForUser,
  listWorkspacesForUser,
} from "@/server/workspaces/service";
import { WorkspaceSwitcher } from "@/components/workspaces/workspace-switcher";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const cookieStore = await cookies();
  const activeWorkspaceId =
    cookieStore.get("active_workspace_id")?.value ?? undefined;

  const [activeWorkspace, workspaces] = await Promise.all([
    getActiveWorkspaceForUser(
      { id: user.id, email: user.email, name: user.user_metadata?.name },
      activeWorkspaceId,
    ),
    listWorkspacesForUser(user.id),
  ]);

  async function signOut() {
    "use server";

    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
    redirect("/sign-in");
  }

  return (
    <main>
      <nav aria-label="Kinetk app navigation">
        <Link href="/workflows">Workflows</Link>
        <WorkspaceSwitcher
          currentWorkspace={activeWorkspace}
          workspaces={workspaces}
        />
        <span>{user.email}</span>
        <form action={signOut}>
          <button type="submit">Sign out</button>
        </form>
      </nav>
      {children}
    </main>
  );
}
