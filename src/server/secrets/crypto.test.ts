import { Buffer } from "node:buffer";
import { beforeAll, describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "./crypto";

beforeAll(() => {
  process.env.APP_ENCRYPTION_KEY_BASE64 = Buffer.alloc(32).toString("base64");
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips plaintext correctly", () => {
    const plaintext = "super-secret-api-key-abc123";
    const encrypted = encryptSecret(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it("throws when the auth tag is wrong", () => {
    const encrypted = encryptSecret("my-secret");
    const tampered = {
      ...encrypted,
      authTag: encryptSecret("different").authTag,
    };
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("throws when the ciphertext is tampered", () => {
    const encrypted = encryptSecret("my-secret");
    const bytes = Buffer.from(encrypted.ciphertext, "base64");
    bytes[0] = bytes[0] ^ 0xff;
    const tampered = { ...encrypted, ciphertext: bytes.toString("base64") };
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
