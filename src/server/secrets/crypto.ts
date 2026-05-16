import "server-only";

import { Buffer } from "node:buffer";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedValue = {
  ciphertext: string;
  nonce: string;
  authTag: string;
  keyVersion: string;
};

const KEY_VERSION = "v1";

function getKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY_BASE64;
  if (!raw) throw new Error("APP_ENCRYPTION_KEY_BASE64 is not set");
  return Buffer.from(raw, "base64");
}

export function encryptSecret(plaintext: string): EncryptedValue {
  const key = getKey();
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    nonce: nonce.toString("base64"),
    authTag: authTag.toString("base64"),
    keyVersion: KEY_VERSION,
  };
}

export function decryptSecret(encrypted: EncryptedValue): string {
  const key = getKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(encrypted.nonce, "base64"),
  );
  decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));
  return (
    decipher.update(Buffer.from(encrypted.ciphertext, "base64"), undefined, "utf8") +
    decipher.final("utf8")
  );
}
