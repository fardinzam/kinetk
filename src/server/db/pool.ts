import "server-only";

import pg from "pg";

import { serverEnv } from "@/server/env";

const { Pool } = pg;

export type Queryable = {
  query<T extends pg.QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<pg.QueryResult<T>>;
};

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  pool ??= new Pool({
    connectionString: serverEnv.DATABASE_URL,
    max: 5,
  });

  return pool;
}

export async function query<T extends pg.QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, values);
}
