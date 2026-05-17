import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthForm } from "./auth-form";

describe("AuthForm", () => {
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
});
