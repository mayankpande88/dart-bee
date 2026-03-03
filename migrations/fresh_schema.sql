-- Fresh Schema: Complete production schema for Dart Bee
-- Use this to set up a new Supabase instance from scratch (no data migration needed).
-- After running this, use scripts/copy-supabase.js to copy data.

-- ============================================================================
-- TABLE: players
-- ============================================================================
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT unique_player_name UNIQUE(name)
);

-- ============================================================================
-- TABLE: games
-- ============================================================================
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  game_type INTEGER NOT NULL,
  win_condition TEXT NOT NULL CHECK (win_condition IN ('exact', 'below')),
  scoring_mode TEXT NOT NULL CHECK (scoring_mode IN ('per-dart', 'per-turn')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  current_turn INTEGER NOT NULL DEFAULT 0,
  device_id TEXT,
  total_players INTEGER NOT NULL DEFAULT 0,
  winner_id UUID REFERENCES players(id) ON DELETE SET NULL,
  is_practice BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT valid_game_type CHECK (game_type > 0)
);

-- ============================================================================
-- TABLE: game_players
-- ============================================================================
CREATE TABLE IF NOT EXISTS game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player_order INTEGER NOT NULL,
  starting_score INTEGER NOT NULL,
  final_score INTEGER NOT NULL DEFAULT 0,
  is_winner BOOLEAN NOT NULL DEFAULT false,
  finish_rank INTEGER,
  finish_round INTEGER,
  total_turns INTEGER NOT NULL DEFAULT 0,
  total_darts INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  max_dart INTEGER NOT NULL DEFAULT 0,
  max_turn INTEGER NOT NULL DEFAULT 0,
  count_180s INTEGER NOT NULL DEFAULT 0,
  count_140_plus INTEGER NOT NULL DEFAULT 0,
  checkout_attempts INTEGER NOT NULL DEFAULT 0,
  checkout_successes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  avg_per_turn NUMERIC(6,2) GENERATED ALWAYS AS (
    CASE WHEN total_turns = 0 THEN 0
    ELSE ROUND(total_score::NUMERIC / total_turns, 2) END
  ) STORED,
  CONSTRAINT unique_game_player UNIQUE(game_id, player_id),
  CONSTRAINT unique_game_player_order UNIQUE(game_id, player_order),
  CONSTRAINT check_non_negative_stats CHECK (
    total_turns >= 0 AND total_darts >= 0 AND total_score >= 0 AND max_dart >= 0 AND max_turn >= 0
  ),
  CONSTRAINT check_valid_player_order CHECK (player_order >= 0)
);

-- ============================================================================
-- TABLE: turns
-- ============================================================================
CREATE TABLE IF NOT EXISTS turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_player_id UUID NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL CHECK (turn_number >= 1),
  round_number INTEGER NOT NULL CHECK (round_number >= 0),
  score_before INTEGER NOT NULL CHECK (score_before >= 0),
  score_after INTEGER NOT NULL CHECK (score_after >= -200),
  turn_total INTEGER NOT NULL CHECK (turn_total >= 0 AND turn_total <= 180),
  dart_scores INTEGER[] NOT NULL,
  is_busted BOOLEAN NOT NULL DEFAULT false,
  is_checkout_attempt BOOLEAN NOT NULL DEFAULT false,
  is_successful_checkout BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_has_darts CHECK (array_length(dart_scores, 1) >= 1 AND array_length(dart_scores, 1) <= 3)
);

-- ============================================================================
-- TABLE: tournaments
-- ============================================================================
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'registration' CHECK (status IN ('registration', 'in_progress', 'completed')),
  format TEXT NOT NULL DEFAULT 'single_elimination' CHECK (format IN ('single_elimination', 'double_elimination')),
  game_type INTEGER NOT NULL DEFAULT 501,
  win_condition TEXT NOT NULL DEFAULT 'exact' CHECK (win_condition IN ('exact', 'below')),
  scoring_mode TEXT NOT NULL DEFAULT 'per-dart' CHECK (scoring_mode IN ('per-dart', 'per-turn')),
  max_players INTEGER NOT NULL DEFAULT 8 CHECK (max_players IN (4, 8, 16, 32)),
  device_id TEXT,
  winner_id UUID REFERENCES players(id),
  CONSTRAINT valid_tournament_game_type CHECK (game_type > 0)
);

