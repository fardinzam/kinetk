import type { HttpRequestNodeConfig } from "@/domain/workflows/node-configs";
import type { Queryable } from "@/server/db/pool";
import { decryptSecret } from "@/server/secrets/crypto";
import { createSecretQueries } from "@/server/secrets/queries";

import type { NodeExecutor } from "./index";

const MAX_RETRIES = 3;
const MAX_RESPONSE_BYTES = 1_024 * 1_024; // 1 MB
const REQUEST_TIMEOUT_MS = 30_000;

async function buildHeaders(
  headerConfig: HttpRequestNodeConfig["headers"],
  db: Queryable,
): Promise<Record<string, string>> {
  const queries = createSecretQueries(db);
  const headers: Record<string, string> = {};

  for (const [headerName, ref] of Object.entries(headerConfig)) {
    const secret = await queries.findSecretByIdWithCiphertext(ref.secretId);
    if (!secret) continue;

    const plaintext = decryptSecret({
      ciphertext: secret.ciphertext,
      nonce: secret.nonce,
      authTag: secret.authTag,
      keyVersion: secret.keyVersion,
    });

    let value: string;
    switch (ref.injectAs) {
      case "Bearer":
        value = `Bearer ${plaintext}`;
        break;
      case "Basic":
        value = `Basic ${Buffer.from(plaintext).toString("base64")}`;
        break;
      default:
        value = plaintext;
    }

    headers[headerName] = value;
  }

  return headers;
}

export const httpRequestExecutor: NodeExecutor = async ({
  config,
  context,
  db,
}) => {
  const {
    method,
    url,
    headers: headerConfig,
    bodyMode,
  } = config as HttpRequestNodeConfig;

  let headers: Record<string, string>;
  try {
    headers = await buildHeaders(headerConfig, db);
  } catch (e) {
    return { ok: false, error: `Secret error: ${String(e)}`, retryable: false };
  }

  const body =
    bodyMode === "current_payload"
      ? JSON.stringify(context.currentPayload)
      : undefined;

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  let lastError = "unknown error";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.ok) {
        const text = await readLimited(response, MAX_RESPONSE_BYTES);
        let output: unknown = text;
        try {
          output = JSON.parse(text);
        } catch {
          /* keep as string */
        }
        return { ok: true, output };
      }

      if (response.status >= 400 && response.status < 500) {
        return {
          ok: false,
          error: `HTTP ${response.status}`,
          retryable: false,
        };
      }

      lastError = `HTTP ${response.status}`;
    } catch (e) {
      lastError = `network error: ${String(e)}`;
    }

    if (attempt < MAX_RETRIES) {
      await sleep(2_000 * attempt);
    }
  }

  return { ok: false, error: lastError, retryable: false };
};

async function readLimited(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        reader.cancel();
        break;
      }
      chunks.push(value);
    }
  }

  return new TextDecoder().decode(
    chunks.reduce((acc, c) => {
      const merged = new Uint8Array(acc.length + c.length);
      merged.set(acc);
      merged.set(c, acc.length);
      return merged;
    }, new Uint8Array()),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
