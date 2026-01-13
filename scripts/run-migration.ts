import { sql } from '../lib/db';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  const migrationFile = process.argv[2];
  
  if (!migrationFile) {
    console.log('Usage: npx tsx scripts/run-migration.ts <migration-file>');
    console.log('Example: npx tsx scripts/run-migration.ts 002_emma_users_enhanced.sql');
    process.exit(1);
  }

  const migrationPath = path.join(__dirname, '..', 'lib', 'migrations', migrationFile);
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  console.log(`Running migration: ${migrationFile}`);
  
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
  
  try {
    // Split by semicolons and run each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.slice(0, 60)}...`);
        await sql.unsafe(statement);
      }
    }
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

runMigration();
