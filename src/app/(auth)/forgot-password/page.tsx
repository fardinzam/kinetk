"use client";

import Link from "next/link";
import { useState } from "react";

import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    const env = getPublicEnv();
    const supabase = createBrowserClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
      },
    );

    setIsSubmitting(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main>
        <h1>Check your inbox</h1>
        <p>We sent a password reset link to your email.</p>
        <p>
          <Link href="/sign-in">Back to sign in</Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Reset password</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="fp-email">Email</label>
          <input
            autoComplete="email"
            id="fp-email"
            name="email"
            required
            type="email"
          />
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Sending..." : "Send reset link"}
        </button>
      </form>
      <p>
        <Link href="/sign-in">Back to sign in</Link>
      </p>
    </main>
  );
}
