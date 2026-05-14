import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { requireUser } from "@/server/auth/session";
import { createServerSupabaseClient } from "@/server/supabase/server";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

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
