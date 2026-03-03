/**
 * Dart Bee - Configuration
 * Supabase credentials for dart-bee project
 *
 * NOTE: This file is COMMITTED to the repository
 * It contains only the PUBLIC anon key which is safe to expose
 * The anon key only has permissions granted by Row Level Security policies
 */

const AppConfig = {
    supabase: {
        // Your Supabase project URL
        // Cloud Supabase (uncomment for production)
        // url: 'https://hdiesaupdtjtazkxtylt.supabase.co',
        // anonKey: 'sb_publishable_6y9PlIYK4zl_ry2Cmm79Hw_BE96CJSZ'
        // Local Supabase (for development/testing)
        url: 'http://127.0.0.1:54321',
        anonKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
    },

    // Storage backend: 'supabase' | 'local'
    // Set to 'local' to run fully offline using localStorage
    storage: 'supabase'
};
