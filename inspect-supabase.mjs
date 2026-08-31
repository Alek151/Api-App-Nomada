import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 10 });
try {
  if (process.argv.includes('--seed')) {
    await sql.file('migrations/seed.sql');
  }
  const rows = await sql.unsafe(
    "select table_schema, table_name from information_schema.tables where table_schema = 'public' order by table_name",
  );
  console.log(JSON.stringify(rows));
} finally {
  await sql.end();
}
