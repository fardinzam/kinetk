import "server-only";

import { createClient } from "@supabase/supabase-js";

import { serverEnv } from "@/server/env";

export function createServerSupabaseClient() {
  return createClient(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
      },
    },
  );
}
