import { spawn } from 'node:child_process';

if (!process.env.DATABASE_URL) {
  throw new Error('Falta DATABASE_URL en .env.supabase');
}

const child = spawn(
  process.execPath,
  [
    'node_modules/wrangler/bin/wrangler.js',
    'dev',
    '--ip=0.0.0.0',
    '--port=8787',
    '--show-interactive-dev-session=false',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: process.env.DATABASE_URL,
    },
  },
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', (code) => process.exit(code ?? 0));
