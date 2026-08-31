export interface Env {
  HYPERDRIVE: Hyperdrive;
  FOTOS: R2Bucket;
  DOCUMENTOS: R2Bucket;
  JWT_SECRET: string;
  APP_ENV: string;
  ALLOWED_ORIGINS: string;
  ACCESS_TOKEN_TTL_MINUTES: string;
  REFRESH_TOKEN_TTL_DAYS: string;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_JWKS_URL: string;
  DATABASE_HOST?: string;
  DATABASE_PORT?: string;
  DATABASE_NAME?: string;
  DATABASE_USER?: string;
  DATABASE_PASSWORD?: string;
}

export type AppVariables = { userId: string; sessionId: string };