CREATE TABLE IF NOT EXISTS tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  bracket_position INTEGER NOT NULL,
  eliminated BOOLEAN NOT NULL DEFAULT false,
  eliminated_in_round INTEGER,
  final_placement INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_tournament_player UNIQUE(tournament_id, player_id),
  CONSTRAINT unique_tournament_bracket_position UNIQUE(tournament_id, bracket_position)
);

CREATE TABLE IF NOT EXISTS tournament_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  match_number INTEGER NOT NULL,
  player1_id UUID REFERENCES players(id),
  player2_id UUID REFERENCES players(id),
  winner_id UUID REFERENCES players(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'in_progress', 'completed')),
  winner_next_match_id UUID REFERENCES tournament_matches(id),
  loser_next_match_id UUID REFERENCES tournament_matches(id),
  game_id UUID REFERENCES games(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_tournament_match_position UNIQUE(tournament_id, round, match_number)
);

-- ============================================================================
-- TABLE: leagues
-- ============================================================================
CREATE TABLE IF NOT EXISTS leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'registration' CHECK (status IN ('registration', 'in_progress', 'completed')),
  game_type INTEGER NOT NULL DEFAULT 501,
  win_condition TEXT NOT NULL DEFAULT 'exact' CHECK (win_condition IN ('exact', 'below')),
  scoring_mode TEXT NOT NULL DEFAULT 'per-dart' CHECK (scoring_mode IN ('per-dart', 'per-turn')),
  matches_per_pairing INTEGER NOT NULL DEFAULT 1 CHECK (matches_per_pairing IN (1, 2)),
  points_for_win INTEGER NOT NULL DEFAULT 3,
  points_for_draw INTEGER NOT NULL DEFAULT 1,
  points_for_loss INTEGER NOT NULL DEFAULT 0,
  device_id TEXT,
  winner_id UUID REFERENCES players(id),
  CONSTRAINT valid_league_game_type CHECK (game_type > 0)
);

CREATE TABLE IF NOT EXISTS league_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  matches_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  legs_won INTEGER NOT NULL DEFAULT 0,
  legs_lost INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  leg_difference INTEGER GENERATED ALWAYS AS (legs_won - legs_lost) STORED,
  CONSTRAINT unique_league_player UNIQUE(league_id, player_id)
);

CREATE TABLE IF NOT EXISTS league_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  player1_id UUID NOT NULL REFERENCES players(id),
  player2_id UUID NOT NULL REFERENCES players(id),
  winner_id UUID REFERENCES players(id),
  is_draw BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  fixture_round INTEGER,
  game_id UUID REFERENCES games(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT different_players CHECK (player1_id != player2_id)
);

