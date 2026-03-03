#!/usr/bin/env node
/**
 * Copy data from one Supabase instance to another.
 * Automatically creates the schema on the destination if tables don't exist.
 *
 * Usage:
 *   node scripts/copy-supabase.js                          # cloud → dest (defaults)
 *   node scripts/copy-supabase.js --clear                  # clear destination tables first
 *   node scripts/copy-supabase.js --tables players,games   # only specific tables
 *   node scripts/copy-supabase.js --dry-run                # preview without writing
 *   node scripts/copy-supabase.js --schema-only            # only create schema, skip data copy
 *   node scripts/copy-supabase.js --skip-schema            # skip schema creation
 *
 * Environment variables (override defaults):
 *   SOURCE_SUPABASE_URL   SOURCE_SUPABASE_KEY
 *   DEST_SUPABASE_URL     DEST_SUPABASE_KEY
 *   DEST_DB_PASSWORD      (required for schema setup — Supabase DB password)
 *
 * Requires: npm install @supabase/supabase-js
 */

const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// ── Defaults ───────────────────────────────────────────────────────────────
const DEFAULTS = {
    source: {
        url: 'https://hdiesaupdtjtazkxtylt.supabase.co',
        key: 'sb_publishable_6y9PlIYK4zl_ry2Cmm79Hw_BE96CJSZ',
    },
    dest: {
        url: 'https://kbkflklrbsszmconffzu.supabase.co',
        key: 'sb_publishable_sdqSTVGv7W4zhYVhBc4eDQ_7OG_D60s',
    },
};

// ── Config ─────────────────────────────────────────────────────────────────
const SOURCE_URL = process.env.SOURCE_SUPABASE_URL || DEFAULTS.source.url;
const SOURCE_KEY = process.env.SOURCE_SUPABASE_KEY || DEFAULTS.source.key;
const DEST_URL   = process.env.DEST_SUPABASE_URL   || DEFAULTS.dest.url;
const DEST_KEY   = process.env.DEST_SUPABASE_KEY   || DEFAULTS.dest.key;

// Core tables in foreign-key-safe order
const CORE_TABLES = ['players', 'games', 'game_players', 'turns'];

// Optional tables (skipped silently if they don't exist)
const OPTIONAL_TABLES = [
    'tournaments', 'tournament_participants', 'tournament_matches',
    'leagues', 'league_participants', 'league_matches',
];

// Columns to exclude (generated/computed — can't be inserted into)
const EXCLUDE_COLUMNS = {
    players: [
        'total_games_played', 'total_games_won', 'total_darts_thrown',
        'total_score', 'total_180s', 'total_140_plus', 'max_dart_score',
        'max_turn_score', 'total_checkout_attempts', 'total_checkout_successes',
        'best_checkout', 'win_rate', 'avg_per_dart', 'checkout_percentage',
        'total_turns', 'avg_per_turn',
    ],
    game_players: ['avg_per_turn'],
    league_participants: ['leg_difference'],
};

const BATCH_SIZE = 100;
const PAGE_SIZE  = 1000;

// ── Helpers ────────────────────────────────────────────────────────────────

function parseArgs() {
    const args = process.argv.slice(2);
    const opts = { clear: false, dryRun: false, tables: null, schemaOnly: false, skipSchema: false };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--clear')       opts.clear = true;
        if (args[i] === '--dry-run')     opts.dryRun = true;
        if (args[i] === '--schema-only') opts.schemaOnly = true;
        if (args[i] === '--skip-schema') opts.skipSchema = true;
        if (args[i] === '--tables' && args[i + 1]) {
            opts.tables = args[++i].split(',').map(t => t.trim());
        }
    }
    return opts;
}

function cleanRow(table, row) {
    const exclude = EXCLUDE_COLUMNS[table] || [];
    if (exclude.length === 0) return row;
    const cleaned = { ...row };
    exclude.forEach(col => delete cleaned[col]);
    return cleaned;
}

async function fetchAll(client, table) {
    const rows = [];
    let offset = 0;
    while (true) {
        const { data, error } = await client
            .from(table)
            .select('*')
            .range(offset, offset + PAGE_SIZE - 1);
        if (error) throw new Error(`Fetch ${table}: ${error.message}`);
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
    }
    return rows;
}

async function clearTable(client, table) {
    const { error } = await client.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw new Error(`Clear ${table}: ${error.message}`);
}

async function insertBatch(client, table, rows) {
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE).map(r => cleanRow(table, r));
        const { error } = await client.from(table).upsert(batch, { onConflict: 'id' });
        if (error) throw new Error(`Insert ${table} batch ${i}: ${error.message}`);
    }
}

