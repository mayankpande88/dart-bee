/**
 * Statistics Module
 * Calculates and aggregates player statistics
 * OPTIMIZED for normalized database schema with materialized views
 * Now backend-agnostic — uses Storage methods instead of direct Supabase queries.
 */

const Stats = (() => {

    /**
     * Calculate player statistics from database aggregates
     */
    async function calculatePlayerStats(playerName) {
        const player = await Storage.getPlayerByName(playerName);

        if (!player) {
            console.error('Player not found:', playerName);
            return getEmptyStats();
        }

        const recentGames = await Storage.getPlayerGames(playerName, 5);
        const headToHead = await calculateHeadToHead(playerName);

        return {
            joinedDate: player.created_at ? new Date(player.created_at).toLocaleDateString() : 'N/A',
            gamesPlayed: player.total_games_played || 0,
            gamesWon: player.total_games_won || 0,
            winRate: player.win_rate ? parseFloat(player.win_rate).toFixed(1) : '0.0',
            totalDarts: player.total_darts_thrown || 0,
            totalScore: player.total_score || 0,
            avgPerDart: player.avg_per_dart ? parseFloat(player.avg_per_dart).toFixed(2) : '0.00',
            avgPerTurn: player.avg_per_turn ? parseFloat(player.avg_per_turn).toFixed(2) : '0.00',
            maxDart: player.max_dart_score || 0,
            maxTurn: player.max_turn_score || 0,
            total100s: player.total_100s || player.total_180s || 0,
            total140plus: player.total_140_plus || 0,
            bestCheckout: player.best_checkout || 0,
            checkoutPercentage: player.checkout_percentage
                ? parseFloat(player.checkout_percentage).toFixed(1)
                : '0.0',
            headToHead: headToHead,
            recentGames: recentGames.slice(0, 5).map(game => {
                const playerData = game.players.find(p => p.name === playerName);
                return {
                    id: game.id,
                    date: new Date(game.created_at).toLocaleDateString(),
                    opponent: game.players.filter(p => p.name !== playerName).map(p => p.name).join(', '),
                    won: playerData?.winner || false,
                    darts: playerData?.stats.totalDarts || 0,
                    score: playerData?.stats.totalScore || 0
                };
            })
        };
    }

    /**
     * Calculate head-to-head records for a player
     */
    async function calculateHeadToHead(playerName) {
        const playerData = await Storage.getPlayerByName(playerName);
        if (!playerData) return {};

        const games = await Storage.getGamesForPlayer(playerData.id);
        const headToHead = {};

        (games || []).forEach(game => {
            if (!game.game_players) return;
            const myRecord = game.game_players.find(gp => gp.player_id === playerData.id);
            if (!myRecord) return;

            game.game_players.forEach(gp => {
                const oppName = gp.player?.name;
                if (!oppName || oppName === playerName) return;
                if (!headToHead[oppName]) {
                    headToHead[oppName] = { wins: 0, losses: 0 };
                }
                if (myRecord.is_winner) {
                    headToHead[oppName].wins++;
                } else if (gp.is_winner) {
                    headToHead[oppName].losses++;
                }
            });
        });

        return headToHead;
    }

    /**
     * Get leaderboard rankings
     */
    async function getLeaderboard(metric = 'wins', timeFilter = 'all-time') {
        const sortConfig = {
            'wins': { column: 'rank_by_wins', ascending: true },
            'win-rate': { column: 'rank_by_win_rate', ascending: true },
            'avg-turn': { column: 'rank_by_avg', ascending: true },
            '100s': { column: 'total_180s', ascending: false },
            'max-turn': { column: 'max_turn_score', ascending: false }
        }[metric] || { column: 'rank_by_wins', ascending: true };

        if (timeFilter === 'all-time') {
            const data = await Storage.getPlayerLeaderboard(sortConfig.column, 100);

            return (data || []).map((player, index) => ({
                rank: index + 1,
                name: player.name,
                metric: getMetricValue(metric, player),
                stats: {
                    gamesPlayed: player.total_games_played,
                    gamesWon: player.total_games_won,
                    winRate: parseFloat(player.win_rate || 0).toFixed(1),
                    totalDarts: player.total_darts_thrown,
                    total100s: player.total_180s || 0,
                    avgPerDart: parseFloat(player.avg_per_dart || 0).toFixed(2),
                    avgPerTurn: parseFloat(player.avg_per_turn || 0).toFixed(2),
                    maxTurn: player.max_turn_score || 0
                },
                fullStats: {
                    gamesPlayed: player.total_games_played,
                    gamesWon: player.total_games_won,
                    winRate: parseFloat(player.win_rate || 0).toFixed(1),
                    totalDarts: player.total_darts_thrown,
                    totalScore: player.total_score,
                    avgPerDart: parseFloat(player.avg_per_dart || 0).toFixed(2),
                    avgPerTurn: parseFloat(player.avg_per_turn || 0).toFixed(2),
                    maxDart: player.max_dart_score,
                    maxTurn: player.max_turn_score,
                    total100s: player.total_180s || 0,
                    total140plus: player.total_140_plus,
                    bestCheckout: player.best_checkout,
                    checkoutPercentage: parseFloat(player.checkout_percentage || 0).toFixed(1)
                }
            }));
        } else {
            return await getTimeFilteredLeaderboard(metric, timeFilter);
        }
    }

    /**
     * Get time-filtered leaderboard (7-day, 30-day)
     */
    async function getTimeFilteredLeaderboard(metric, timeFilter) {
        const cutoffDate = getTimeFilterDate(timeFilter);
        const cutoffISO = new Date(cutoffDate).toISOString();

        const games = await Storage.getCompletedGamesWithPlayerStats(cutoffISO);

        const playerStatsMap = {};

        (games || []).forEach(game => {
            (game.game_players || []).forEach(gp => {
                const playerName = gp.player?.name;
                const isDeleted = gp.player?.is_deleted;
                
                if (!playerName || isDeleted === true) return;
                
                if (!playerStatsMap[playerName]) {
                    playerStatsMap[playerName] = {
                        gamesPlayed: 0, gamesWon: 0, totalDarts: 0, totalScore: 0,
                        totalTurns: 0, total100s: 0, maxTurn: 0
                    };
                }
                const stats = playerStatsMap[playerName];
                stats.gamesPlayed++;
                if (gp.is_winner) stats.gamesWon++;
                stats.totalDarts += gp.total_darts || 0;
                stats.totalScore += gp.total_score || 0;
                stats.totalTurns += gp.total_turns || 0;
                stats.total100s += gp.count_180s || 0;
                stats.maxTurn = Math.max(stats.maxTurn, gp.max_turn || 0);
            });
        });

        const rankings = Object.entries(playerStatsMap).map(([name, stats]) => {
            const winRate = stats.gamesPlayed > 0
                ? (stats.gamesWon / stats.gamesPlayed * 100).toFixed(1)
                : '0.0';
            const avgPerDart = stats.totalDarts > 0
                ? (stats.totalScore / stats.totalDarts).toFixed(2)
                : '0.00';

            const playerStats = {
                gamesPlayed: stats.gamesPlayed,
                gamesWon: stats.gamesWon,
                winRate: winRate,
                totalDarts: stats.totalDarts,
                total100s: stats.total100s,
                avgPerDart: avgPerDart,
                avgPerTurn: stats.totalTurns > 0 ? (stats.totalScore / stats.totalTurns).toFixed(2) : '0.00',
                maxTurn: stats.maxTurn
            };

            return {
                name: name,
                metric: getMetricValue(metric, playerStats),
                stats: playerStats,
                fullStats: playerStats
            };
        });

        rankings.sort((a, b) => {
            const aVal = parseFloat(a.metric) || 0;
            const bVal = parseFloat(b.metric) || 0;
            return bVal - aVal;
        });

        return rankings.map((r, i) => ({ ...r, rank: i + 1 }));
    }

    /**
     * Calculate stats for specific games
     */
    function calculateStatsForGames(gamesArray, playerName) {
        const stats = {
            gamesPlayed: 0, gamesWon: 0, winRate: 0,
            totalDarts: 0, total100s: 0, avgPerDart: 0
        };

        let totalTurns = 0;
        let totalScore = 0;

        gamesArray.forEach(game => {
            const player = game.players.find(p => p.name === playerName);
            if (!player) return;

            stats.gamesPlayed++;
            if (player.winner) stats.gamesWon++;
            stats.totalDarts += player.stats.totalDarts || 0;
            totalScore += player.stats.totalScore || 0;
            totalTurns += player.turns?.length || 0;

            (player.turns || []).forEach(turn => {
                const turnTotal = turn.darts.reduce((a, b) => a + b, 0);
                if (turnTotal >= 100) stats.total100s++;
            });
        });

        if (stats.totalDarts > 0) stats.avgPerDart = (totalScore / stats.totalDarts).toFixed(2);
        if (stats.gamesPlayed > 0) stats.winRate = (stats.gamesWon / stats.gamesPlayed * 100).toFixed(1);

        return stats;
    }

    function getTimeFilterDate(filter) {
        const now = Date.now();
        switch (filter) {
            case '7-days': return now - (7 * 24 * 60 * 60 * 1000);
            case '30-days': return now - (30 * 24 * 60 * 60 * 1000);
            case 'all-time':
            default: return 0;
        }
    }

    function getMetricValue(metric, stats) {
        switch (metric) {
            case 'wins': return stats.gamesWon || stats.total_games_won || 0;
            case 'win-rate': return parseFloat(stats.winRate || stats.win_rate || 0);
            case 'avg-turn': return parseFloat(stats.avgPerTurn || stats.avg_per_turn || stats.avgPerDart || stats.avg_per_dart || 0);
            case '100s': return stats.total100s || stats.total_180s || 0;
            case 'max-turn': return stats.maxTurn || stats.max_turn_score || stats.max_turn || 0;
            default: return 0;
        }
    }

    /**
     * Get quick stats overview for home page
     */
    async function getQuickStats() {
        const [totalGames, totalPlayers, leaderboard] = await Promise.all([
            Storage.countCompletedGames(),
            Storage.countPlayersWithGames(),
            Storage.getPlayerLeaderboard('max_turn_score', 1)
        ]);

        return {
            totalGames,
            totalPlayers,
            highTurn: (leaderboard && leaderboard.length > 0) ? (leaderboard[0].max_turn_score || 0) : 0
        };
    }

    /**
     * Get today's stats
     */
    async function getTodayStats() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        try {
            const games = await Storage.getCompletedGamesWithPlayerStats(todayISO);

            let bestAvg = 0, highTurn = 0, bestAvgPlayer = null, highTurnPlayer = null;

            if (games && games.length > 0) {
                const gameIds = games.map(g => g.id);
                const playerStats = await Storage.getGamePlayersByGameIds(gameIds);

                (playerStats || []).forEach(ps => {
                    if (ps.avg_per_turn && ps.avg_per_turn > bestAvg) {
                        bestAvg = ps.avg_per_turn;
                        bestAvgPlayer = ps.player?.name || null;
                    }
                    if (ps.max_turn && ps.max_turn > highTurn) {
                        highTurn = ps.max_turn;
                        highTurnPlayer = ps.player?.name || null;
                    }
                });
            }

            return {
                gamesPlayed: games?.length || 0,
                bestAvg: bestAvg > 0 ? bestAvg.toFixed(1) : null,
                bestAvgPlayer,
                highTurn: highTurn > 0 ? highTurn : null,
                highTurnPlayer
            };
        } catch (e) {
            console.error('Error getting today stats:', e);
            return { gamesPlayed: 0, bestAvg: null, highTurn: null, bestAvgPlayer: null, highTurnPlayer: null };
        }
    }

    function formatStat(value, type = 'number') {
        if (value === null || value === undefined) return '—';
        switch (type) {
            case 'percentage': return `${parseFloat(value).toFixed(1)}%`;
            case 'decimal': return parseFloat(value).toFixed(2);
            case 'integer': return Math.floor(value);
            default: return value.toString();
        }
    }

    /**
     * Get comparison between two players
     */
    async function comparePlayerStats(playerName1, playerName2) {
        const [stats1, stats2, headToHead] = await Promise.all([
            calculatePlayerStats(playerName1),
            calculatePlayerStats(playerName2),
            getHeadToHeadRecord(playerName1, playerName2)
        ]);

        return {
            player1: { name: playerName1, ...stats1 },
            player2: { name: playerName2, ...stats2 },
            headToHeadRecord: headToHead
        };
    }

    /**
     * Get head to head record between two players
     */
    async function getHeadToHeadRecord(playerName1, playerName2) {
        const players = await Storage.getPlayersByNames([playerName1, playerName2]);

        if (!players || players.length !== 2) {
            return { wins: 0, losses: 0, total: 0 };
        }

        const player1Id = players.find(p => p.name === playerName1)?.id;
        const player2Id = players.find(p => p.name === playerName2)?.id;

        const games = await Storage.getHeadToHeadGames(player1Id, player2Id);

        let wins1 = 0, wins2 = 0;

        (games || []).forEach(game => {
            const p1Data = game.game_players.find(gp => gp.player_id === player1Id);
            const p2Data = game.game_players.find(gp => gp.player_id === player2Id);
            if (p1Data && p2Data) {
                if (p1Data.is_winner) wins1++;
                else if (p2Data.is_winner) wins2++;
            }
        });

        return { wins: wins1, losses: wins2, total: wins1 + wins2 };
    }

    /**
     * Get turn score distribution for charts
     */
    async function getScoreDistribution(playerName) {
        const playerData = await Storage.getPlayerByName(playerName);
        if (!playerData) return { range0_19: 0, range20_39: 0, range40_59: 0, range60_99: 0, range100_139: 0, range140_179: 0, range180: 0 };

        const turns = await Storage.getTurnsForPlayer(playerData.id);

        const distribution = {
            range0_19: 0,
            range20_39: 0,
            range40_59: 0,
            range60_99: 0,
            range100_139: 0,
            range140_179: 0,
            range180: 0
        };

        (turns || []).forEach(turn => {
            const score = turn.turn_total || 0;
            if (score >= 180) distribution.range180++;
            else if (score >= 140) distribution.range140_179++;
            else if (score >= 100) distribution.range100_139++;
            else if (score >= 60) distribution.range60_99++;
            else if (score >= 40) distribution.range40_59++;
            else if (score >= 20) distribution.range20_39++;
            else distribution.range0_19++;
        });

        return distribution;
    }

    async function calculatePracticeStats(playerName) {
        const allGames = await Storage.getAllPlayerGames(playerName);
        const practiceGames = allGames.filter(g => g.is_practice && g.completed_at);

        if (practiceGames.length === 0) return null;

        let gamesPlayed = 0;
        let totalDarts = 0;
        let totalScore = 0;
        let totalTurns = 0;
        let maxTurn = 0;
        let total100s = 0;
        let total140plus = 0;

        practiceGames.forEach(game => {
            const playerInGame = game.game_players.find(p => p.player.name === playerName);
            if (!playerInGame) return;

            gamesPlayed++;
            totalDarts += playerInGame.total_darts || 0;
            totalScore += playerInGame.total_score || 0;
            totalTurns += playerInGame.total_turns || 0;
            if ((playerInGame.max_turn || 0) > maxTurn) {
                maxTurn = playerInGame.max_turn;
            }
            total100s += playerInGame.count_180s || 0;
            total140plus += playerInGame.count_140_plus || 0;
        });

        const avgPerTurn = totalTurns > 0 ? (totalScore / totalTurns).toFixed(2) : '0.00';
        const avgPerDart = totalDarts > 0 ? (totalScore / totalDarts).toFixed(2) : '0.00';

        return {
            gamesPlayed,
            totalDarts,
            totalScore,
            totalTurns,
            avgPerTurn,
            avgPerDart,
            maxTurn,
            total100s,
            total140plus,
        };
    }

    /**
     * Get recent game performance data for charts
     */
    async function getRecentPerformance(playerName, limit = 10) {
        const games = await Storage.getPlayerGames(playerName, limit);

        return games.map(game => {
            const playerData = game.players.find(p => p.name === playerName);
            const darts = playerData?.stats?.totalDarts || 0;
            const score = playerData?.stats?.totalScore || 0;
            const turns = playerData?.totalTurns || playerData?.stats?.totalTurns || playerData?.turns?.length || 0;

            return {
                id: game.id,
                date: new Date(game.created_at).toLocaleDateString(),
                avgPerDart: darts > 0 ? (score / darts).toFixed(2) : '0.00',
                avgPerTurn: turns > 0 ? (score / turns).toFixed(2) : '0.00',
                won: playerData?.winner || false,
                darts: darts,
                score: score,
                turns: turns
            };
        });
    }

    /**
     * Get comprehensive global statistics
     */
    async function getGlobalStats() {
        try {
            const [totalGames, players, leaderboard] = await Promise.all([
                Storage.countCompletedGames(),
                Storage.getAllPlayersWithStats(),
                Storage.getPlayerLeaderboard('rank_by_wins', 10)
            ]);

            let totalDarts = 0, totalScore = 0, total100s = 0, total140plus = 0;
            let highestAvg = 0, highestAvgPlayer = '';
            let most100s = 0, most100sPlayer = '';
            let highestMaxTurn = 0, highestMaxTurnPlayer = '';

            (players || []).forEach(p => {
                totalDarts += p.total_darts_thrown || 0;
                totalScore += p.total_score || 0;
                // DB column is total_180s but local uses total_100s (both store 100+ count)
                const p100s = p.total_100s || p.total_180s || 0;
                total100s += p100s;
                total140plus += p.total_140_plus || 0;

                const avg = parseFloat(p.avg_per_turn) || 0;
                if (avg > highestAvg) { highestAvg = avg; highestAvgPlayer = p.name; }
                if (p100s > most100s) { most100s = p100s; most100sPlayer = p.name; }
                if ((p.max_turn_score || 0) > highestMaxTurn) { highestMaxTurn = p.max_turn_score || 0; highestMaxTurnPlayer = p.name; }
            });

            return {
                totalGames,
                totalPlayers: (players || []).length,
                totalDarts,
                totalScore,
                total100s,
                total140plus,
                averagePerDart: totalDarts > 0 ? (totalScore / totalDarts).toFixed(2) : '0.00',
                records: {
                    highestAvg: highestAvg.toFixed(2),
                    highestAvgPlayer,
                    most100s,
                    most100sPlayer,
                    highestMaxTurn,
                    highestMaxTurnPlayer
                },
                topPlayers: leaderboard || [],
                players: (players || []).map(p => ({
                    name: p.name,
                    gamesPlayed: p.total_games_played,
                    gamesWon: p.total_games_won
                }))
            };
        } catch (e) {
            console.error('Error getting global stats:', e);
            return {
                totalGames: 0, totalPlayers: 0, totalDarts: 0, totalScore: 0,
                total100s: 0, total140plus: 0, averagePerDart: '0.00',
                records: {}, topPlayers: [], players: []
            };
        }
    }

    /**
     * Get all player names for dropdown
     */
    async function getAllPlayerNames() {
        try {
            const playersObj = await Storage.getPlayers();
            return Object.keys(playersObj || {}).sort();
        } catch (e) {
            console.error('Error getting player names:', e);
            return [];
        }
    }

    function getEmptyStats() {
        return {
            gamesPlayed: 0, gamesWon: 0, winRate: '0.0',
            totalDarts: 0, totalScore: 0, avgPerDart: '0.00', avgPerTurn: '0.00',
            maxDart: 0, maxTurn: 0, total100s: 0, total140plus: 0,
            bestCheckout: 0, checkoutPercentage: '0.0',
            headToHead: {}, recentGames: []
        };
    }

    return {
        calculatePlayerStats,
        getLeaderboard,
        calculateStatsForGames,
        getTimeFilterDate,
        getMetricValue,
        getQuickStats,
        getTodayStats,
        formatStat,
        comparePlayerStats,
        getHeadToHeadRecord,
        getScoreDistribution,
        getRecentPerformance,
        getGlobalStats,
        getAllPlayerNames,
        calculatePracticeStats
    };
})();