-- ============================================================================
-- TABLE: schema_migrations
-- ============================================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description TEXT,
  success BOOLEAN NOT NULL DEFAULT true
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Games
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_completed_at ON games(completed_at DESC) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_games_active ON games(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_games_winner ON games(winner_id) WHERE winner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_games_device ON games(device_id) WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_games_type ON games(game_type);

-- Players
CREATE INDEX IF NOT EXISTS idx_players_name ON players(name);
CREATE INDEX IF NOT EXISTS idx_players_created_at ON players(created_at DESC);

-- Game Players
CREATE INDEX IF NOT EXISTS idx_game_players_game ON game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_game_players_player ON game_players(player_id);
CREATE INDEX IF NOT EXISTS idx_game_players_player_created ON game_players(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_players_winners ON game_players(player_id, is_winner) WHERE is_winner = true;
CREATE INDEX IF NOT EXISTS idx_game_players_finish_rank ON game_players(game_id, finish_rank) WHERE finish_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_game_players_order ON game_players(game_id, player_order);

-- Turns
CREATE INDEX IF NOT EXISTS idx_turns_game_player ON turns(game_player_id);
CREATE INDEX IF NOT EXISTS idx_turns_game_player_turn ON turns(game_player_id, turn_number);
CREATE INDEX IF NOT EXISTS idx_turns_180s ON turns(turn_total) WHERE turn_total = 180;
CREATE INDEX IF NOT EXISTS idx_turns_140_plus ON turns(turn_total) WHERE turn_total >= 140;
CREATE INDEX IF NOT EXISTS idx_turns_checkouts ON turns(game_player_id, is_successful_checkout) WHERE is_successful_checkout = true;
CREATE INDEX IF NOT EXISTS idx_turns_created_at ON turns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_turns_dart_scores ON turns USING GIN (dart_scores);

-- Tournaments
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_device_id ON tournaments(device_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_created_at ON tournaments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_player ON tournament_participants(player_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_status ON tournament_matches(status);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_round ON tournament_matches(tournament_id, round);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_game ON tournament_matches(game_id);

-- Leagues
CREATE INDEX IF NOT EXISTS idx_leagues_status ON leagues(status);
CREATE INDEX IF NOT EXISTS idx_leagues_device_id ON leagues(device_id);
CREATE INDEX IF NOT EXISTS idx_leagues_created_at ON leagues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_league_participants_league ON league_participants(league_id);
CREATE INDEX IF NOT EXISTS idx_league_participants_player ON league_participants(player_id);
CREATE INDEX IF NOT EXISTS idx_league_participants_points ON league_participants(league_id, points DESC);
CREATE INDEX IF NOT EXISTS idx_league_matches_league ON league_matches(league_id);
CREATE INDEX IF NOT EXISTS idx_league_matches_status ON league_matches(status);
CREATE INDEX IF NOT EXISTS idx_league_matches_game ON league_matches(game_id);

-- ============================================================================
-- TRIGGER FUNCTIONS
-- ============================================================================

-- Validate turn data before insert
CREATE OR REPLACE FUNCTION validate_turn_data()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.turn_total != (SELECT SUM(dart) FROM unnest(NEW.dart_scores) dart) THEN
    RAISE EXCEPTION 'Turn total (%) does not match sum of dart scores (%)',
      NEW.turn_total, (SELECT SUM(dart) FROM unnest(NEW.dart_scores) dart);
  END IF;
  IF NOT NEW.is_busted THEN
    IF NEW.score_after != (NEW.score_before - NEW.turn_total) THEN
      RAISE EXCEPTION 'Score calculation mismatch: % - % != %',
        NEW.score_before, NEW.turn_total, NEW.score_after;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_turn_data
BEFORE INSERT ON turns FOR EACH ROW EXECUTE FUNCTION validate_turn_data();

-- Timestamp triggers
CREATE OR REPLACE FUNCTION update_game_timestamp()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_update_game_timestamp BEFORE UPDATE ON games FOR EACH ROW EXECUTE FUNCTION update_game_timestamp();

CREATE OR REPLACE FUNCTION update_player_timestamp()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_update_player_timestamp BEFORE UPDATE ON players FOR EACH ROW EXECUTE FUNCTION update_player_timestamp();

CREATE OR REPLACE FUNCTION update_game_player_timestamp()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_update_game_player_timestamp BEFORE UPDATE ON game_players FOR EACH ROW EXECUTE FUNCTION update_game_player_timestamp();

CREATE OR REPLACE FUNCTION update_tournament_timestamp()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_update_tournament_timestamp BEFORE UPDATE ON tournaments FOR EACH ROW EXECUTE FUNCTION update_tournament_timestamp();
CREATE TRIGGER trigger_update_tournament_match_timestamp BEFORE UPDATE ON tournament_matches FOR EACH ROW EXECUTE FUNCTION update_tournament_timestamp();

CREATE OR REPLACE FUNCTION update_league_timestamp()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_update_league_timestamp BEFORE UPDATE ON leagues FOR EACH ROW EXECUTE FUNCTION update_league_timestamp();
CREATE TRIGGER trigger_update_league_participant_timestamp BEFORE UPDATE ON league_participants FOR EACH ROW EXECUTE FUNCTION update_league_timestamp();
CREATE TRIGGER trigger_update_league_match_timestamp BEFORE UPDATE ON league_matches FOR EACH ROW EXECUTE FUNCTION update_league_timestamp();

-- League standings auto-update
CREATE OR REPLACE FUNCTION update_league_standings()
RETURNS TRIGGER AS $$
DECLARE v_league leagues%ROWTYPE;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT * INTO v_league FROM leagues WHERE id = NEW.league_id;
    UPDATE league_participants SET
      matches_played = matches_played + 1,
      wins = wins + CASE WHEN NEW.winner_id = NEW.player1_id THEN 1 ELSE 0 END,
      draws = draws + CASE WHEN NEW.is_draw THEN 1 ELSE 0 END,
      losses = losses + CASE WHEN NEW.winner_id = NEW.player2_id THEN 1 ELSE 0 END,
      points = points + CASE
        WHEN NEW.winner_id = NEW.player1_id THEN v_league.points_for_win
        WHEN NEW.is_draw THEN v_league.points_for_draw ELSE v_league.points_for_loss END,
      updated_at = NOW()
    WHERE league_id = NEW.league_id AND player_id = NEW.player1_id;
    UPDATE league_participants SET
      matches_played = matches_played + 1,
      wins = wins + CASE WHEN NEW.winner_id = NEW.player2_id THEN 1 ELSE 0 END,
      draws = draws + CASE WHEN NEW.is_draw THEN 1 ELSE 0 END,
      losses = losses + CASE WHEN NEW.winner_id = NEW.player1_id THEN 1 ELSE 0 END,
      points = points + CASE
        WHEN NEW.winner_id = NEW.player2_id THEN v_league.points_for_win
        WHEN NEW.is_draw THEN v_league.points_for_draw ELSE v_league.points_for_loss END,
      updated_at = NOW()
    WHERE league_id = NEW.league_id AND player_id = NEW.player2_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_league_standings
AFTER INSERT OR UPDATE ON league_matches FOR EACH ROW EXECUTE FUNCTION update_league_standings();

-- ============================================================================
-- VIEWS (V022 — view-based stats)
-- ============================================================================

CREATE OR REPLACE VIEW player_stats AS
SELECT
    p.id, p.name, p.created_at, p.updated_at, p.is_deleted,
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
    ROUND(CASE WHEN COUNT(gp.id) FILTER (WHERE g.completed_at IS NOT NULL) > 0
          THEN (COUNT(gp.id) FILTER (WHERE gp.is_winner = true AND g.completed_at IS NOT NULL))::numeric
               / COUNT(gp.id) FILTER (WHERE g.completed_at IS NOT NULL) * 100
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

CREATE OR REPLACE VIEW player_leaderboard AS
SELECT *,
  ROW_NUMBER() OVER (ORDER BY total_games_won DESC, win_rate DESC, total_games_played DESC) as rank_by_wins,
  ROW_NUMBER() OVER (ORDER BY win_rate DESC, total_games_played DESC) as rank_by_win_rate,
  ROW_NUMBER() OVER (ORDER BY avg_per_turn DESC, total_turns DESC) as rank_by_avg,
  ROW_NUMBER() OVER (ORDER BY total_180s DESC, total_darts_thrown DESC) as rank_by_180s,
  ROW_NUMBER() OVER (ORDER BY checkout_percentage DESC, total_checkout_attempts DESC) as rank_by_checkout
FROM player_stats
WHERE total_games_played > 0;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on players" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on games" ON games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on game_players" ON game_players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on turns" ON turns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on tournaments" ON tournaments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on tournament_participants" ON tournament_participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on tournament_matches" ON tournament_matches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on leagues" ON leagues FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on league_participants" ON league_participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on league_matches" ON league_matches FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON players TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON games TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON game_players TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON turns TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tournaments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tournament_participants TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tournament_matches TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON leagues TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON league_participants TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON league_matches TO anon, authenticated;
GRANT SELECT ON player_stats TO anon, authenticated;
GRANT SELECT ON player_leaderboard TO anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ============================================================================
-- Record as fresh install
-- ============================================================================
INSERT INTO schema_migrations (version, description) VALUES
  ('V001', 'Create base normalized schema'),
  ('V008', 'Create performance indexes'),
  ('V009', 'Add foreign key constraints and computed columns'),
  ('V010', 'Create triggers'),
  ('V013', 'Finalize schema'),
  ('V014', 'Tournament tables'),
  ('V015', 'League tables'),
  ('V018', 'RLS policies for competitions'),
  ('V019', 'Practice mode support'),
  ('V020', 'Player soft delete'),
  ('V022', 'View-based statistics')
ON CONFLICT (version) DO NOTHING;

DO $$ BEGIN RAISE NOTICE 'Fresh schema created successfully'; END $$;
