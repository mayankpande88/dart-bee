-- Migration V022: Switch to View-based statistics calculation
-- Description: 1. Removes aggregate columns from players table (saving storage)
--              2. Drops the stats update trigger (removing maintenance overhead/bugs)
--              3. Creates a view 'player_stats' for real-time correct statistics
--              4. Replaces 'player_leaderboard' materialized view with a standard view
-- Date: 2026-03-03

-- ============================================================================
-- 1. Drop the trigger and function
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_update_player_aggregates ON games;
DROP FUNCTION IF EXISTS update_player_aggregates_from_game();

-- ============================================================================
-- 2. Create the real-time statistics view
-- ============================================================================
CREATE OR REPLACE VIEW player_stats AS
SELECT 
    p.id,
    p.name,
    p.created_at,
    p.updated_at,
    p.is_deleted,
    COUNT(gp.id) FILTER (WHERE g.completed_at IS NOT NULL) as total_games_played,
    COUNT(gp.id) FILTER (WHERE gp.is_winner = true AND g.completed_at IS NOT NULL) as total_games_won,
    COALESCE(SUM(gp.total_score) FILTER (WHERE g.completed_at IS NOT NULL), 0) as total_score,
    COALESCE(SUM(gp.total_turns) FILTER (WHERE g.completed_at IS NOT NULL), 0) as total_turns,
    COALESCE(SUM(gp.total_darts) FILTER (WHERE g.completed_at IS NOT NULL), 0) as total_darts_thrown,
    COALESCE(SUM(gp.count_180s) FILTER (WHERE g.completed_at IS NOT NULL), 0) as total_180s,
    COALESCE(SUM(gp.count_140_plus) FILTER (WHERE g.completed_at IS NOT NULL), 0) as total_140_plus,
    COALESCE(MAX(gp.max_dart) FILTER (WHERE g.completed_at IS NOT NULL), 0) as max_dart_score,
    COALESCE(MAX(gp.max_turn) FILTER (WHERE g.completed_at IS NOT NULL), 0) as max_turn_score,
    COALESCE(SUM(gp.checkout_attempts) FILTER (WHERE g.completed_at IS NOT NULL), 0) as total_checkout_attempts,
    COALESCE(SUM(gp.checkout_successes) FILTER (WHERE g.completed_at IS NOT NULL), 0) as total_checkout_successes,
    
    -- Calculated Metrics (Zero Storage)
    ROUND(CASE WHEN COUNT(gp.id) FILTER (WHERE g.completed_at IS NOT NULL) > 0 
          THEN (COUNT(gp.id) FILTER (WHERE gp.is_winner = true AND g.completed_at IS NOT NULL))::numeric / COUNT(gp.id) FILTER (WHERE g.completed_at IS NOT NULL) * 100 
          ELSE 0 END, 2) as win_rate,
    ROUND(CASE WHEN SUM(gp.total_turns) FILTER (WHERE g.completed_at IS NOT NULL) > 0 
          THEN SUM(gp.total_score)::numeric / SUM(gp.total_turns) 
          ELSE 0 END, 2) as avg_per_turn,
    ROUND(CASE WHEN SUM(gp.total_darts) FILTER (WHERE g.completed_at IS NOT NULL) > 0 
          THEN SUM(gp.total_score)::numeric / SUM(gp.total_darts) 
          ELSE 0 END, 2) as avg_per_dart,
    ROUND(CASE WHEN SUM(gp.checkout_attempts) FILTER (WHERE g.completed_at IS NOT NULL) > 0 
          THEN SUM(gp.checkout_successes)::numeric / SUM(gp.checkout_attempts) * 100 
          ELSE 0 END, 1) as checkout_percentage
FROM players p
LEFT JOIN game_players gp ON p.id = gp.player_id
LEFT JOIN games g ON g.id = gp.game_id AND (g.is_practice IS NULL OR g.is_practice = false)
WHERE g.completed_at IS NOT NULL AND gp.total_turns > 0 AND (p.is_deleted IS NULL OR p.is_deleted = false)
GROUP BY p.id, p.name, p.created_at, p.updated_at, p.is_deleted;

-- ============================================================================
-- 3. Replace the materialized leaderboard with a regular view
-- ============================================================================
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'player_leaderboard') THEN
        DROP MATERIALIZED VIEW player_leaderboard CASCADE;
    ELSIF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'player_leaderboard') THEN
        DROP VIEW player_leaderboard CASCADE;
    END IF;
END $$;

CREATE OR REPLACE VIEW player_leaderboard AS
SELECT
  *,
  ROW_NUMBER() OVER (ORDER BY total_games_won DESC, win_rate DESC, total_games_played DESC) as rank_by_wins,
  ROW_NUMBER() OVER (ORDER BY win_rate DESC, total_games_played DESC) as rank_by_win_rate,
  ROW_NUMBER() OVER (ORDER BY avg_per_turn DESC, total_turns DESC) as rank_by_avg,
  ROW_NUMBER() OVER (ORDER BY total_180s DESC, total_darts_thrown DESC) as rank_by_180s,
  ROW_NUMBER() OVER (ORDER BY checkout_percentage DESC, total_checkout_attempts DESC) as rank_by_checkout
FROM player_stats
WHERE total_games_played > 0;

-- ============================================================================
-- 4. Drop the redundant columns from the players table
-- ============================================================================
ALTER TABLE players 
DROP COLUMN IF EXISTS total_games_played CASCADE,
DROP COLUMN IF EXISTS total_games_won CASCADE,
DROP COLUMN IF EXISTS total_darts_thrown CASCADE,
DROP COLUMN IF EXISTS total_score CASCADE,
DROP COLUMN IF EXISTS total_180s CASCADE,
DROP COLUMN IF EXISTS total_140_plus CASCADE,
DROP COLUMN IF EXISTS max_dart_score CASCADE,
DROP COLUMN IF EXISTS max_turn_score CASCADE,
DROP COLUMN IF EXISTS total_checkout_attempts CASCADE,
DROP COLUMN IF EXISTS total_checkout_successes CASCADE,
DROP COLUMN IF EXISTS best_checkout CASCADE,
DROP COLUMN IF EXISTS win_rate CASCADE,
DROP COLUMN IF EXISTS avg_per_dart CASCADE,
DROP COLUMN IF EXISTS checkout_percentage CASCADE,
DROP COLUMN IF EXISTS total_turns CASCADE,
DROP COLUMN IF EXISTS avg_per_turn CASCADE;

-- ============================================================================
-- Record Migration
-- ============================================================================
INSERT INTO schema_migrations (version, description)
VALUES ('V022', 'Switch to View-based statistics calculation')
ON CONFLICT (version) DO NOTHING;
