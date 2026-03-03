/**
 * Storage Module - Supabase Backend with Normalized Schema
 * Updated for normalized database structure (games, players, game_players, turns)
 * Now supports local (localStorage) backend via LocalStorageBackend delegation.
 */

const Storage = (() => {
    let supabase = null;
    let initialized = false;
    let backend = null; // 'supabase' | 'local'

    // ---------- Mode detection ----------

    /**
     * Detect which storage backend to use.
     * Returns 'local' if AppConfig.storage === 'local' or Supabase config is missing.
     */
    function detectStorageMode() {
        if (typeof AppConfig !== 'undefined' && AppConfig.storage === 'local') {
            return 'local';
        }
        // Check if Supabase credentials are present
        if (typeof AppConfig === 'undefined' || !AppConfig.supabase) {
            return 'local';
        }
        const { url, anonKey } = AppConfig.supabase;
        if (!url || !anonKey || url.includes('YOUR_PROJECT')) {
            return 'local';
        }
        return 'supabase';
    }

    function isLocal() {
        return backend === 'local';
    }

    /**
     * Ensure Supabase is initialized
     */
    function ensureInitialized() {
        if (isLocal()) return null;
        if (!supabase) {
            if (!SupabaseClient.isConnected()) {
                console.error('Supabase client not connected - attempting to initialize');
                SupabaseClient.init();
            }
            try {
                supabase = SupabaseClient.getClient();
            } catch (error) {
                console.error('Failed to get Supabase client:', error);
                throw error;
            }
        }
        return supabase;
    }

    /**
     * Initialize storage connection
     */
    async function init() {
        try {
            if (initialized) {
                console.log('Storage already initialized');
                return true;
            }

            backend = detectStorageMode();
            console.log('Storage mode detected:', backend);

            if (isLocal()) {
                const ok = LocalStorageBackend.init();
                initialized = true;
                console.log('✓ Storage initialized (local/offline mode)');
                return ok;
            }

            // Supabase mode
            console.log('Initializing Storage (Supabase)...');
            try {
                supabase = ensureInitialized();
                console.log('Supabase client obtained:', !!supabase);

                // Test connection
                const { error } = await supabase
                    .from('games')
                    .select('id')
                    .limit(1);

                if (error) {
                    console.warn('Database test failed, falling back to local mode:', error);
                    backend = 'local';
                    supabase = null;
                    LocalStorageBackend.init();
                    initialized = true;
                    return true;
                }
            } catch (connError) {
                console.warn('Supabase connection failed, falling back to local mode:', connError);
                backend = 'local';
                supabase = null;
                LocalStorageBackend.init();
                initialized = true;
                return true;
            }

            initialized = true;
            console.log('✓ Storage initialized successfully (normalized schema)');
            console.log('✓ Storage.sb available:', !!supabase);
            return true;
        } catch (error) {
            console.error('Storage initialization error:', error);
            // Last resort fallback
            backend = 'local';
            supabase = null;
            LocalStorageBackend.init();
            initialized = true;
            return true;
        }
    }

    // =========================================================================
    // Supabase-mode implementations (unchanged from original)
    // =========================================================================

    async function _getGames(limit = null, filters = {}) {
        try {
            const sb = ensureInitialized();
            let query = sb
                .from('games')
                .select(`
                    *,
                    winner:players!winner_id(id, name),
                    game_players(
                        id,
                        player_order,
                        starting_score,
                        final_score,
                        is_winner,
                        finish_rank,
                        finish_round,
                        total_turns,
                        total_darts,
                        total_score,
                        max_dart,
                        max_turn,
                        avg_per_turn,
                        player:players(id, name)
                    )
                `)
                .order('created_at', { ascending: false });

            // Filter out practice games by default
            if (filters.includePractice !== true) {
                query = query.or('is_practice.is.null,is_practice.eq.false');
            }

            if (limit !== null && limit > 0) {
                query = query.limit(limit);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching games:', error);
                throw error;
            }

            return (data || []).map(transformGameFromDB);
        } catch (error) {
            console.error('getGames error:', error);
            return [];
        }
    }

    async function _getGamesPaginated(page = 1, perPage = 20, filters = {}) {
        try {
            const sb = ensureInitialized();
            const offset = (page - 1) * perPage;

            let query;
            if (filters.playerName) {
                const { data: playerData } = await sb
                    .from('players')
                    .select('id')
                    .eq('name', filters.playerName)
                    .maybeSingle();

                if (!playerData) {
                    return { games: [], pagination: { page: 1, perPage, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
                }

                query = sb
                    .from('games')
                    .select(`
                        *,
                        winner:players!winner_id(id, name),
                        game_players!inner(player_id),
                        all_players:game_players(
                            id, player_order, starting_score, final_score, is_winner,
                            finish_rank, finish_round, total_turns, total_darts,
                            total_score, max_dart, max_turn, avg_per_turn,
                            player:players(id, name)
                        )
                    `, { count: 'exact' })
                    .eq('game_players.player_id', playerData.id);
            } else {
                query = sb
                    .from('games')
                    .select(`
                        *,
                        winner:players!winner_id(id, name),
                        game_players(
                            id, player_order, starting_score, final_score, is_winner,
                            finish_rank, finish_round, total_turns, total_darts,
                            total_score, max_dart, max_turn, avg_per_turn,
                            player:players(id, name)
                        )
                    `, { count: 'exact' });
            }

            // --- Apply consistent filters to both paths ---
            
            // Practice filter: If true/false, strictly filter. If null/undefined, show both.
            if (filters.includePractice === true) {
                query = query.eq('is_practice', true);
            } else if (filters.includePractice === false) {
                query = query.eq('is_practice', false);
            }

            // Completion filter:
            // Completion filter:
            // - If showIncomplete is true, strictly show ONLY incomplete
            // - If completed is true, strictly show ONLY completed
            // - If completed is false, strictly show ONLY incomplete
            // - If both are null/undefined (default), show EVERYTHING
            if (filters.showIncomplete === true || filters.completed === false) {
                query = query.is('completed_at', null);
            } else if (filters.completed === true || filters.showIncomplete === false) {
                query = query.not('completed_at', 'is', null);
            }
            // If both are undefined, no filter is applied (shows all)

            if (filters.active !== undefined) {
                query = query.eq('is_active', filters.active);
            }

            if (filters.deviceId) {
                query = query.eq('device_id', filters.deviceId);
            }

            const sortOrder = filters.sortOrder || 'newest';
            query = query.order('created_at', { ascending: sortOrder === 'oldest' });

            const { data, count, error } = await query.range(offset, offset + perPage - 1);

            if (error) {
                console.error('Error fetching paginated games:', error);
                throw error;
            }

            return {
                games: (data || []).map(transformGameFromDB),
                pagination: {
                    page,
                    perPage,
                    total: count || 0,
                    totalPages: Math.ceil((count || 0) / perPage),
                    hasNext: offset + perPage < (count || 0),
                    hasPrev: page > 1
                }
            };
        } catch (error) {
            console.error('getGamesPaginated error:', error);
            return {
                games: [],
                pagination: { page: 1, perPage, total: 0, totalPages: 0, hasNext: false, hasPrev: false }
            };
        }
    }

    function calculateCurrentPlayerIndex(sortedGamePlayers, players) {
        const activePlayers = sortedGamePlayers
            .map((gp, index) => ({
                index,
                turnCount: gp.total_turns || (gp.turns ? gp.turns.length : 0),
                isFinished: gp.is_winner || gp.finish_rank != null
            }))
            .filter(p => !p.isFinished);

        if (activePlayers.length === 0) return 0;

        const minTurns = Math.min(...activePlayers.map(p => p.turnCount));
        const nextPlayer = activePlayers.find(p => p.turnCount === minTurns);
        return nextPlayer ? nextPlayer.index : 0;
    }

    function transformGameFromDB(dbGame) {
        // Use all_players if available (from paginated search), otherwise game_players
        const rawPlayers = dbGame.all_players || dbGame.game_players || [];
        
        const sortedGamePlayers = rawPlayers
            .sort((a, b) => a.player_order - b.player_order);

        const players = sortedGamePlayers.map(gp => ({
                id: gp.id,
                name: gp.player?.name || 'Unknown',
                startingScore: gp.starting_score,
                currentScore: gp.final_score,
                winner: gp.is_winner,
                finish_rank: gp.finish_rank,
                finish_round: gp.finish_round,
                turns: [],
                totalTurns: gp.total_turns || 0,
                stats: {
                    totalDarts: gp.total_darts,
                    totalScore: gp.total_score,
                    totalTurns: gp.total_turns || 0,
                    avgPerTurn: gp.avg_per_turn || (gp.total_turns > 0 ? (gp.total_score / gp.total_turns).toFixed(2) : 0),
                    avgPerDart: gp.total_darts > 0 ? (gp.total_score / gp.total_darts).toFixed(2) : 0,
                    maxTurn: gp.max_turn,
                    maxDart: gp.max_dart,
                    checkoutAttempts: 0,
                    checkoutSuccess: 0
                }
            }));

        const currentPlayerIndex = (dbGame.current_player_index !== undefined && dbGame.current_player_index !== null)
            ? dbGame.current_player_index
            : calculateCurrentPlayerIndex(sortedGamePlayers, players);

        return {
            id: dbGame.id,
            created_at: dbGame.created_at,
            completed_at: dbGame.completed_at,
            game_type: dbGame.game_type,
            win_condition: dbGame.win_condition,
            scoring_mode: dbGame.scoring_mode,
            current_player_index: currentPlayerIndex,
            current_turn: dbGame.current_turn,
            is_active: dbGame.is_active,
            is_practice: dbGame.is_practice || false,
            device_id: dbGame.device_id,
            players: players
        };
    }

    async function _saveGame(game) {
        try {
            const sb = ensureInitialized();

            const playerIds = [];
            for (const player of game.players) {
                const playerData = await _getOrCreatePlayer(player.name);
                playerIds.push(playerData.id);
            }

            const { data: gameData, error: gameError } = await sb
                .from('games')
                .insert([{
                    id: game.id,
                    created_at: game.created_at,
                    game_type: game.game_type,
                    win_condition: game.win_condition,
                    scoring_mode: game.scoring_mode,
                    is_active: game.is_active,
                    is_practice: game.is_practice || false,
                    current_turn: game.current_turn,
                    device_id: game.device_id,
                    total_players: game.players.length
                }])
                .select();

            if (gameError) {
                console.error('Error inserting game:', gameError);
                throw gameError;
            }

            const gamePlayersData = game.players.map((p, i) => ({
                game_id: game.id,
                player_id: playerIds[i],
                player_order: i,
                starting_score: p.startingScore,
                final_score: p.currentScore,
                is_winner: p.winner || false,
                finish_rank: p.finish_rank,
                finish_round: p.finish_round,
                total_turns: p.turns.length,
                total_darts: p.stats.totalDarts,
                total_score: p.stats.totalScore,
                max_dart: p.stats.maxDart,
                max_turn: p.stats.maxTurn,
                count_180s: countScoresInRange(p.turns, 100, Infinity),
                count_140_plus: countScoresInRange(p.turns, 140, Infinity),
                checkout_attempts: p.stats.checkoutAttempts || 0,
                checkout_successes: p.stats.checkoutSuccess || 0
            }));

            const { data: gpData, error: gpError } = await sb
                .from('game_players')
                .insert(gamePlayersData)
                .select();

            if (gpError) {
                console.error('Error inserting game_players:', gpError);
                throw gpError;
            }

            const turnsData = [];
            game.players.forEach((p, pIdx) => {
                const gamePlayerId = gpData[pIdx].id;
                p.turns.forEach((turn, tIdx) => {
                    turnsData.push({
                        game_player_id: gamePlayerId,
                        turn_number: tIdx + 1,
                        round_number: Math.floor(tIdx / game.players.length),
                        dart_scores: turn.darts,
                        score_before: tIdx === 0 ? p.startingScore : (p.turns[tIdx - 1]?.remaining || p.startingScore),
                        score_after: turn.remaining,
                        turn_total: turn.darts.reduce((a, b) => a + b, 0),
                        is_busted: turn.busted || false,
                        is_checkout_attempt: turn.remaining === 0 || turn.remaining < 0,
                        is_successful_checkout: turn.remaining === 0 && !turn.busted,
                        created_at: turn.timestamp ? new Date(turn.timestamp).toISOString() : new Date().toISOString()
                    });
                });
            });

            if (turnsData.length > 0) {
                const { error: turnsError } = await sb
                    .from('turns')
                    .insert(turnsData);

                if (turnsError) {
                    console.error('Error inserting turns:', turnsError);
                }
            }

            console.log(`✓ Game saved: ${game.players.length} players, ${turnsData.length} turns`);
            return gameData ? gameData[0] : game;
        } catch (error) {
            console.error('saveGame error:', error);
            throw error;
        }
    }

    function countScoresInTurns(turns, targetScore) {
        return turns.filter(turn =>
            turn.darts.reduce((a, b) => a + b, 0) === targetScore
        ).length;
    }

    function countScoresInRange(turns, min, max) {
        return turns.filter(turn => {
            const total = turn.darts.reduce((a, b) => a + b, 0);
            return total >= min && total <= max;
        }).length;
    }

    async function _updateGame(gameId, updates) {
        try {
            const sb = ensureInitialized();

            const gameUpdates = {
                completed_at: updates.completed_at,
                is_active: updates.is_active,
                current_turn: updates.current_turn,
                updated_at: new Date().toISOString()
            };

            if (updates.completed_at && updates.players) {
                console.log('=== updateGame Winner Detection DEBUG ===');
                // Priority 1: finish_rank === 1
                let winner = updates.players.find(p => p.finish_rank === 1);
                // Priority 2: winner property is true
                if (!winner) winner = updates.players.find(p => p.winner === true);
                // Priority 3: fallback to lowest score
                if (!winner) {
                    const sorted = [...updates.players].sort((a, b) =>
                        (a.currentScore || a.score || 0) - (b.currentScore || b.score || 0)
                    );
                    winner = sorted[0];
                }

                if (winner) {
                    console.log(`  Detected winner: ${winner.name}`);
                    const { data: playerData } = await sb
                        .from('players')
                        .select('id')
                        .eq('name', winner.name)
                        .single();

                    if (playerData) {
                        gameUpdates.winner_id = playerData.id;
                        console.log(`  Set winner_id to: ${playerData.id}`);
                    }
                }
            }

            if (updates.players) {
                await _updateGamePlayers(gameId, updates.players);
            }

            const { data, error } = await sb
                .from('games')
                .update(gameUpdates)
                .eq('id', gameId)
                .select();

            if (error) {
                console.error('Error updating game:', error);
                throw error;
            }

            return data ? data[0] : null;
        } catch (error) {
            console.error('updateGame error:', error);
            throw error;
        }
    }

    async function _updateGamePlayers(gameId, players) {
        try {
            const sb = ensureInitialized();

            const { data: existingGP } = await sb
                .from('game_players')
                .select('id, player:players(name)')
                .eq('game_id', gameId);

            if (!existingGP) return;

            for (const player of players) {
                const gp = existingGP.find(g => g.player.name === player.name);
                if (!gp) continue;

                const isActualWinner = player.finish_rank === 1;
                const count100Plus = countScoresInRange(player.turns, 100, Infinity);
                const count140Plus = countScoresInRange(player.turns, 140, Infinity);

                await sb
                    .from('game_players')
                    .update({
                        final_score: player.currentScore,
                        is_winner: isActualWinner,
                        finish_rank: player.finish_rank,
                        finish_round: player.finish_round,
                        total_turns: player.turns.length,
                        total_darts: player.stats.totalDarts,
                        total_score: player.stats.totalScore,
                        max_dart: player.stats.maxDart,
                        max_turn: player.stats.maxTurn,
                        count_180s: count100Plus,
                        count_140_plus: count140Plus,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', gp.id);

                const { data: existingTurns } = await sb
                    .from('turns')
                    .select('turn_number')
                    .eq('game_player_id', gp.id);

                const existingTurnNumbers = new Set((existingTurns || []).map(t => t.turn_number));

                const newTurns = player.turns
                    .map((turn, idx) => ({ turn, number: idx + 1 }))
                    .filter(({ number }) => !existingTurnNumbers.has(number))
                    .map(({ turn, number }) => ({
                        game_player_id: gp.id,
                        turn_number: number,
                        round_number: Math.floor((number - 1) / players.length),
                        dart_scores: turn.darts,
                        score_before: number === 1 ? player.startingScore : (player.turns[number - 2]?.remaining || player.startingScore),
                        score_after: turn.remaining,
                        turn_total: turn.darts.reduce((a, b) => a + b, 0),
                        is_busted: turn.busted || false,
                        is_checkout_attempt: turn.remaining === 0 || turn.remaining < 0,
                        is_successful_checkout: turn.remaining === 0 && !turn.busted,
                        created_at: turn.timestamp ? new Date(turn.timestamp).toISOString() : new Date().toISOString()
                    }));

                if (newTurns.length > 0) {
                    await sb.from('turns').insert(newTurns);
                }
            }
        } catch (error) {
            console.error('updateGamePlayers error:', error);
        }
    }

    async function _getGame(gameId) {
        try {
            const sb = ensureInitialized();
            const { data, error } = await sb
                .from('games')
                .select(`
                    *,
                    winner:players!winner_id(id, name),
                    game_players(
                        id,
                        player_order,
                        starting_score,
                        final_score,
                        is_winner,
                        finish_rank,
                        finish_round,
                        total_turns,
                        total_darts,
                        total_score,
                        max_dart,
                        max_turn,
                        avg_per_turn,
                        player:players(id, name),
                        turns(
                            turn_number,
                            dart_scores,
                            score_after,
                            is_busted,
                            created_at
                        )
                    )
                `)
                .eq('id', gameId)
                .single();

            if (error) {
                console.error('Error fetching game:', error);
                throw error;
            }

            return transformGameWithTurns(data);
        } catch (error) {
            console.error('getGame error:', error);
            return null;
        }
    }

    function transformGameWithTurns(dbGame) {
        // Use all_players if available (from paginated search), otherwise game_players
        const rawPlayers = dbGame.all_players || dbGame.game_players || [];

        const sortedGamePlayers = rawPlayers
            .sort((a, b) => a.player_order - b.player_order);

        const players = sortedGamePlayers.map(gp => {
                const turns = (gp.turns || [])
                    .sort((a, b) => a.turn_number - b.turn_number)
                    .map(t => ({
                        darts: t.dart_scores,
                        remaining: t.score_after,
                        busted: t.is_busted,
                        timestamp: new Date(t.created_at).getTime()
                    }));

                return {
                    id: gp.id,
                    name: gp.player?.name || 'Unknown',
                    startingScore: gp.starting_score,
                    currentScore: gp.final_score,
                    winner: gp.is_winner,
                    finish_rank: gp.finish_rank,
                    finish_round: gp.finish_round,
                    turns: turns,
                    stats: {
                        totalDarts: gp.total_darts,
                        totalScore: gp.total_score,
                        totalTurns: gp.total_turns || 0,
                        avgPerTurn: gp.avg_per_turn || (gp.total_turns > 0 ? (gp.total_score / gp.total_turns).toFixed(2) : 0),
                        avgPerDart: gp.total_darts > 0 ? (gp.total_score / gp.total_darts).toFixed(2) : 0,
                        maxTurn: gp.max_turn,
                        maxDart: gp.max_dart,
                        checkoutAttempts: 0,
                        checkoutSuccess: 0
                    }
                };
            });

        const currentPlayerIndex = (dbGame.current_player_index !== undefined && dbGame.current_player_index !== null)
            ? dbGame.current_player_index
            : calculateCurrentPlayerIndex(sortedGamePlayers, players);

        return {
            id: dbGame.id,
            created_at: dbGame.created_at,
            completed_at: dbGame.completed_at,
            game_type: dbGame.game_type,
            win_condition: dbGame.win_condition,
            scoring_mode: dbGame.scoring_mode,
            current_player_index: currentPlayerIndex,
            current_turn: dbGame.current_turn,
            is_active: dbGame.is_active,
            is_practice: dbGame.is_practice || false,
            device_id: dbGame.device_id,
            players: players
        };
    }

    async function _getGameCompetitionContext(gameId) {
        try {
            const sb = ensureInitialized();
            const { data: tournamentMatch } = await sb
                .from('tournament_matches')
                .select('id, tournament_id')
                .eq('game_id', gameId)
                .maybeSingle();

            if (tournamentMatch) {
                return {
                    type: 'tournament',
                    tournament_id: tournamentMatch.tournament_id,
                    tournament_match_id: tournamentMatch.id
                };
            }

            const { data: leagueMatch } = await sb
                .from('league_matches')
                .select('id, league_id')
                .eq('game_id', gameId)
                .maybeSingle();

            if (leagueMatch) {
                return {
                    type: 'league',
                    league_id: leagueMatch.league_id,
                    league_match_id: leagueMatch.id
                };
            }

            return null;
        } catch (error) {
            console.error('getGameCompetitionContext error:', error);
            return null;
        }
    }

    async function _deleteGame(gameId) {
        try {
            const sb = ensureInitialized();
            const { error } = await sb
                .from('games')
                .delete()
                .eq('id', gameId);

            if (error) {
                console.error('Error deleting game:', error);
                throw error;
            }

            console.log('✓ Game deleted (cascaded to game_players and turns)');
            return true;
        } catch (error) {
            console.error('deleteGame error:', error);
            UI.showToast('Failed to delete game', 'error');
            return false;
        }
    }

    async function _addPlayer(name) {
        try {
            const sb = ensureInitialized();
            const { data, error } = await sb
                .from('players')
                .insert([{ id: generateUUID(), name: name, created_at: new Date().toISOString() }])
                .select();
            if (error) {
                if (error.code === '23505') {
                    return { error: 'A player with this name already exists' };
                }
                return { error: error.message };
            }
            return { data: data[0] };
        } catch (e) {
            return { error: e.message };
        }
    }

    async function _deletePlayer(id) {
        try {
            const sb = ensureInitialized();
            const { error } = await sb
                .from('players')
                .update({ is_deleted: true, updated_at: new Date().toISOString() })
                .eq('id', id);
            if (error) return { error: error.message };
            return { success: true };
        } catch (e) {
            return { error: e.message };
        }
    }

    async function _restorePlayer(id) {
        try {
            const sb = ensureInitialized();
            const { error } = await sb
                .from('players')
                .update({ is_deleted: false, updated_at: new Date().toISOString() })
                .eq('id', id);
            if (error) return { error: error.message };
            return { success: true };
        } catch (e) {
            return { error: e.message };
        }
    }

    async function _getDeletedPlayers() {
        try {
            const sb = ensureInitialized();
            const { data, error } = await sb
                .from('players')
                .select('*')
                .eq('is_deleted', true)
                .order('name');
            if (error) return [];
            return data || [];
        } catch (e) {
            return [];
        }
    }

    async function _renamePlayer(id, newName) {
        try {
            const sb = ensureInitialized();
            const { data, error } = await sb
                .from('players')
                .update({ name: newName })
                .eq('id', id)
                .select();
            if (error) {
                if (error.code === '23505') {
                    return { error: 'A player with this name already exists' };
                }
                return { error: error.message };
            }
            if (!data || data.length === 0) {
                return { error: 'Player not found' };
            }
            return { data: data[0] };
        } catch (e) {
            return { error: e.message };
        }
    }

    async function _getPlayers() {
        try {
            const sb = ensureInitialized();
            // Use player_stats view instead of players table (already filters deleted)
            const { data, error } = await sb
                .from('player_stats')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching players:', error);
                throw error;
            }

            const playersObj = {};
            (data || []).forEach(player => {
                playersObj[player.name] = player;
            });

            return playersObj;
        } catch (error) {
            console.error('getPlayers error:', error);
            return {};
        }
    }

    async function _getOrCreatePlayer(playerName) {
        try {
            const sb = ensureInitialized();

            const { data: existing, error: fetchError } = await sb
                .from('players')
                .select('*')
                .eq('name', playerName)
                .single();

            if (!fetchError && existing) {
                return existing;
            }

            const newPlayer = {
                id: generateUUID(),
                name: playerName,
                created_at: new Date().toISOString()
            };

            const { data: created, error: insertError } = await sb
                .from('players')
                .insert([newPlayer])
                .select();

            if (insertError) {
                console.error('Error creating player:', insertError);
                throw insertError;
            }

            return created ? created[0] : newPlayer;
        } catch (error) {
            console.error('getOrCreatePlayer error:', error);
            return { id: generateUUID(), name: playerName };
        }
    }

    async function _getPlayerGames(playerName, limit = 50) {
        try {
            const sb = ensureInitialized();

            const { data: playerData } = await sb
                .from('players')
                .select('id')
                .eq('name', playerName)
                .single();

            if (!playerData) return [];

            const { data, error } = await sb
                .from('game_players')
                .select(`
                    game:games!inner(
                        *,
                        winner:players!winner_id(id, name),
                        game_players(
                            id,
                            player_order,
                            starting_score,
                            final_score,
                            is_winner,
                            finish_rank,
                            total_turns,
                            total_darts,
                            total_score,
                            avg_per_turn,
                            player:players(id, name)
                        )
                    )
                `)
                .eq('player_id', playerData.id)
                .or('is_practice.is.null,is_practice.eq.false', { foreignTable: 'games' })
                .gt('total_turns', 0)
                .order('created_at', { referencedTable: 'games', ascending: false })
                .limit(limit);

            if (error) {
                console.error('Error fetching player games:', error);
                throw error;
            }

            return (data || []).map(gp => transformGameFromDB(gp.game));
        } catch (error) {
            console.error('getPlayerGames error:', error);
            return [];
        }
    }

    async function _getAllPlayerGames(playerName) {
        try {
            const sb = ensureInitialized();
            const { data: playerData } = await sb
                .from('players')
                .select('id')
                .eq('name', playerName)
                .single();

            if (!playerData) return [];

            const { data, error } = await sb
                .from('game_players')
                .select(`
                    game:games(
                        *,
                        game_players(
                            *,
                            player:players(id, name),
                            turns(turn_total)
                        )
                    )
                `)
                .eq('player_id', playerData.id)
                .order('created_at', { ascending: false, foreignTable: 'games' });

            if (error) throw error;
            return (data || []).map(gp => gp.game).filter(Boolean);
        } catch (error) {
            console.error('getAllPlayerGames error:', error);
            return [];
        }
    }

    async function _exportData() {
        try {
            const games = await getGames();
            const players = await getPlayers();
            return {
                version: '2.0.0',
                exportDate: new Date().toISOString(),
                games: games,
                players: players
            };
        } catch (error) {
            console.error('Export error:', error);
            throw error;
        }
    }

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // ============================================================================
    // TOURNAMENT STORAGE OPERATIONS (Supabase)
    // ============================================================================

    async function _saveTournament(tournament) {
        try {
            const sb = ensureInitialized();
            const { data, error } = await sb
                .from('tournaments')
                .insert([{
                    id: tournament.id, name: tournament.name, created_at: tournament.created_at,
                    status: tournament.status, format: tournament.format, game_type: tournament.game_type,
                    win_condition: tournament.win_condition, scoring_mode: tournament.scoring_mode,
                    max_players: tournament.max_players, device_id: tournament.device_id
                }])
                .select();
            if (error) throw error;
            return data ? data[0] : tournament;
        } catch (error) { console.error('saveTournament error:', error); throw error; }
    }

    async function _getTournaments(filters = {}) {
        try {
            const sb = ensureInitialized();
            let query = sb.from('tournaments').select(`
                *, winner:players!winner_id(id, name),
                tournament_participants(id, bracket_position, eliminated, final_placement, player:players(id, name)),
                tournament_matches(id, round, match_number, status, player1:players!player1_id(id, name), player2:players!player2_id(id, name), match_winner:players!winner_id(id, name))
            `).order('created_at', { ascending: false });
            if (filters.status) query = query.eq('status', filters.status);
            if (filters.deviceId) query = query.eq('device_id', filters.deviceId);
            const { data, error } = await query;
            if (error) throw error;
            return (data || []).map(transformTournamentFromDB);
        } catch (error) { console.error('getTournaments error:', error); return []; }
    }

    async function _getTournament(tournamentId) {
        try {
            const sb = ensureInitialized();
            const { data, error } = await sb.from('tournaments').select(`
                *, winner:players!winner_id(id, name),
                tournament_participants(id, bracket_position, eliminated, eliminated_in_round, final_placement, player:players(id, name)),
                tournament_matches(id, round, match_number, status, game_id, winner_next_match_id, loser_next_match_id, player1:players!player1_id(id, name), player2:players!player2_id(id, name), match_winner:players!winner_id(id, name))
            `).eq('id', tournamentId).single();
            if (error) throw error;
            return transformTournamentFromDB(data);
        } catch (error) { console.error('getTournament error:', error); return null; }
    }

    function transformTournamentFromDB(dbTournament) {
        if (!dbTournament) return null;
        return {
            id: dbTournament.id, name: dbTournament.name, created_at: dbTournament.created_at,
            updated_at: dbTournament.updated_at, status: dbTournament.status, format: dbTournament.format,
            game_type: dbTournament.game_type, win_condition: dbTournament.win_condition,
            scoring_mode: dbTournament.scoring_mode, max_players: dbTournament.max_players,
            device_id: dbTournament.device_id, winner_id: dbTournament.winner_id,
            winner_name: dbTournament.winner?.name,
            participants: (dbTournament.tournament_participants || []).map(tp => ({
                id: tp.id, player_id: tp.player?.id, name: tp.player?.name || 'Unknown',
                bracket_position: tp.bracket_position, eliminated: tp.eliminated,
                eliminated_in_round: tp.eliminated_in_round, final_placement: tp.final_placement
            })),
            matches: (dbTournament.tournament_matches || []).map(tm => ({
                id: tm.id, tournament_id: dbTournament.id, round: tm.round, match_number: tm.match_number,
                player1_id: tm.player1?.id, player1_name: tm.player1?.name,
                player2_id: tm.player2?.id, player2_name: tm.player2?.name,
                winner_id: tm.match_winner?.id, winner_name: tm.match_winner?.name,
                status: tm.status, game_id: tm.game_id,
                winner_next_match_id: tm.winner_next_match_id, loser_next_match_id: tm.loser_next_match_id
            }))
        };
    }

    async function _updateTournament(tournamentId, updates) {
        try {
            const sb = ensureInitialized();
            const u = { status: updates.status, updated_at: new Date().toISOString() };
            if (updates.winner_name) {
                const { data: p } = await sb.from('players').select('id').eq('name', updates.winner_name).single();
                if (p) u.winner_id = p.id;
            }
            const { data, error } = await sb.from('tournaments').update(u).eq('id', tournamentId).select();
            if (error) throw error;
            return data ? data[0] : null;
        } catch (error) { console.error('updateTournament error:', error); throw error; }
    }

    async function _saveTournamentParticipants(tournamentId, participants) {
        try {
            const sb = ensureInitialized();
            const rows = [];
            for (const p of participants) {
                const player = await _getOrCreatePlayer(p.name);
                rows.push({ tournament_id: tournamentId, player_id: player.id, bracket_position: p.bracket_position, eliminated: p.eliminated || false, eliminated_in_round: p.eliminated_in_round, final_placement: p.final_placement });
            }
            const { data, error } = await sb.from('tournament_participants').insert(rows).select();
            if (error) throw error;
            return data;
        } catch (error) { console.error('saveTournamentParticipants error:', error); throw error; }
    }

    async function _saveTournamentMatches(tournamentId, matches) {
        try {
            const sb = ensureInitialized();
            const playerIds = {};
            for (const m of matches) {
                for (const key of ['player1_name', 'player2_name', 'winner_name']) {
                    if (m[key] && !playerIds[m[key]]) { playerIds[m[key]] = (await _getOrCreatePlayer(m[key])).id; }
                }
            }
            const rows = matches.map(m => ({
                id: m.id, tournament_id: tournamentId, round: m.round, match_number: m.match_number,
                player1_id: m.player1_name ? playerIds[m.player1_name] : null,
                player2_id: m.player2_name ? playerIds[m.player2_name] : null,
                winner_id: m.winner_name ? playerIds[m.winner_name] : null,
                status: m.status, game_id: m.game_id,
                winner_next_match_id: m.winner_next_match_id, loser_next_match_id: m.loser_next_match_id
            }));
            const { data, error } = await sb.from('tournament_matches').insert(rows).select();
            if (error) throw error;
            return data;
        } catch (error) { console.error('saveTournamentMatches error:', error); throw error; }
    }

    async function _updateTournamentMatch(matchId, updates) {
        try {
            const sb = ensureInitialized();
            const u = { status: updates.status, game_id: updates.game_id, updated_at: new Date().toISOString() };
            if (updates.player1_id) u.player1_id = updates.player1_id;
            else if (updates.player1_name) { const { data: p } = await sb.from('players').select('id').eq('name', updates.player1_name).single(); if (p) u.player1_id = p.id; }
            if (updates.player2_id) u.player2_id = updates.player2_id;
            else if (updates.player2_name) { const { data: p } = await sb.from('players').select('id').eq('name', updates.player2_name).single(); if (p) u.player2_id = p.id; }
            if (updates.winner_name) { const { data: w } = await sb.from('players').select('id').eq('name', updates.winner_name).single(); if (w) u.winner_id = w.id; }
            const { data, error } = await sb.from('tournament_matches').update(u).eq('id', matchId).select();
            if (error) throw error;
            return data ? data[0] : null;
        } catch (error) { console.error('updateTournamentMatch error:', error); throw error; }
    }

    async function _updateTournamentParticipant(participantId, updates) {
        try {
            const sb = ensureInitialized();
            const { data, error } = await sb.from('tournament_participants')
                .update({ eliminated: updates.eliminated, eliminated_in_round: updates.eliminated_in_round, final_placement: updates.final_placement })
                .eq('id', participantId).select();
            if (error) throw error;
            return data ? data[0] : null;
        } catch (error) { console.error('updateTournamentParticipant error:', error); throw error; }
    }

    async function _deleteTournamentParticipant(tournamentId, playerName) {
        try {
            const sb = ensureInitialized();
            const { data: playerData } = await sb.from('players').select('id').eq('name', playerName).single();
            if (!playerData) return { success: true };
            const { error } = await sb.from('tournament_participants').delete().eq('tournament_id', tournamentId).eq('player_id', playerData.id);
            if (error) throw error;
            return { success: true };
        } catch (error) { console.error('deleteTournamentParticipant error:', error); throw error; }
    }

    async function _clearTournamentParticipants(tournamentId) {
        try {
            const sb = ensureInitialized();
            const { error } = await sb.from('tournament_participants').delete().eq('tournament_id', tournamentId);
            if (error) throw error;
            return { success: true };
        } catch (error) { console.error('clearTournamentParticipants error:', error); throw error; }
    }

    async function _deleteTournament(tournamentId) {
        try {
            const sb = ensureInitialized();
            await sb.from('tournament_matches').delete().eq('tournament_id', tournamentId);
            await sb.from('tournament_participants').delete().eq('tournament_id', tournamentId);
            const { error } = await sb.from('tournaments').delete().eq('id', tournamentId);
            if (error) return { error: error.message };
            return { success: true };
        } catch (e) { return { error: e.message }; }
    }

    // ============================================================================
    // LEAGUE STORAGE OPERATIONS (Supabase)
    // ============================================================================

    async function _saveLeague(league) {
        try {
            const sb = ensureInitialized();
            const { data, error } = await sb.from('leagues').insert([{
                id: league.id, name: league.name, created_at: league.created_at, status: league.status,
                game_type: league.game_type, win_condition: league.win_condition, scoring_mode: league.scoring_mode,
                matches_per_pairing: league.matches_per_pairing, points_for_win: league.points_for_win,
                points_for_draw: league.points_for_draw, points_for_loss: league.points_for_loss,
                device_id: league.device_id
            }]).select();
            if (error) throw error;
            return data ? data[0] : league;
        } catch (error) { console.error('saveLeague error:', error); throw error; }
    }

    async function _getLeagues(filters = {}) {
        try {
            const sb = ensureInitialized();
            let query = sb.from('leagues').select(`
                *, winner:players!winner_id(id, name),
                league_participants(id, matches_played, wins, draws, losses, points, legs_won, legs_lost, player:players(id, name)),
                league_matches(id, status, fixture_round, is_draw, player1:players!player1_id(id, name), player2:players!player2_id(id, name), match_winner:players!winner_id(id, name))
            `).order('created_at', { ascending: false });
            if (filters.status) query = query.eq('status', filters.status);
            if (filters.deviceId) query = query.eq('device_id', filters.deviceId);
            const { data, error } = await query;
            if (error) throw error;
            return (data || []).map(transformLeagueFromDB);
        } catch (error) { console.error('getLeagues error:', error); return []; }
    }

    async function _getLeague(leagueId) {
        try {
            const sb = ensureInitialized();
            const { data, error } = await sb.from('leagues').select(`
                *, winner:players!winner_id(id, name),
                league_participants(id, matches_played, wins, draws, losses, points, legs_won, legs_lost, player:players(id, name)),
                league_matches(id, status, fixture_round, is_draw, game_id, player1:players!player1_id(id, name), player2:players!player2_id(id, name), match_winner:players!winner_id(id, name))
            `).eq('id', leagueId).single();
            if (error) throw error;
            return transformLeagueFromDB(data);
        } catch (error) { console.error('getLeague error:', error); return null; }
    }

    function transformLeagueFromDB(dbLeague) {
        if (!dbLeague) return null;
        return {
            id: dbLeague.id, name: dbLeague.name, created_at: dbLeague.created_at, updated_at: dbLeague.updated_at,
            status: dbLeague.status, game_type: dbLeague.game_type, win_condition: dbLeague.win_condition,
            scoring_mode: dbLeague.scoring_mode, matches_per_pairing: dbLeague.matches_per_pairing,
            points_for_win: dbLeague.points_for_win, points_for_draw: dbLeague.points_for_draw,
            points_for_loss: dbLeague.points_for_loss, device_id: dbLeague.device_id,
            winner_id: dbLeague.winner_id, winner_name: dbLeague.winner?.name,
            participants: (dbLeague.league_participants || []).map(lp => ({
                id: lp.id, player_id: lp.player?.id, name: lp.player?.name || 'Unknown',
                matches_played: lp.matches_played, wins: lp.wins, draws: lp.draws, losses: lp.losses,
                points: lp.points, legs_won: lp.legs_won, legs_lost: lp.legs_lost
            })),
            matches: (dbLeague.league_matches || []).map(lm => ({
                id: lm.id, league_id: dbLeague.id, player1_id: lm.player1?.id, player1_name: lm.player1?.name,
                player2_id: lm.player2?.id, player2_name: lm.player2?.name,
                winner_id: lm.match_winner?.id, winner_name: lm.match_winner?.name,
                is_draw: lm.is_draw, status: lm.status, fixture_round: lm.fixture_round, game_id: lm.game_id
            }))
        };
    }

    async function _updateLeague(leagueId, updates) {
        try {
            const sb = ensureInitialized();
            const u = { status: updates.status, updated_at: new Date().toISOString() };
            if (updates.winner_name) {
                const { data: p } = await sb.from('players').select('id').eq('name', updates.winner_name).single();
                if (p) u.winner_id = p.id;
            }
            const { data, error } = await sb.from('leagues').update(u).eq('id', leagueId).select();
            if (error) throw error;
            return data ? data[0] : null;
        } catch (error) { console.error('updateLeague error:', error); throw error; }
    }

    async function _saveLeagueParticipants(leagueId, participants) {
        try {
            const sb = ensureInitialized();
            const rows = [];
            for (const p of participants) {
                const player = await _getOrCreatePlayer(p.name);
                rows.push({ league_id: leagueId, player_id: player.id, matches_played: p.matches_played || 0, wins: p.wins || 0, draws: p.draws || 0, losses: p.losses || 0, points: p.points || 0, legs_won: p.legs_won || 0, legs_lost: p.legs_lost || 0 });
            }
            const { data, error } = await sb.from('league_participants').insert(rows).select();
            if (error) throw error;
            return data;
        } catch (error) { console.error('saveLeagueParticipants error:', error); throw error; }
    }

    async function _saveLeagueMatches(leagueId, matches) {
        try {
            const sb = ensureInitialized();
            const playerIds = {};
            for (const m of matches) {
                if (m.player1_name && !playerIds[m.player1_name]) playerIds[m.player1_name] = (await _getOrCreatePlayer(m.player1_name)).id;
                if (m.player2_name && !playerIds[m.player2_name]) playerIds[m.player2_name] = (await _getOrCreatePlayer(m.player2_name)).id;
            }
            const rows = matches.map(m => ({
                id: m.id, league_id: leagueId, player1_id: playerIds[m.player1_name], player2_id: playerIds[m.player2_name],
                winner_id: m.winner_name ? playerIds[m.winner_name] : null, is_draw: m.is_draw || false,
                status: m.status, fixture_round: m.fixture_round, game_id: m.game_id
            }));
            const { data, error } = await sb.from('league_matches').insert(rows).select();
            if (error) throw error;
            return data;
        } catch (error) { console.error('saveLeagueMatches error:', error); throw error; }
    }

    async function _updateLeagueMatch(matchId, updates) {
        try {
            const sb = ensureInitialized();
            const u = { status: updates.status, is_draw: updates.is_draw, game_id: updates.game_id, updated_at: new Date().toISOString() };
            if (updates.winner_name) {
                const { data: w } = await sb.from('players').select('id').eq('name', updates.winner_name).single();
                if (w) u.winner_id = w.id;
            } else if (updates.is_draw) { u.winner_id = null; }
            const { data, error } = await sb.from('league_matches').update(u).eq('id', matchId).select();
            if (error) throw error;
            return data ? data[0] : null;
        } catch (error) { console.error('updateLeagueMatch error:', error); throw error; }
    }

    async function _updateLeagueParticipant(participantId, updates) {
        try {
            const sb = ensureInitialized();
            const { data, error } = await sb.from('league_participants')
                .update({ matches_played: updates.matches_played, wins: updates.wins, draws: updates.draws, losses: updates.losses, points: updates.points, legs_won: updates.legs_won, legs_lost: updates.legs_lost })
                .eq('id', participantId).select();
            if (error) throw error;
            return data ? data[0] : null;
        } catch (error) { console.error('updateLeagueParticipant error:', error); throw error; }
    }

    async function _deleteLeague(leagueId) {
        try {
            const sb = ensureInitialized();
            await sb.from('league_matches').delete().eq('league_id', leagueId);
            await sb.from('league_participants').delete().eq('league_id', leagueId);
            const { error } = await sb.from('leagues').delete().eq('id', leagueId);
            if (error) return { error: error.message };
            return { success: true };
        } catch (e) { return { error: e.message }; }
    }

    async function _getActiveGames() {
        try {
            const { games } = await getGamesPaginated(1, 20, { completed: false, active: true });
            return games;
        } catch (error) { console.error('getActiveGames error:', error); return []; }
    }

    // ============================================================================
    // NEW QUERY METHODS (used by refactored stats.js)
    // These work in both modes — Supabase or local.
    // ============================================================================

    async function getPlayerByName(name) {
        if (isLocal()) return LocalStorageBackend.getPlayerByName(name);
        try {
            const sb = ensureInitialized();
            // Use player_stats view instead of players table
            const { data, error } = await sb.from('player_stats').select('*').eq('name', name).single();
            if (error) return null;
            return data;
        } catch (e) { return null; }
    }

    async function getPlayersByNames(names) {
        if (isLocal()) return LocalStorageBackend.getPlayersByNames(names);
        try {
            const sb = ensureInitialized();
            const { data } = await sb.from('players').select('id, name').in('name', names);
            return data || [];
        } catch (e) { return []; }
    }

    async function getPlayerLeaderboard(sortCol, limit) {
        if (isLocal()) return LocalStorageBackend.getPlayerLeaderboard(sortCol, limit);
        try {
            const sb = ensureInitialized();
            // player_leaderboard is now a VIEW, no refresh needed
            let query = sb.from('player_leaderboard').select('*');
            if (sortCol) {
                const ascending = sortCol.startsWith('rank_by_');
                query = query.order(sortCol, { ascending });
            }
            if (limit) query = query.limit(limit);
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        } catch (e) { console.error('getPlayerLeaderboard error:', e); return []; }
    }

    async function getCompletedGamesWithPlayerStats(since) {
        if (isLocal()) return LocalStorageBackend.getCompletedGamesWithPlayerStats(since);
        try {
            const sb = ensureInitialized();
            let query = sb.from('games').select(`
                id, created_at, completed_at,
                game_players!inner(
                    player_id, is_winner, total_darts, total_score, total_turns, max_turn, count_180s, 
                    player:players!inner(id, name, is_deleted)
                )
            `)
            .not('completed_at', 'is', null)
            .eq('is_practice', false);
            
            if (since) query = query.gte('created_at', since);
            const { data, error } = await query;
            
            if (error) {
                console.error('Error fetching time-filtered games:', error);
                return [];
            }
            return data || [];
        } catch (e) { 
            console.error('getCompletedGamesWithPlayerStats error:', e);
            return []; 
        }
    }

    async function getGamePlayersByGameIds(gameIds) {
        if (isLocal()) return LocalStorageBackend.getGamePlayersByGameIds(gameIds);
        try {
            const sb = ensureInitialized();
            const { data } = await sb.from('game_players')
                .select('avg_per_turn, max_turn, game_id, player:players(name)')
                .in('game_id', gameIds);
            return data || [];
        } catch (e) { return []; }
    }

    async function getTurnsForPlayer(playerId) {
        if (isLocal()) return LocalStorageBackend.getTurnsForPlayer(playerId);
        try {
            const sb = ensureInitialized();
            // Get non-practice game_player IDs first, then fetch their turns
            const { data: gpRows } = await sb.from('game_players')
                .select('id, game:games!inner(is_practice)')
                .eq('player_id', playerId);
            const nonPracticeGpIds = (gpRows || [])
                .filter(gp => !gp.game?.is_practice)
                .map(gp => gp.id);
            if (nonPracticeGpIds.length === 0) return [];
            const { data } = await sb.from('turns')
                .select('turn_total')
                .in('game_player_id', nonPracticeGpIds);
            return data || [];
        } catch (e) { return []; }
    }

    async function getHeadToHeadGames(p1Id, p2Id) {
        if (isLocal()) return LocalStorageBackend.getHeadToHeadGames(p1Id, p2Id);
        try {
            const sb = ensureInitialized();
            const { data: games } = await sb.from('games').select(`
                id, completed_at, is_practice, game_players!inner(player_id, is_winner)
            `).not('completed_at', 'is', null);
            // Filter to non-practice games where both players participated
            return (games || []).filter(g => {
                if (g.is_practice) return false;
                const pids = g.game_players.map(gp => gp.player_id);
                return pids.includes(p1Id) && pids.includes(p2Id);
            });
        } catch (e) { return []; }
    }

    async function countCompletedGames() {
        if (isLocal()) return LocalStorageBackend.countCompletedGames();
        try {
            const sb = ensureInitialized();
            const { count } = await sb.from('games').select('*', { count: 'exact', head: true }).not('completed_at', 'is', null).or('is_practice.is.null,is_practice.eq.false');
            return count || 0;
        } catch (e) { return 0; }
    }

    async function countPlayersWithGames() {
        if (isLocal()) return LocalStorageBackend.countPlayersWithGames();
        try {
            const sb = ensureInitialized();
            // Use player_stats view instead of players table (already filters deleted)
            const { count } = await sb.from('player_stats').select('*', { count: 'exact', head: true }).gt('total_games_played', 0);
            return count || 0;
        } catch (e) { return 0; }
    }

    async function getGamesForPlayer(playerId) {
        if (isLocal()) return LocalStorageBackend.getGamesForPlayer(playerId);
        try {
            const sb = ensureInitialized();
            const { data: gpRows } = await sb.from('game_players').select('game_id').eq('player_id', playerId);
            if (!gpRows || gpRows.length === 0) return [];
            const gameIds = gpRows.map(gp => gp.game_id);
            const { data: games } = await sb.from('games').select(`
                id, completed_at, is_practice, game_players(player_id, is_winner, player:players(name))
            `).in('id', gameIds).not('completed_at', 'is', null).or('is_practice.is.null,is_practice.eq.false');
            return games || [];
        } catch (e) { return []; }
    }

    async function getAllPlayersWithStats() {
        if (isLocal()) return LocalStorageBackend.getAllPlayersWithStats();
        try {
            const sb = ensureInitialized();
            // Use player_stats view instead of players table (already filters deleted)
            const { data } = await sb.from('player_stats').select('*').gt('total_games_played', 0);
            return data || [];
        } catch (e) { return []; }
    }

    function getAllPlayerGames(n) { return isLocal() ? [] : _getAllPlayerGames(n); }

    // =========================================================================
    // Delegated public methods — route to local or supabase
    // =========================================================================

    function getGames(limit, filters = {}) { return isLocal() ? LocalStorageBackend.getGames(limit, filters) : _getGames(limit, filters); }
    function getGamesPaginated(p, pp, f) { return isLocal() ? LocalStorageBackend.getGamesPaginated(p, pp, f) : _getGamesPaginated(p, pp, f); }
    function getActiveGames() { return isLocal() ? LocalStorageBackend.getActiveGames() : _getActiveGames(); }
    function saveGame(g) { return isLocal() ? LocalStorageBackend.saveGame(g) : _saveGame(g); }
    function updateGame(id, u) { return isLocal() ? LocalStorageBackend.updateGame(id, u) : _updateGame(id, u); }
    function getGame(id) { return isLocal() ? LocalStorageBackend.getGame(id) : _getGame(id); }
    function getGameCompetitionContext(id) { return isLocal() ? LocalStorageBackend.getGameCompetitionContext(id) : _getGameCompetitionContext(id); }
    function deleteGame(id) { return isLocal() ? LocalStorageBackend.deleteGame(id) : _deleteGame(id); }
    function getPlayers() { return isLocal() ? LocalStorageBackend.getPlayers() : _getPlayers(); }
    function addPlayer(n) { return isLocal() ? LocalStorageBackend.addPlayer(n) : _addPlayer(n); }
    function deletePlayer(id) { return isLocal() ? LocalStorageBackend.deletePlayer(id) : _deletePlayer(id); }
    function restorePlayer(id) { return isLocal() ? LocalStorageBackend.restorePlayer(id) : _restorePlayer(id); }
    function getDeletedPlayers() { return isLocal() ? LocalStorageBackend.getDeletedPlayers() : _getDeletedPlayers(); }
    function renamePlayer(id, n) { return isLocal() ? LocalStorageBackend.renamePlayer(id, n) : _renamePlayer(id, n); }
    function getOrCreatePlayer(n) { return isLocal() ? Promise.resolve(LocalStorageBackend.getOrCreatePlayer(n)) : _getOrCreatePlayer(n); }
    function getPlayerGames(n, l) { return isLocal() ? LocalStorageBackend.getPlayerGames(n, l) : _getPlayerGames(n, l); }
    function exportData() { return isLocal() ? LocalStorageBackend.exportData() : _exportData(); }
    // Tournament
    function saveTournament(t) { return isLocal() ? LocalStorageBackend.saveTournament(t) : _saveTournament(t); }
    function getTournaments(f) { return isLocal() ? LocalStorageBackend.getTournaments(f) : _getTournaments(f); }
    function getTournament(id) { return isLocal() ? LocalStorageBackend.getTournament(id) : _getTournament(id); }
    function updateTournament(id, u) { return isLocal() ? LocalStorageBackend.updateTournament(id, u) : _updateTournament(id, u); }
    function saveTournamentParticipants(id, p) { return isLocal() ? LocalStorageBackend.saveTournamentParticipants(id, p) : _saveTournamentParticipants(id, p); }
    function saveTournamentMatches(id, m) { return isLocal() ? LocalStorageBackend.saveTournamentMatches(id, m) : _saveTournamentMatches(id, m); }
    function updateTournamentMatch(id, u) { return isLocal() ? LocalStorageBackend.updateTournamentMatch(id, u) : _updateTournamentMatch(id, u); }
    function updateTournamentParticipant(id, u) { return isLocal() ? LocalStorageBackend.updateTournamentParticipant(id, u) : _updateTournamentParticipant(id, u); }
    function deleteTournamentParticipant(tid, n) { return isLocal() ? LocalStorageBackend.deleteTournamentParticipant(tid, n) : _deleteTournamentParticipant(tid, n); }
    function clearTournamentParticipants(id) { return isLocal() ? LocalStorageBackend.clearTournamentParticipants(id) : _clearTournamentParticipants(id); }
    function deleteTournament(id) { return isLocal() ? LocalStorageBackend.deleteTournament(id) : _deleteTournament(id); }
    // League
    function saveLeague(l) { return isLocal() ? LocalStorageBackend.saveLeague(l) : _saveLeague(l); }
    function getLeagues(f) { return isLocal() ? LocalStorageBackend.getLeagues(f) : _getLeagues(f); }
    function getLeague(id) { return isLocal() ? LocalStorageBackend.getLeague(id) : _getLeague(id); }
    function updateLeague(id, u) { return isLocal() ? LocalStorageBackend.updateLeague(id, u) : _updateLeague(id, u); }
    function saveLeagueParticipants(id, p) { return isLocal() ? LocalStorageBackend.saveLeagueParticipants(id, p) : _saveLeagueParticipants(id, p); }
    function saveLeagueMatches(id, m) { return isLocal() ? LocalStorageBackend.saveLeagueMatches(id, m) : _saveLeagueMatches(id, m); }
    function updateLeagueMatch(id, u) { return isLocal() ? LocalStorageBackend.updateLeagueMatch(id, u) : _updateLeagueMatch(id, u); }
    function updateLeagueParticipant(id, u) { return isLocal() ? LocalStorageBackend.updateLeagueParticipant(id, u) : _updateLeagueParticipant(id, u); }
    function deleteLeague(id) { return isLocal() ? LocalStorageBackend.deleteLeague(id) : _deleteLeague(id); }

    // Public API
    return {
        init,
        isLocal,
        get sb() {
            if (isLocal()) {
                // Return a stub object with channel/removeChannel so app.js while-loop exits
                return {
                    channel: LocalDB.channel,
                    removeChannel: LocalDB.removeChannel
                };
            }
            if (supabase) return supabase;
            try {
                const client = ensureInitialized();
                return client;
            } catch (error) {
                console.error('Storage.sb getter error:', error);
                try {
                    SupabaseClient.init();
                    const client = SupabaseClient.getClient();
                    supabase = client;
                    return client;
                } catch (retryError) {
                    console.error('Retry failed:', retryError);
                    return null;
                }
            }
        },
        getGames,
        getGamesPaginated,
        getActiveGames,
        saveGame,
        updateGame,
        getGame,
        getGameCompetitionContext,
        deleteGame,
        getPlayers,
        addPlayer,
        deletePlayer,
        restorePlayer,
        getDeletedPlayers,
        renamePlayer,
        getOrCreatePlayer,
        getPlayerGames,
        exportData,
        generateUUID,
        // Tournament operations
        saveTournament,
        getTournaments,
        getTournament,
        updateTournament,
        saveTournamentParticipants,
        saveTournamentMatches,
        updateTournamentMatch,
        updateTournamentParticipant,
        deleteTournamentParticipant,
        clearTournamentParticipants,
        deleteTournament,
        // League operations
        saveLeague,
        getLeagues,
        getLeague,
        updateLeague,
        saveLeagueParticipants,
        saveLeagueMatches,
        updateLeagueMatch,
        updateLeagueParticipant,
        deleteLeague,
        // New query methods (for stats.js)
        getPlayerByName,
        getPlayersByNames,
        getPlayerLeaderboard,
        getCompletedGamesWithPlayerStats,
        getGamePlayersByGameIds,
        getTurnsForPlayer,
        getHeadToHeadGames,
        countCompletedGames,
        countPlayersWithGames,
        getGamesForPlayer,
        getAllPlayerGames,
        getAllPlayersWithStats
    };
})();

// Storage initialization is now handled by app.js to ensure proper sequencing
