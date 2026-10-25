import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';

async function main() {
  let envContent: string;
  try {
    envContent = await readFile(join(process.cwd(), '.env.local'), 'utf-8');
  } catch {
    console.error('Error: Could not read .env.local file in project root.');
    process.exit(1);
  }

  const match = envContent.match(/^\s*DATABASE_URL=(.+)$/m);
  if (!match) {
    console.error('Error: DATABASE_URL not found in .env.local.');
    process.exit(1);
  }

  const connectionString = match[1].replace(/['"]/g, '').trim();
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 3000 });

  const arg = process.argv[2]?.toLowerCase();

  try {
    if (!arg || arg === 'summary' || arg === 'all') {
      console.log('\n📊 CASEPULSE Database Tables Summary:');
      const res = await pool.query(`
        SELECT 
          table_name AS "Table Name",
          (xpath('/row/cnt/text()', xml_count))[1]::text::int AS "Total Rows"
        FROM (
          SELECT 
            table_name, 
            query_to_xml(format('select count(*) as cnt from %I', table_name), false, true, '') as xml_count
          FROM information_schema.tables 
          WHERE table_schema = 'public'
        ) t
        ORDER BY table_name;
      `);
      console.table(res.rows);
      console.log('💡 Tip: View table contents by running:');
      console.log('   npm run db:view complaint_cases');
      console.log('   npm run db:view institutions');
      console.log('   npm run db:view case_relationships\n');
    } else {
      console.log(`\n📋 Viewing top 10 records from table: "${arg}":`);
      const res = await pool.query(`SELECT * FROM ${arg} LIMIT 10;`);
      if (res.rows.length === 0) {
        console.log(`(Table "${arg}" is empty)`);
      } else {
        console.table(res.rows);
      }
      console.log('');
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Query error: ${message}\n`);
  } finally {
    await pool.end();
  }
}

main();
