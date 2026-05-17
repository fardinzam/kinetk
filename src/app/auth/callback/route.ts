import { NextResponse, type NextRequest } from "next/server";

import { createServerSupabaseClient } from "@/server/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");

  if (error) {
    const signIn = new URL("/sign-in", requestUrl.origin);
    signIn.searchParams.set("error", error);
    return NextResponse.redirect(signIn);
  }

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      const signIn = new URL("/sign-in", requestUrl.origin);
      signIn.searchParams.set("error", exchangeError.message);
      return NextResponse.redirect(signIn);
    }
  }

  return NextResponse.redirect(new URL("/workflows", requestUrl.origin));
}