function promptPassword() {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
        process.stderr.write('Enter destination Supabase DB password: ');
        rl.question('', (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

function extractProjectRef(url) {
    // https://xyz.supabase.co → xyz
    // http://127.0.0.1:54321  → local
    const match = url.match(/https?:\/\/([^.]+)\.supabase\.co/);
    if (match) return match[1];
    if (url.includes('127.0.0.1') || url.includes('localhost')) return 'local';
    return null;
}

async function setupSchema(destUrl, dbPassword) {
    const projectRef = extractProjectRef(destUrl);
    if (!projectRef) {
        console.error('Could not extract project ref from destination URL');
        process.exit(1);
    }

    const schemaFile = path.join(__dirname, '..', 'migrations', 'fresh_schema.sql');
    if (!fs.existsSync(schemaFile)) {
        console.error(`Schema file not found: ${schemaFile}`);
        process.exit(1);
    }

    let dbHost, dbPort;
    if (projectRef === 'local') {
        dbHost = '127.0.0.1';
        dbPort = '54322'; // local Supabase DB port
    } else {
        dbHost = `db.${projectRef}.supabase.co`;
        dbPort = '5432';
    }

    const psqlEnv = { ...process.env, PGPASSWORD: dbPassword };
    const psqlArgs = `-h ${dbHost} -p ${dbPort} -U postgres -d postgres`;

    console.log(`Connecting to DB at ${dbHost}:${dbPort}...`);

    try {
        // Test connection
        execSync(`psql ${psqlArgs} -c "SELECT 1;" 2>&1`, { stdio: 'pipe', env: psqlEnv });
        console.log('  DB connection OK');
    } catch (e) {
        console.error('  DB connection failed. Check your password.');
        console.error(`  Tip: Find it at https://supabase.com/dashboard/project/${projectRef}/settings/database`);
        process.exit(1);
    }

    console.log('Running fresh_schema.sql...');
    try {
        const output = execSync(`psql ${psqlArgs} -f "${schemaFile}" 2>&1`, { encoding: 'utf-8', env: psqlEnv });
        // Show only NOTICE lines
        output.split('\n')
            .filter(l => l.includes('NOTICE') || l.includes('ERROR'))
            .forEach(l => console.log('  ' + l.trim()));
        console.log('  Schema setup complete\n');
    } catch (e) {
        console.error('Schema setup failed:');
        console.error(e.stdout || e.stderr || e.message);
        process.exit(1);
    }
}

async function checkTablesExist(client) {
    const { data, error } = await client.from('players').select('id').limit(0);
    return !error;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
    const opts = parseArgs();

    console.log('=== Supabase Data Copy ===');
    console.log(`Source: ${SOURCE_URL}`);
    console.log(`Dest:   ${DEST_URL}`);
    if (opts.dryRun)     console.log('** DRY RUN — no writes **');
    if (opts.clear)      console.log('** Will clear destination tables first **');
    if (opts.schemaOnly) console.log('** SCHEMA ONLY — no data copy **');
    console.log();

    const source = createClient(SOURCE_URL, SOURCE_KEY);
    const dest   = createClient(DEST_URL, DEST_KEY);

    // ── Step 1: Schema setup ──────────────────────────────────────────────
    if (!opts.skipSchema) {
        const tablesExist = await checkTablesExist(dest);

        if (!tablesExist || opts.schemaOnly) {
            if (!tablesExist) {
                console.log('Destination tables not found — setting up schema...\n');
            }

            const dbPassword = process.env.DEST_DB_PASSWORD || await promptPassword();
            await setupSchema(DEST_URL, dbPassword);

            if (opts.schemaOnly) {
                console.log('Done! Schema created on destination.');
                return;
            }
        } else {
            console.log('Destination tables already exist — skipping schema setup.\n');
        }
    }

    // ── Step 2: Data copy ─────────────────────────────────────────────────
    const tables = opts.tables || [...CORE_TABLES, ...OPTIONAL_TABLES];
    const isOptional = (t) => !opts.tables && OPTIONAL_TABLES.includes(t);

    // If clearing, delete in reverse order (respect FK constraints)
    if (opts.clear && !opts.dryRun) {
        console.log('Clearing destination tables...');
        for (const table of [...tables].reverse()) {
            try {
                await clearTable(dest, table);
                console.log(`  Cleared ${table}`);
            } catch (e) {
                if (isOptional(table)) {
                    console.log(`  Skipped clearing ${table} (may not exist)`);
                } else {
                    throw e;
                }
            }
        }
        console.log();
    }

    let totalRows = 0;

    for (const table of tables) {
        try {
            process.stdout.write(`${table}: fetching...`);
            const rows = await fetchAll(source, table);
            process.stdout.write(` ${rows.length} rows`);

            if (rows.length > 0 && !opts.dryRun) {
                process.stdout.write(' → inserting...');
                await insertBatch(dest, table, rows);
            }

            totalRows += rows.length;
            console.log(' done');
        } catch (e) {
            if (isOptional(table)) {
                console.log(` skipped (${e.message})`);
            } else {
                throw e;
            }
        }
    }

    console.log(`\nCopied ${totalRows} total rows across ${tables.length} tables.`);
}

main().catch(err => {
    console.error('\nFailed:', err.message);
    process.exit(1);
});
