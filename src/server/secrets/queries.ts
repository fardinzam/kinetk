import "server-only";

import type { Queryable } from "@/server/db/pool";
import { getPool } from "@/server/db/pool";

import type { EncryptedValue } from "./crypto";

export type SecretMetadata = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: "active" | "disabled";
  keyVersion: string;
  createdAt: Date;
  updatedAt: Date;
  rotatedAt: Date | null;
};

export type CreateSecretRecord = {
  workspaceId: string;
  name: string;
  description?: string;
} & EncryptedValue;

export type EncryptedSecretRecord = SecretMetadata & EncryptedValue;

export type SecretQueries = {
  userCanAccessWorkspace(userId: string, workspaceId: string): Promise<boolean>;
  createSecret(input: CreateSecretRecord): Promise<SecretMetadata>;
  listSecretsForWorkspace(workspaceId: string): Promise<SecretMetadata[]>;
  findSecretById(secretId: string): Promise<SecretMetadata | null>;
  findSecretByIdWithCiphertext(
    secretId: string,
  ): Promise<EncryptedSecretRecord | null>;
  updateSecretValue(
    secretId: string,
    encrypted: EncryptedValue,
  ): Promise<SecretMetadata>;
  updateSecretStatus(
    secretId: string,
    status: "active" | "disabled",
  ): Promise<SecretMetadata>;
};

function mapRow(row: {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  status: string;
  key_version: string;
  created_at: Date;
  updated_at: Date;
  rotated_at: Date | null;
}): SecretMetadata {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    status: row.status as "active" | "disabled",
    keyVersion: row.key_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rotatedAt: row.rotated_at,
  };
}

export function createSecretQueries(db: Queryable = getPool()): SecretQueries {
  return {
    async userCanAccessWorkspace(userId, workspaceId) {
      const result = await db.query<{ exists: boolean }>(
        `
          select exists (
            select 1 from public.workspace_members
            where user_id = $1 and workspace_id = $2
          )
        `,
        [userId, workspaceId],
      );
      return result.rows[0]?.exists ?? false;
    },

    async createSecret(input) {
      const result = await db.query<{
        id: string;
        workspace_id: string;
        name: string;
        description: string | null;
        status: string;
        key_version: string;
        created_at: Date;
        updated_at: Date;
        rotated_at: Date | null;
      }>(
        `
          insert into public.workflow_secrets
            (workspace_id, name, description, ciphertext, nonce, auth_tag, key_version, status)
          values ($1, $2, $3, $4, $5, $6, $7, 'active')
          returning id, workspace_id, name, description, status, key_version,
                    created_at, updated_at, rotated_at
        `,
        [
          input.workspaceId,
          input.name,
          input.description ?? null,
          input.ciphertext,
          input.nonce,
          input.authTag,
          input.keyVersion,
        ],
      );
      return mapRow(result.rows[0]!);
    },

    async listSecretsForWorkspace(workspaceId) {
      const result = await db.query<{
        id: string;
        workspace_id: string;
        name: string;
        description: string | null;
        status: string;
        key_version: string;
        created_at: Date;
        updated_at: Date;
        rotated_at: Date | null;
      }>(
        `
          select id, workspace_id, name, description, status, key_version,
                 created_at, updated_at, rotated_at
          from public.workflow_secrets
          where workspace_id = $1
          order by created_at desc
        `,
        [workspaceId],
      );
      return result.rows.map(mapRow);
    },

    async findSecretById(secretId) {
      const result = await db.query<{
        id: string;
        workspace_id: string;
        name: string;
        description: string | null;
        status: string;
        key_version: string;
        created_at: Date;
        updated_at: Date;
        rotated_at: Date | null;
      }>(
        `
          select id, workspace_id, name, description, status, key_version,
                 created_at, updated_at, rotated_at
          from public.workflow_secrets
          where id = $1
          limit 1
        `,
        [secretId],
      );
      const row = result.rows[0];
      return row ? mapRow(row) : null;
    },

    async findSecretByIdWithCiphertext(secretId) {
      const result = await db.query<{
        id: string;
        workspace_id: string;
        name: string;
        description: string | null;
        status: string;
        key_version: string;
        created_at: Date;
        updated_at: Date;
        rotated_at: Date | null;
        ciphertext: string;
        nonce: string;
        auth_tag: string;
      }>(
        `
          select id, workspace_id, name, description, status, key_version,
                 created_at, updated_at, rotated_at,
                 ciphertext, nonce, auth_tag
          from public.workflow_secrets
          where id = $1
          limit 1
        `,
        [secretId],
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        ...mapRow(row),
        ciphertext: row.ciphertext,
        nonce: row.nonce,
        authTag: row.auth_tag,
        keyVersion: row.key_version,
      };
    },

    async updateSecretValue(secretId, encrypted) {
      const result = await db.query<{
        id: string;
        workspace_id: string;
        name: string;
        description: string | null;
        status: string;
        key_version: string;
        created_at: Date;
        updated_at: Date;
        rotated_at: Date | null;
      }>(
        `
          update public.workflow_secrets
          set ciphertext = $2, nonce = $3, auth_tag = $4, key_version = $5,
              rotated_at = now(), updated_at = now()
          where id = $1
          returning id, workspace_id, name, description, status, key_version,
                    created_at, updated_at, rotated_at
        `,
        [
          secretId,
          encrypted.ciphertext,
          encrypted.nonce,
          encrypted.authTag,
          encrypted.keyVersion,
        ],
      );
      return mapRow(result.rows[0]!);
    },

    async updateSecretStatus(secretId, status) {
      const result = await db.query<{
        id: string;
        workspace_id: string;
        name: string;
        description: string | null;
        status: string;
        key_version: string;
        created_at: Date;
        updated_at: Date;
        rotated_at: Date | null;
      }>(
        `
          update public.workflow_secrets
          set status = $2, updated_at = now()
          where id = $1
          returning id, workspace_id, name, description, status, key_version,
                    created_at, updated_at, rotated_at
        `,
        [secretId, status],
      );
      return mapRow(result.rows[0]!);
    },
  };
}
