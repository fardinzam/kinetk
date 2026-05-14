import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";

export default function SignUpPage() {
  return (
    <main>
      <h1>Create account</h1>
      <AuthForm mode="sign-up" />
      <p>
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </main>
  );
}
