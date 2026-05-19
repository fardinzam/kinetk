"use client";

import { useEffect, useState } from "react";

import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const env = getPublicEnv();
  const supabase = createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        window.location.assign("/forgot-password");
      } else {
        setReady(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const password = String(
      new FormData(e.currentTarget).get("password") ?? "",
    );
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setIsSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    window.location.assign("/workflows");
  }

  if (!ready) {
    return (
      <main>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Set new password</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="rp-password">New password</label>
          <input
            autoComplete="new-password"
            id="rp-password"
            minLength={8}
            name="password"
            required
            type="password"
          />
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Updating..." : "Update password"}
        </button>
      </form>
    </main>
  );
}
