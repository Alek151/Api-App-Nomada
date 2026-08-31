import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import type { Env } from '../types';

export function getDb(env: Env) {
  const client = env.DATABASE_HOST
    ? postgres({
        host: env.DATABASE_HOST,
        port: Number(env.DATABASE_PORT ?? 5432),
        database: env.DATABASE_NAME ?? 'postgres',
        username: env.DATABASE_USER ?? 'postgres',
        password: env.DATABASE_PASSWORD,
        ssl: 'require',
        max: 5,
        prepare: false,
      })
    : postgres(env.HYPERDRIVE.connectionString, { max: 5, prepare: false });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof getDb>;
