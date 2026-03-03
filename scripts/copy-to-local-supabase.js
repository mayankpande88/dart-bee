/**
 * Copy data from cloud Supabase to local Supabase
 * Run with: node scripts/copy-to-local-supabase.js
 *
 * Requires: npm install @supabase/supabase-js
 */

const { createClient } = require('@supabase/supabase-js');

// Cloud Supabase (source)
const CLOUD_URL = 'https://hdiesaupdtjtazkxtylt.supabase.co';
const CLOUD_KEY = 'sb_publishable_6y9PlIYK4zl_ry2Cmm79Hw_BE96CJSZ';

// Local Supabase (destination)
const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_KEY = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const cloud = createClient(CLOUD_URL, CLOUD_KEY);
const local = createClient(LOCAL_URL, LOCAL_KEY);

async function fetchAll(client, table) {
    const rows = [];
    let offset = 0;
    const limit = 1000;
    while (true) {
        const { data, error } = await client.from(table).select('*').range(offset, offset + limit - 1);
        if (error) throw new Error(`Error fetching ${table}: ${error.message}`);
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < limit) break;
        offset += limit;
    }
    return rows;
}

// Generated/computed and aggregate columns that were removed in V023
const EXCLUDE_COLUMNS = {
    players: [
        'total_games_played', 'total_games_won', 'total_darts_thrown', 
        'total_score', 'total_180s', 'total_140_plus', 'max_dart_score', 
        'max_turn_score', 'total_checkout_attempts', 'total_checkout_successes', 
        'best_checkout', 'win_rate', 'avg_per_dart', 'checkout_percentage', 
        'total_turns', 'avg_per_turn'
    ],
    game_players: ['avg_per_turn'],
};

function cleanRow(table, row) {
    const exclude = EXCLUDE_COLUMNS[table] || [];
    if (exclude.length === 0) return row;
    const cleaned = { ...row };
    exclude.forEach(col => delete cleaned[col]);
    return cleaned;
}

async function insertBatch(client, table, rows) {
    if (rows.length === 0) return;
    // Insert in batches of 100
    for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100).map(r => cleanRow(table, r));
        const { error } = await client.from(table).upsert(batch, { onConflict: 'id' });
        if (error) throw new Error(`Error inserting ${table} batch ${i}: ${error.message}`);
    }
}

async function main() {
    // Order matters for foreign keys
    const tables = ['players', 'games', 'game_players', 'turns'];

    for (const table of tables) {
        console.log(`Fetching ${table} from cloud...`);
        const rows = await fetchAll(cloud, table);
        console.log(`  Got ${rows.length} rows`);

        if (rows.length > 0) {
            console.log(`  Inserting into local...`);
            await insertBatch(local, table, rows);
            console.log(`  Done`);
        }
    }

    // Also copy tournaments/leagues if any
    for (const table of ['tournaments', 'tournament_participants', 'tournament_matches', 'leagues', 'league_participants', 'league_matches']) {
        try {
            const rows = await fetchAll(cloud, table);
            if (rows.length > 0) {
                console.log(`Copying ${table}: ${rows.length} rows`);
                await insertBatch(local, table, rows);
            }
        } catch (e) {
            console.log(`Skipping ${table}: ${e.message}`);
        }
    }

    console.log('\nDone! Data copied to local Supabase.');
    console.log('Update config.js to use local Supabase:');
    console.log("  url: 'http://127.0.0.1:54321'");
    console.log("  anonKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'");
    console.log("  storage: 'supabase'");
}

main().catch(console.error);
