"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";

import { getPublicEnv } from "@/lib/env";

type AuthFormProps = {
  mode: "sign-in" | "sign-up";
};

export function AuthForm({ mode }: AuthFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const env = getPublicEnv();
    const supabase = createBrowserClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );

    const result =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback`,
            },
          });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (mode === "sign-up") {
      if (result.data?.session) {
        window.location.assign("/workflows");
      } else {
        setCheckEmail(true);
      }
      return;
    }

    window.location.assign("/workflows");
  }

  const actionLabel = mode === "sign-in" ? "Sign in" : "Create account";

  if (checkEmail) {
    return (
      <div>
        <p>Check your inbox — we sent a confirmation link to your email.</p>
        <p>Click the link to activate your account and sign in.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor={`${mode}-email`}>Email</label>
        <input
          autoComplete="email"
          id={`${mode}-email`}
          name="email"
          required
          type="email"
        />
      </div>
      <div>
        <label htmlFor={`${mode}-password`}>Password</label>
        <input
          autoComplete={
            mode === "sign-in" ? "current-password" : "new-password"
          }
          id={`${mode}-password`}
          minLength={8}
          name="password"
          required
          type="password"
        />
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Working..." : actionLabel}
      </button>
    </form>
  );
}
