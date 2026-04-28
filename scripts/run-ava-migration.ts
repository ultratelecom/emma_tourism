/**
 * Ava migration runner
 *
 * Executes a migration SQL file against DATABASE_URL as a SINGLE
 * statement (via neon's query fn), which preserves dollar-quoted
 * plpgsql function bodies — unlike the semicolon-splitting runner.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/run-ava-migration.ts 003_ava_profile.sql
 */

import * as fs from 'fs';
import * as path from 'path';
import { neon } from '@neondatabase/serverless';

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.log('Usage: npx tsx --env-file=.env.local scripts/run-ava-migration.ts <filename>');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const migrationPath = path.join(__dirname, '..', 'lib', 'migrations', fileArg);
  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration not found: ${migrationPath}`);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
  console.log(`\n─── Running migration: ${fileArg} ───`);
  console.log(`SQL length: ${migrationSQL.length} chars\n`);

  // neon() returns a callable tagged-template fn, plus a .query(sql, params) method
  // for raw multi-statement SQL. The serverless driver uses HTTP; multi-statement
  // SQL is supported by setting fullResults:false and passing the full text.
  const sqlClient = neon(process.env.DATABASE_URL);

  const started = Date.now();
  try {
    // .query runs a raw SQL string via the serverless driver. It accepts multi-
    // statement input and handles dollar-quoted strings correctly.
    await sqlClient.query(migrationSQL);
    console.log(`✅ Migration completed in ${Date.now() - started}ms`);
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
  }

  // Quick sanity check: verify tables exist and emma → ava row count
  try {
    const [avaUsers] = (await sqlClient`SELECT COUNT(*)::int AS c FROM ava_users`) as [{ c: number }];
    const [emmaUsers] = (await sqlClient`SELECT COUNT(*)::int AS c FROM emma_users`) as [{ c: number }];
    const [fields] = (await sqlClient`SELECT COUNT(*)::int AS c FROM ava_profile_fields`) as [{ c: number }];
    const [notes] = (await sqlClient`SELECT COUNT(*)::int AS c FROM ava_notes`) as [{ c: number }];
    const [entities] = (await sqlClient`SELECT COUNT(*)::int AS c FROM ava_entities`) as [{ c: number }];

    console.log('\n─── Post-migration state ───');
    console.log(`  emma_users          : ${emmaUsers.c}`);
    console.log(`  ava_users           : ${avaUsers.c}  (should equal or exceed emma_users)`);
    console.log(`  ava_profile_fields  : ${fields.c}`);
    console.log(`  ava_notes           : ${notes.c}`);
    console.log(`  ava_entities        : ${entities.c}`);
  } catch (err) {
    console.error('Sanity check failed:', err);
    process.exit(1);
  }
}

main();
