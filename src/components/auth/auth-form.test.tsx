import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "./auth-form";

const { signInWithPassword, signUp } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({
    auth: {
      signInWithPassword,
      signUp,
    },
  }),
}));

vi.mock("@/lib/env", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    NEXT_PUBLIC_APP_URL: "https://kinetk.app",
  }),
}));

describe("AuthForm", () => {
  beforeEach(() => {
    signInWithPassword.mockReset();
    signUp.mockReset();
    window.history.pushState({}, "", "/");
  });

  it("renders sign-in fields and action", () => {
    render(<AuthForm mode="sign-in" />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("renders sign-up action", () => {
    render(<AuthForm mode="sign-up" />);

    expect(
      screen.getByRole("button", { name: "Create account" }),
    ).toBeInTheDocument();
  });

  it("preserves next redirect in sign-up email confirmation URL", async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: null });
    window.history.pushState(
      {},
      "",
      "/sign-up?next=/accept-invitation?token=tok_1",
    );

    render(<AuthForm mode="sign-up" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "guest@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(signUp).toHaveBeenCalled());
    expect(signUp).toHaveBeenCalledWith({
      email: "guest@example.com",
      password: "password123",
      options: {
        emailRedirectTo:
          "https://kinetk.app/auth/callback?next=%2Faccept-invitation%3Ftoken%3Dtok_1",
      },
    });
  });
});
