import "server-only";

import { encryptSecret } from "./crypto";
import type { SecretMetadata, SecretQueries } from "./queries";

export type { SecretMetadata };

export class SecretAccessError extends Error {
  readonly code = "secret_access_denied";
  constructor() {
    super("Access denied");
  }
}

export class SecretNotFoundError extends Error {
  readonly code = "secret_not_found";
  constructor() {
    super("Secret not found");
  }
}

async function getQueries(queries?: SecretQueries): Promise<SecretQueries> {
  if (queries) return queries;
  const mod = await import("./queries");
  return mod.createSecretQueries();
}

async function assertWorkspaceAccess(
  userId: string,
  workspaceId: string,
  queries: SecretQueries,
) {
  if (!(await queries.userCanAccessWorkspace(userId, workspaceId))) {
    throw new SecretAccessError();
  }
}

async function findSecretWithAccess(
  userId: string,
  secretId: string,
  queries: SecretQueries,
): Promise<SecretMetadata> {
  const secret = await queries.findSecretById(secretId);
  if (!secret) throw new SecretNotFoundError();
  await assertWorkspaceAccess(userId, secret.workspaceId, queries);
  return secret;
}

export async function createSecretForWorkspace(
  input: {
    userId: string;
    workspaceId: string;
    name: string;
    description?: string;
    plaintext: string;
  },
  queries?: SecretQueries,
): Promise<SecretMetadata> {
  const q = await getQueries(queries);
  await assertWorkspaceAccess(input.userId, input.workspaceId, q);
  const encrypted = encryptSecret(input.plaintext);
  return q.createSecret({
    workspaceId: input.workspaceId,
    name: input.name.trim(),
    description: input.description?.trim(),
    ...encrypted,
  });
}

export async function listSecretsForWorkspace(
  input: { userId: string; workspaceId: string },
  queries?: SecretQueries,
): Promise<SecretMetadata[]> {
  const q = await getQueries(queries);
  await assertWorkspaceAccess(input.userId, input.workspaceId, q);
  return q.listSecretsForWorkspace(input.workspaceId);
}

export async function rotateSecretValue(
  input: { userId: string; secretId: string; newPlaintext: string },
  queries?: SecretQueries,
): Promise<SecretMetadata> {
  const q = await getQueries(queries);
  await findSecretWithAccess(input.userId, input.secretId, q);
  const encrypted = encryptSecret(input.newPlaintext);
  return q.updateSecretValue(input.secretId, encrypted);
}

export async function disableSecret(
  input: { userId: string; secretId: string },
  queries?: SecretQueries,
): Promise<SecretMetadata> {
  const q = await getQueries(queries);
  await findSecretWithAccess(input.userId, input.secretId, q);
  return q.updateSecretStatus(input.secretId, "disabled");
}
