/**
 * Game Module
 * Handles core game logic and scoring
 */

const Game = (() => {
    /**
     * Create a new game
     */
    function createGame(options) {
        const {
            playerCount,
            playerNames = [],
            gameType = 501,
            winBelow = false,
            scoringMode = 'per-dart',
            is_practice = false
        } = options;

        const game = {
            id: Storage.generateUUID(),
            created_at: new Date().toISOString(),
            completed_at: null,
            game_type: parseInt(gameType),
            win_condition: winBelow ? 'below' : 'exact',
            scoring_mode: scoringMode,
            current_player_index: 0,
            current_turn: 0,
            is_active: true,
            is_practice: is_practice,
            device_id: Device.getDeviceId(),
            players: []
        };

        // Initialize players
        for (let i = 0; i < playerCount; i++) {
            const playerName = playerNames[i]?.trim() || `Player ${i + 1}`;

            game.players.push({
                id: Storage.generateUUID(),
                name: playerName,
                startingScore: game.game_type,
                currentScore: game.game_type,
                turns: [],
                winner: false,
                stats: {
                    totalDarts: 0,
                    totalScore: 0,
                    avgPerDart: 0,
                    avgPerTurn: 0,
                    maxTurn: 0,
                    maxDart: 0,
                    checkoutAttempts: 0,
                    checkoutSuccess: 0
                }
            });
        }

        // Randomize player order (Fisher-Yates shuffle)
        for (let i = game.players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [game.players[i], game.players[j]] = [game.players[j], game.players[i]];
        }

        return game;
    }

    /**
     * Validate dart score
     */
    function validateDart(score) {
        const s = parseInt(score);
        if (isNaN(s) || s < 0 || s > 180) {
            return { valid: false, error: 'Dart must be between 0 and 180' };
        }
        return { valid: true, score: s };
    }

    /**
     * Validate dart turn (3 darts max per turn)
     */
    function validateTurn(darts) {
        if (!Array.isArray(darts) || darts.length === 0 || darts.length > 3) {
            return { valid: false, error: 'A turn must have 1-3 darts' };
        }

        let totalScore = 0;
        for (const dart of darts) {
            const validation = validateDart(dart);
            if (!validation.valid) return validation;
            totalScore += validation.score;
        }

        if (totalScore > 180) {
            return { valid: false, error: 'Turn total cannot exceed 180' };
        }

        return { valid: true, darts: darts.map(d => parseInt(d)), total: totalScore };
    }

    /**
     * Submit a turn for the current player
     */
    function submitTurn(game, dartsInput) {
        if (!game.is_active) {
            return { success: false, error: 'Game is not active' };
        }

        const validation = validateTurn(dartsInput);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        const currentPlayer = game.players[game.current_player_index];
        const darts = validation.darts;
        const totalScore = validation.total;

        // Check for checkout attempt
        if (currentPlayer.currentScore - totalScore === 0 ||
            (currentPlayer.currentScore - totalScore < 0 && game.win_condition === 'below')) {
            currentPlayer.stats.checkoutAttempts++;
        }

        // Check for bust
        const newScore = currentPlayer.currentScore - totalScore;
        let busted = false;

        if (newScore < 0) {
            if (game.win_condition === 'exact') {
                // Bust - score reverts to start of turn
                busted = true;
            } else if (game.win_condition === 'below') {
                // Amateur mode - below zero counts as finish
                currentPlayer.currentScore = 0;
                currentPlayer.winner = true;
                currentPlayer.stats.checkoutSuccess++;
            }
        } else if (newScore === 0) {
            // Exact match - player wins
            currentPlayer.currentScore = 0;
            currentPlayer.winner = true;
            currentPlayer.stats.checkoutSuccess++;
        } else {
            // Valid turn
            currentPlayer.currentScore = newScore;
        }

        // Record turn
        const turn = {
            darts: darts,
            remaining: busted ? currentPlayer.currentScore : newScore,
            busted: busted,
            timestamp: Date.now()
        };

        if (!busted || game.win_condition === 'below') {
            currentPlayer.turns.push(turn);

            // Update player stats
            // In per-turn mode: each turn = 3 darts (entered as single total)
            // In per-dart mode: count actual darts entered
            const dartCount = game.scoring_mode === 'per-turn' ? 3 : darts.length;
            currentPlayer.stats.totalDarts += dartCount;
            currentPlayer.stats.totalScore += totalScore;
            currentPlayer.stats.maxTurn = Math.max(currentPlayer.stats.maxTurn, totalScore);
            // In per-turn mode, darts=[turnTotal] so maxDart is not meaningful — skip it
            if (game.scoring_mode !== 'per-turn') {
                currentPlayer.stats.maxDart = Math.max(currentPlayer.stats.maxDart, Math.max(...darts));
            }
            // Calculate averages (for UI display)
            currentPlayer.stats.avgPerTurn =
                currentPlayer.stats.totalScore / currentPlayer.turns.length;
            currentPlayer.stats.avgPerDart =
                currentPlayer.stats.totalDarts > 0
                    ? currentPlayer.stats.totalScore / currentPlayer.stats.totalDarts
                    : 0;
        } else {
            currentPlayer.turns.push(turn);
        }

        // Check for player finish (0 score)
        if (currentPlayer.currentScore === 0) {
            // Mark player as finished (but don't rank yet - wait for round end)
            currentPlayer.winner = true;
            // Track which round they finished (round = complete cycle through all players)
            // This ensures players finishing in the same round get the same rank
            currentPlayer.finish_round = Math.floor(game.current_turn / game.players.length);

            // Find next active player (not finished)
            let nextActiveIndex = -1;
            let activePlayers = 0;

            for (let i = 0; i < game.players.length; i++) {
                if (!game.players[i].winner) {
                    activePlayers++;
                }
            }

            // activePlayers already excludes current player (who now has winner=true)
            let activePlayersRemaining = activePlayers;

            // Move to next active player (skip all finished players)
            let searchIndex = (game.current_player_index + 1) % game.players.length;
            let searchAttempts = 0;
            while (searchAttempts < game.players.length) {
                if (!game.players[searchIndex].winner) {
                    nextActiveIndex = searchIndex;
                    break;
                }
                searchIndex = (searchIndex + 1) % game.players.length;
                searchAttempts++;
            }

            game.current_turn++;

            // If only 1 player left, they get last place - update all rankings
            if (activePlayersRemaining === 0) {
                // All other players have finished
                assignRankingsByFinishTurn(game);

                // DEBUG: Log player finish ranks before final ranking
                console.log('Before getRankings - player finish_ranks:');
                game.players.forEach((p, idx) => {
                    console.log(`  Player ${idx} (${p.name}): finish_round=${p.finish_round}, finish_rank=${p.finish_rank}`);
                });

                endGame(game);
                const finalRankings = getRankings(game);

                console.log('Final rankings returned:', finalRankings);
                console.log('Final rankings length:', finalRankings ? finalRankings.length : 'undefined');

                return {
                    success: true,
                    busted: false,
                    gameEnded: true,
                    playerFinished: currentPlayer.name,
                    finishRank: currentPlayer.finish_rank,
                    finalRankings: finalRankings
                };
            }

            // Move to next active player
            if (nextActiveIndex !== -1) {
                game.current_player_index = nextActiveIndex;
            }

            // Check if only 1 player remains and they've had their fair chance
            if (game.players.length > 1 && activePlayersRemaining === 1) {
                // Fair play: remaining player must have at least as many turns as
                // the most recently finished player (highest turn count among finished)
                const maxFinishedTurns = Math.max(...game.players.filter(p => p.winner).map(p => p.turns.length));
                const remainingPlayer = game.players.find(p => !p.winner);
                const caughtUp = remainingPlayer && remainingPlayer.turns.length >= maxFinishedTurns;

                if (caughtUp) {
                    console.log(`Remaining player ${remainingPlayer.name} has ${remainingPlayer.turns.length} turns (finished max: ${maxFinishedTurns}) - ending game`);
                    assignRankingsByFinishTurn(game);
                    endGame(game);
                    const finalRankings = getRankings(game);

                    return {
                        success: true,
                        busted: false,
                        gameEnded: true,
                        playerFinished: currentPlayer.name,
                        finishRank: currentPlayer.finish_rank,
                        finalRankings: finalRankings
                    };
                }
            }

            // Calculate rank for this player based on finish round and average
            const finishRank = calculateCurrentRank(game, currentPlayer);

            // IMPORTANT: Assign the rank to the player object so it's persisted to DB
            currentPlayer.finish_rank = finishRank;

            return {
                success: true,
                busted: false,
                gameEnded: false,
                playerFinished: currentPlayer.name,
                finishRank: finishRank,
                finishRound: currentPlayer.finish_round,
                nextPlayer: game.players[game.current_player_index].name,
                allRankings: getRankings(game)
            };
        }

        // Move to next active player (skip finished ones)
        let nextPlayerIndex = (game.current_player_index + 1) % game.players.length;
        let searchAttempts = 0;
        while (searchAttempts < game.players.length) {
            if (!game.players[nextPlayerIndex].winner) {
                game.current_player_index = nextPlayerIndex;
                break;
            }
            nextPlayerIndex = (nextPlayerIndex + 1) % game.players.length;
            searchAttempts++;
        }

        game.current_turn++;

        // Check if this player is the last one and all others have finished
        // If so, end the game once they've caught up to the most recent finisher
        const remainingActivePlayers = game.players.filter(p => !p.winner);
        if (game.players.length > 1 && remainingActivePlayers.length === 1) {
            // Fair play: remaining player must have at least as many turns as
            // the most recently finished player (highest turn count among finished)
            const maxFinishedTurns = Math.max(...game.players.filter(p => p.winner).map(p => p.turns.length));
            const remainingPlayer = remainingActivePlayers[0];
            const caughtUp = remainingPlayer.turns.length >= maxFinishedTurns;

            if (caughtUp) {
                console.log(`Remaining player ${remainingPlayer.name} has ${remainingPlayer.turns.length} turns (finished max: ${maxFinishedTurns}) - ending game`);
                assignRankingsByFinishTurn(game);
                endGame(game);
                const finalRankings = getRankings(game);

                return {
                    success: true,
                    busted: busted,
                    gameEnded: true,
                    finalRankings: finalRankings
                };
            }
        }

        return { success: true, busted: busted, gameEnded: false, nextPlayer: game.players[game.current_player_index].name };
    }

    /**
     * Undo last dart
     */
    function undoLastDart(game) {
        const currentPlayer = game.players[game.current_player_index];
        if (currentPlayer.turns.length === 0) {
            return { success: false, error: 'No turns to undo' };
        }

        const lastTurn = currentPlayer.turns[currentPlayer.turns.length - 1];
        currentPlayer.turns.pop();

        // Recalculate score
        currentPlayer.currentScore = currentPlayer.startingScore;
        currentPlayer.stats.totalDarts = 0;
        currentPlayer.stats.totalScore = 0;
        currentPlayer.stats.maxTurn = 0;
        currentPlayer.stats.maxDart = 0;

        currentPlayer.turns.forEach(turn => {
            if (!turn.busted) {
                currentPlayer.currentScore = turn.remaining;
                const turnTotal = turn.darts.reduce((a, b) => a + b, 0);
                // In per-turn mode: each turn = 3 darts
                // In per-dart mode: count actual darts
                const dartCount = game.scoring_mode === 'per-turn' ? 3 : turn.darts.length;
                currentPlayer.stats.totalDarts += dartCount;
                currentPlayer.stats.totalScore += turnTotal;
                currentPlayer.stats.maxTurn = Math.max(currentPlayer.stats.maxTurn, turnTotal);
                if (game.scoring_mode !== 'per-turn') {
                    currentPlayer.stats.maxDart = Math.max(currentPlayer.stats.maxDart, Math.max(...turn.darts));
                }
            }
        });

        if (currentPlayer.turns.length > 0) {
            // Calculate averages
            currentPlayer.stats.avgPerTurn = currentPlayer.stats.totalScore / currentPlayer.turns.length;
            currentPlayer.stats.avgPerDart =
                currentPlayer.stats.totalDarts > 0
                    ? currentPlayer.stats.totalScore / currentPlayer.stats.totalDarts
                    : 0;
        }

        return { success: true, player: currentPlayer.name, score: currentPlayer.currentScore };
    }

    /**
     * End the current game
     */
    function endGame(game) {
        console.log('=== endGame DEBUG ===');
        game.is_active = false;
        game.completed_at = new Date().toISOString();

        // Assign finish_rank if not already assigned
        // This handles manual "End Game" where rankings weren't set during play
        const hasRankings = game.players.some(p => p.finish_rank !== undefined);
        console.log('hasRankings:', hasRankings);
        console.log('Players before ranking:');
        game.players.forEach((p, i) => {
            console.log(`  [${i}] ${p.name}: score=${p.currentScore}, winner=${p.winner}, finish_rank=${p.finish_rank}, finish_round=${p.finish_round}`);
        });

        if (!hasRankings) {
            console.log('No rankings found, assigning manually...');
            // Sort players: first by whether they finished (score=0), then by score, then by darts
            const sortedPlayers = [...game.players].sort((a, b) => {
                // Players who reached 0 come first
                const aFinished = a.currentScore === 0;
                const bFinished = b.currentScore === 0;
                if (aFinished && !bFinished) return -1;
                if (!aFinished && bFinished) return 1;

                // If both finished or both didn't, sort by score (lower is better)
                if (a.currentScore !== b.currentScore) {
                    return a.currentScore - b.currentScore;
                }

                // Tie-breaker: fewer darts is better
                return (a.stats?.totalDarts || 0) - (b.stats?.totalDarts || 0);
            });

            // Assign ranks
            sortedPlayers.forEach((player, index) => {
                player.finish_rank = index + 1;
                player.winner = (index === 0); // First place is winner
            });
            console.log('Sorted players (by score/finished):');
            sortedPlayers.forEach((p, i) => {
                console.log(`  [${i}] ${p.name}: score=${p.currentScore}, rank=${p.finish_rank}`);
            });
        }

        console.log('Players after ranking:');
        game.players.forEach((p, i) => {
            console.log(`  [${i}] ${p.name}: finish_rank=${p.finish_rank}`);
        });

        // Ensure winner is marked (player with finish_rank = 1)
        const winner = game.players.find(p => p.finish_rank === 1);
        console.log('Winner by finish_rank=1:', winner ? winner.name : 'NONE FOUND');
        if (winner) {
            winner.winner = true;
            // Clear winner flag from others
            game.players.forEach(p => {
                if (p !== winner) p.winner = false;
            });
        } else {
            // Fallback: if no finish_rank, use lowest score
            console.log('Using fallback: lowest score');
            const sortedPlayers = [...game.players].sort((a, b) => a.currentScore - b.currentScore);
            if (sortedPlayers[0]) {
                sortedPlayers[0].winner = true;
                sortedPlayers[0].finish_rank = 1;
                console.log('Fallback winner:', sortedPlayers[0].name);
            }
        }

        console.log('Final winner state:');
        game.players.forEach((p, i) => {
            console.log(`  [${i}] ${p.name}: winner=${p.winner}, finish_rank=${p.finish_rank}`);
        });

        return game;
    }

    /**
     * Abandon a game without completing it
     */
    function abandonGame(game) {
        game.is_active = false;
        game.completed_at = new Date().toISOString();
        // Don't mark any winner when abandoned
        return game;
    }

    /**
     * Get current player
     */
    function getCurrentPlayer(game) {
        return game.players[game.current_player_index];
    }

    /**
     * Get game summary
     */
    function getGameSummary(game) {
        const createdTime = new Date(game.created_at).getTime();
        const completedTime = game.completed_at ? new Date(game.completed_at).getTime() : null;

        return {
            id: game.id,
            created_at: game.created_at,
            completed_at: game.completed_at,
            game_type: game.game_type,
            scoring_mode: game.scoring_mode,
            players: game.players.map(p => ({
                name: p.name,
                winner: p.winner,
                score: p.currentScore,
                darts: p.stats.totalDarts,
                turns: p.turns.length,
                avgPerTurn: p.turns.length > 0 ? (p.stats.totalScore / p.turns.length).toFixed(2) : '0',
                avgPerDart: p.stats.totalDarts > 0 ? (p.stats.totalScore / p.stats.totalDarts).toFixed(2) : '0'
            })),
            duration: completedTime ? ((completedTime - createdTime) / 1000 / 60).toFixed(1) : null
        };
    }

    /**
     * Get turn history for a player
     */
    function getPlayerTurnHistory(game, playerIndex) {
        const player = game.players[playerIndex];
        return player.turns.map((turn, index) => ({
            turnNumber: index + 1,
            darts: turn.darts,
            total: turn.darts.reduce((a, b) => a + b, 0),
            remaining: turn.remaining,
            busted: turn.busted
        }));
    }

    /**
     * Format time for display
     */
    function formatDuration(ms) {
        const minutes = Math.floor((ms / 1000) / 60);
        const seconds = Math.floor((ms / 1000) % 60);
        if (minutes === 0) {
            return `${seconds}s`;
        }
        return `${minutes}m ${seconds}s`;
    }

    /**
     * Get common dart scores for quick entry
     */
    function getQuickDarts() {
        return [0, 20, 25, 30, 40, 50, 60, 80, 100, 120, 140, 160, 180];
    }

    /**
     * Get the next finish rank (counting finished players)
     */
    /**
     * Assign rankings based on finish round
     * Players finishing in same round are ranked by average (higher avg = better rank)
     * Last player (who didn't finish) gets last rank
     */
    function assignRankingsByFinishTurn(game) {
        console.log('=== assignRankingsByFinishTurn DEBUG ===');
        console.log('All players:');
        game.players.forEach((p, i) => {
            console.log(`  [${i}] ${p.name}: score=${p.currentScore}, winner=${p.winner}, turns=${p.turns.length}, darts=${p.stats?.totalDarts}, avgPerDart=${p.stats?.avgPerDart}`);
        });

        // Get all finished players (score = 0) with their turn counts and stats
        const finishedPlayers = game.players
            .filter(p => p.currentScore === 0)
            .map(p => ({
                player: p,
                totalTurns: p.turns.length,
                totalDarts: p.stats?.totalDarts || 0,
                avgPerDart: p.stats?.avgPerDart || 0
            }));

        console.log('Finished players:', finishedPlayers.map(fp => `${fp.player.name}:turns${fp.totalTurns}:avg${fp.avgPerDart.toFixed(2)}`).join(', '));

        // Sort by turns taken (ascending - fewer turns = better rank)
        // Tie-breaker: average per dart (descending - higher avg = better)
        finishedPlayers.sort((a, b) => {
            if (a.totalTurns !== b.totalTurns) {
                return a.totalTurns - b.totalTurns;  // Fewer turns = better rank
            }
            // Same turns: higher average = better rank (sort descending)
            return b.avgPerDart - a.avgPerDart;
        });
        console.log('After sort:', finishedPlayers.map(fp => `${fp.player.name}:turns${fp.totalTurns}:avg${fp.avgPerDart.toFixed(2)}`).join(', '));

        // Assign sequential ranks - each player gets unique rank based on round + average
        finishedPlayers.forEach(({ player }, index) => {
            player.finish_rank = index + 1;
            console.log(`  Assigned ${player.name} rank ${index + 1} (round ${player.finish_round}, avg ${player.stats?.avgPerDart?.toFixed(2)})`);
        });

        // Assign rank to any unfinished players (they get ranks after finished players)
        const unfinishedPlayers = game.players
            .filter(p => p.finish_round == null)
            .sort((a, b) => {
                // Sort unfinished by score (lower = better) then by average (higher = better)
                if (a.currentScore !== b.currentScore) {
                    return a.currentScore - b.currentScore;
                }
                // Higher average is better, so sort descending
                return (b.stats?.avgPerDart || 0) - (a.stats?.avgPerDart || 0);
            });

        console.log('Unfinished players:', unfinishedPlayers.map(p => p.name).join(', ') || 'NONE');
        const startRank = finishedPlayers.length + 1;
        unfinishedPlayers.forEach((p, index) => {
            p.finish_rank = startRank + index;
            console.log(`  Assigned ${p.name} rank ${startRank + index} (unfinished)`);
        });

        console.log('Final rankings:');
        game.players.forEach((p, i) => {
            console.log(`  [${i}] ${p.name}: finish_rank=${p.finish_rank}, avgPerDart=${p.stats?.avgPerDart?.toFixed(2)}`);
        });
    }

    function getNextFinishRank(game) {
        const finishedCount = game.players.filter(p => p.finish_rank !== undefined).length;
        return finishedCount + 1;
    }

    /**
     * Calculate the current rank of a player based on their turn count and average
     * Players with fewer turns rank higher, within same turn count higher average ranks better
     */
    function calculateCurrentRank(game, player) {
        const playerTurns = player.turns.length;
        const currentAvg = player.stats?.avgPerDart || 0;

        // Count finished players who took fewer turns
        const playersWithFewerTurns = game.players.filter(
            p => p.currentScore === 0 && p !== player && p.turns.length < playerTurns
        ).length;

        // Count finished players with same turns but higher average (they rank better)
        const playersWithSameTurnsHigherAvg = game.players.filter(
            p => p.currentScore === 0 &&
                 p !== player &&
                 p.turns.length === playerTurns &&
                 (p.stats?.avgPerDart || 0) > currentAvg
        ).length;

        // Rank = players before + players with same turns but better avg + 1
        return playersWithFewerTurns + playersWithSameTurnsHigherAvg + 1;
    }

    /**
     * Get final rankings sorted by finish order
     */
    function getRankings(game) {
        return game.players
            .map(p => ({
                name: p.name,
                rank: p.finish_rank,
                score: p.currentScore,
                darts: p.stats.totalDarts,
                turns: p.turns.length,
                avgPerTurn: p.turns.length > 0 ? (p.stats.totalScore / p.turns.length).toFixed(2) : 0,
                avgPerDart: p.stats.totalDarts > 0 ? (p.stats.totalScore / p.stats.totalDarts).toFixed(2) : 0
            }))
            .sort((a, b) => (a.rank || 999) - (b.rank || 999));
    }

    /**
     * Get checkout suggestions for a given score (standard PDC 3-dart checkouts)
     * Returns array of route strings or null if no checkout possible
     */
    function getCheckoutSuggestions(score) {
        const checkouts = {
            170: ['T20 T20 Bull'],
            167: ['T20 T19 Bull'],
            164: ['T20 T18 Bull'],
            161: ['T20 T17 Bull'],
            160: ['T20 T20 D20'],
            158: ['T20 T20 D19'],
            157: ['T20 T19 D20'],
            156: ['T20 T20 D18'],
            155: ['T20 T19 D19'],
            154: ['T20 T18 D20'],
            153: ['T20 T19 D18'],
            152: ['T20 T20 D16'],
            151: ['T20 T17 D20'],
            150: ['T20 T18 D18'],
            149: ['T20 T19 D16'],
            148: ['T20 T16 D20'],
            147: ['T20 T17 D18'],
            146: ['T20 T18 D16'],
            145: ['T20 T15 D20'],
            144: ['T20 T20 D12'],
            143: ['T20 T17 D16'],
            142: ['T20 T14 D20'],
            141: ['T20 T19 D12'],
            140: ['T20 T20 D10'],
            139: ['T19 T14 D20'],
            138: ['T20 T18 D12'],
            137: ['T20 T15 D16'],
            136: ['T20 T20 D8'],
            135: ['T20 T17 D12'],
            134: ['T20 T14 D16'],
            133: ['T20 T19 D8'],
            132: ['T20 T16 D12'],
            131: ['T20 T13 D16'],
            130: ['T20 T18 D8'],
            129: ['T19 T16 D12'],
            128: ['T18 T14 D16'],
            127: ['T20 T17 D8'],
            126: ['T19 T19 D6'],
            125: ['T20 T15 D10'],
            124: ['T20 T16 D8'],
            123: ['T19 T16 D9'],
            122: ['T18 T18 D7'],
            121: ['T20 T11 D14'],
            120: ['T20 S20 D20'],
            119: ['T19 T12 D13'],
            118: ['T20 S18 D20'],
            117: ['T20 S17 D20'],
            116: ['T20 S16 D20'],
            115: ['T20 S15 D20'],
            114: ['T20 S14 D20'],
            113: ['T20 S13 D20'],
            112: ['T20 T12 D8'],
            111: ['T20 S11 D20'],
            110: ['T20 S10 D20'],
            109: ['T20 S9 D20'],
            108: ['T20 S16 D16'],
            107: ['T19 S10 D20'],
            106: ['T20 S6 D20'],
            105: ['T20 S5 D20'],
            104: ['T18 S10 D20'],
            103: ['T20 S3 D20'],
            102: ['T20 S10 D16'],
            101: ['T17 S10 D20'],
            100: ['T20 D20'],
            99: ['T19 S10 D16'],
            98: ['T20 D19'],
            97: ['T19 D20'],
            96: ['T20 D18'],
            95: ['T19 D19'],
            94: ['T18 D20'],
            93: ['T19 D18'],
            92: ['T20 D16'],
            91: ['T17 D20'],
            90: ['T18 D18'],
            89: ['T19 D16'],
            88: ['T16 D20'],
            87: ['T17 D18'],
            86: ['T18 D16'],
            85: ['T15 D20'],
            84: ['T20 D12'],
            83: ['T17 D16'],
            82: ['T14 D20'],
            81: ['T19 D12'],
            80: ['T20 D10'],
            79: ['T13 D20'],
            78: ['T18 D12'],
            77: ['T15 D16'],
            76: ['T20 D8'],
            75: ['T17 D12'],
            74: ['T14 D16'],
            73: ['T19 D8'],
            72: ['T16 D12'],
            71: ['T13 D16'],
            70: ['T18 D8'],
            69: ['T19 D6'],
            68: ['T20 D4'],
            67: ['T17 D8'],
            66: ['T10 D18'],
            65: ['T19 D4'],
            64: ['T16 D8'],
            63: ['T13 D12'],
            62: ['T10 D16'],
            61: ['T15 D8'],
            60: ['S20 D20'],
            59: ['S19 D20'],
            58: ['S18 D20'],
            57: ['S17 D20'],
            56: ['S16 D20'],
            55: ['S15 D20'],
            54: ['S14 D20'],
            53: ['S13 D20'],
            52: ['S12 D20'],
            51: ['S11 D20'],
            50: ['Bull'],
            49: ['S9 D20'],
            48: ['S16 D16'],
            47: ['S15 D16'],
            46: ['S6 D20'],
            45: ['S13 D16'],
            44: ['S12 D16'],
            43: ['S3 D20'],
            42: ['S10 D16'],
            41: ['S9 D16'],
            40: ['D20'],
            39: ['S7 D16'],
            38: ['D19'],
            37: ['S5 D16'],
            36: ['D18'],
            35: ['S3 D16'],
            34: ['D17'],
            33: ['S1 D16'],
            32: ['D16'],
            31: ['S15 D8'],
            30: ['D15'],
            29: ['S13 D8'],
            28: ['D14'],
            27: ['S11 D8'],
            26: ['D13'],
            25: ['S9 D8'],
            24: ['D12'],
            23: ['S7 D8'],
            22: ['D11'],
            21: ['S5 D8'],
            20: ['D10'],
            19: ['S3 D8'],
            18: ['D9'],
            17: ['S1 D8'],
            16: ['D8'],
            15: ['S7 D4'],
            14: ['D7'],
            13: ['S5 D4'],
            12: ['D6'],
            11: ['S3 D4'],
            10: ['D5'],
            9: ['S1 D4'],
            8: ['D4'],
            7: ['S3 D2'],
            6: ['D3'],
            5: ['S1 D2'],
            4: ['D2'],
            3: ['S1 D1'],
            2: ['D1']
        };
        return checkouts[score] || null;
    }

    // Public API
    return {
        createGame,
        validateDart,
        validateTurn,
        submitTurn,
        undoLastDart,
        endGame,
        abandonGame,
        getCurrentPlayer,
        getGameSummary,
        getPlayerTurnHistory,
        formatDuration,
        getQuickDarts,
        getRankings,
        assignRankingsByFinishTurn,
        getCheckoutSuggestions
    };
})();
