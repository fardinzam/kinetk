import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";

export default function SignInPage() {
  return (
    <main>
      <h1>Sign in</h1>
      <AuthForm mode="sign-in" />
      <p>
        Need an account? <Link href="/sign-up">Create one</Link>
      </p>
    </main>
  );
}
