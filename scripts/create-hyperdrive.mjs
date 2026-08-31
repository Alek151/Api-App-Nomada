import { spawn } from 'node:child_process';

const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
const args = [
  'node_modules/wrangler/bin/wrangler.js',
  'hyperdrive', 'create', 'nomada-supabase',
  '--host', databaseUrl.hostname,
  '--port', databaseUrl.port || '5432',
  '--database', databaseUrl.pathname.slice(1),
  '--user', decodeURIComponent(databaseUrl.username),
  '--password', decodeURIComponent(databaseUrl.password),
  '--sslmode', 'require',
  '--origin-connection-limit', '5',
  '--binding', 'HYPERDRIVE',
  '--update-config',
];

const child = spawn(process.execPath, args, { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 1));
