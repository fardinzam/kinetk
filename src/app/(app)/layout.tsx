import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { requireUser } from "@/server/auth/session";
import { createServerSupabaseClient } from "@/server/supabase/server";
import { bootstrapDefaultWorkspace } from "@/server/workspaces/service";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  await bootstrapDefaultWorkspace({
    id: user.id,
    email: user.email,
    name: user.user_metadata.name,
  });

  async function signOut() {
    "use server";

    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
    redirect("/sign-in");
  }

  return (
    <main>
      <nav aria-label="FlowForge app navigation">
        <a href="/workflows">Workflows</a>
        <span>{user.email}</span>
        <form action={signOut}>
          <button type="submit">Sign out</button>
        </form>
      </nav>
      {children}
    </main>
  );
}
