import postgres from 'postgres';

const migrations = [
  ['3884a02a48afa2897f1117aab1a3dda1920cb251dfe56188bfab917a565eea91', '1788204338025'],
  ['c39998acb1e6a980e60cc7c45d97a1189dbc7eb9f608360393d6f6ed784d366d', '1788220000000'],
  ['c679cc27a16d5aca30342828997eb1276cbd55ce2a7610640bab821959c25b9a', '1788300000000'],
  ['e68abb77017bc4f33419e31dd05accdfadb0e309d7858276a7af0b7eefa67932', '1788301000000'],
];

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
try {
  for (const [hash, createdAt] of migrations) {
    await sql.unsafe('insert into drizzle.__drizzle_migrations (hash, created_at) select $1, $2 where not exists (select 1 from drizzle.__drizzle_migrations where hash = $1)', [hash, createdAt]);
  }
  console.log('Historial de migraciones sincronizado.');
} finally {
  await sql.end();
}
