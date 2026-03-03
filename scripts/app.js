/**
 * Main App Module
 * Handles routing, event listeners, and app state
 */

const App = (() => {
    let currentGame = null;
    let isSpectatorMode = false;
    let isOperationInProgress = false;
    let spectatorSubscription = null;
    let homeSubscription = null;

    /**
     * Check if an operation is in progress
     */
    function isOperationPending() {
        return isOperationInProgress;
    }

    /**
     * Mark operation as started
     */
    function startOperation() {
        isOperationInProgress = true;
    }

    /**
     * Mark operation as complete
     */
    function endOperation() {
        isOperationInProgress = false;
    }

    // Competition state
    let currentTournament = null;
    let currentLeague = null;

    // Tournament state persistence keys
    const TOURNAMENT_STATE_KEY = 'dart_bee_active_tournament';
    const LEAGUE_STATE_KEY = 'dart_bee_active_league';

    /**
     * Save tournament state to localStorage for persistence
     */
    function saveTournamentState(tournamentId) {
        if (tournamentId) {
            localStorage.setItem(TOURNAMENT_STATE_KEY, tournamentId);
        } else {
            localStorage.removeItem(TOURNAMENT_STATE_KEY);
        }
    }

    /**
     * Load tournament state from localStorage
     */
    function loadTournamentState() {
        return localStorage.getItem(TOURNAMENT_STATE_KEY);
    }

    /**
     * Save league state to localStorage for persistence
     */
    function saveLeagueState(leagueId) {
        if (leagueId) {
            localStorage.setItem(LEAGUE_STATE_KEY, leagueId);
        } else {
            localStorage.removeItem(LEAGUE_STATE_KEY);
        }
    }

    /**
     * Load league state from localStorage
     */
    function loadLeagueState() {
        return localStorage.getItem(LEAGUE_STATE_KEY);
    }

    /**
     * Get active competition info (tournament or league)
     */
    async function getActiveCompetition() {
        const tournamentId = loadTournamentState();
        if (tournamentId) {
            try {
                const tournament = await Storage.getTournament(tournamentId);
                if (tournament && tournament.status === 'in_progress') {
                    return { type: 'tournament', id: tournamentId, data: tournament };
                } else if (tournament && tournament.status === 'completed') {
                    // Clear completed tournament state
                    saveTournamentState(null);
                }
            } catch (e) {
                console.warn('Error loading tournament state:', e);
                saveTournamentState(null);
            }
        }

        const leagueId = loadLeagueState();
        if (leagueId) {
            try {
                const league = await Storage.getLeague(leagueId);
                if (league && league.status === 'in_progress') {
                    return { type: 'league', id: leagueId, data: league };
                } else if (league && league.status === 'completed') {
                    // Clear completed league state
                    saveLeagueState(null);
                }
            } catch (e) {
                console.warn('Error loading league state:', e);
                saveLeagueState(null);
            }
        }

        return null;
    }

    /**
     * Initialize the app and setup all event listeners
     */
    function init() {
        setupNavigation();
        setupHomeEvents();
        setupNewGameEvents();
        setupGameEvents();
        setupHistoryEvents();
        setupLeaderboardEvents();
        setupStatsEvents();
        setupModalEvents();
        setupCompetitionEvents();
        setupPlayerManagementEvents();
        setupPracticeEvents();
        setupDeleteEvents();

        // Initialize Lucide icons on start
        initIcons();
    }

    /**
     * Handle route changes from router
     */
    async function handleRoute(routeInfo) {
        console.log('Handling route:', routeInfo);

        // Clean up subscriptions when navigating away
        if (isSpectatorMode && routeInfo.route !== 'game') {
            unsubscribeFromGameUpdates();
            isSpectatorMode = false;
        }
        if (routeInfo.route !== 'home') {
            unsubscribeFromHomeUpdates();
        }

        try {
            switch (routeInfo.route) {
                case 'home':
                    loadHome();
                    break;

                case 'game':
                    await loadGameFromUrl(routeInfo.gameId);
                    break;

                case 'new-game':
                    loadNewGame();
                    break;

                case 'history':
                    await loadHistory();
                    break;

                case 'game-detail':
                    await App.viewGameDetail(routeInfo.gameId);
                    break;

                case 'leaderboard':
                    await loadLeaderboard(routeInfo.metric, routeInfo.filter);
                    break;

                case 'player-profile':
                    await App.viewPlayerProfile(routeInfo.playerName);
                    break;

                // Competition routes
                case 'competitions':
                    await loadCompetitions();
                    break;

                case 'new-tournament':
                    loadNewTournament();
                    break;

                case 'tournament':
                    await loadTournament(routeInfo.tournamentId);
                    break;

                case 'new-league':
                    loadNewLeague();
                    break;

                case 'league':
                    await loadLeague(routeInfo.leagueId);
                    break;

                case 'practice':
                    await loadPractice();
                    break;

                case 'stats':
                    await loadStats();
                    break;

                case 'players':
                    await loadPlayers();
                    break;

                default:
                    loadHome();
            }
        } catch (error) {
            console.error('Route handling error:', error);
            loadHome();
        }
    }

    /**
     * Load game from URL - determine if active or spectator
     */
    async function loadGameFromUrl(gameId) {
        UI.showLoader('Loading game...');
        try {
            const game = await Storage.getGame(gameId);
            if (!game) {
                UI.showToast('Game not found', 'error');
                loadHome();
                UI.hideLoader();
                return;
            }

            // Fetch competition context (tournament/league) if this game is part of one
            console.log('=== Loading Game Competition Context ===');
            const competitionContext = await Storage.getGameCompetitionContext(gameId);
            console.log('Competition context result:', competitionContext);
            if (competitionContext) {
                if (competitionContext.type === 'tournament') {
                    game.tournament_id = competitionContext.tournament_id;
                    game.tournament_match_id = competitionContext.tournament_match_id;
                    console.log('Game is part of tournament:', competitionContext.tournament_id, 'match:', competitionContext.tournament_match_id);
                } else if (competitionContext.type === 'league') {
                    game.league_id = competitionContext.league_id;
                    game.league_match_id = competitionContext.league_match_id;
                    console.log('Game is part of league:', competitionContext.league_id);
                }
            } else {
                console.log('No competition context found for this game');
            }

            currentGame = game;
            isSpectatorMode = !Device.isGameOwner(game.device_id);

            if (isSpectatorMode) {
                console.log('Opening game in SPECTATOR mode');
                UI.showToast('📺 Viewing as Spectator', 'info');
                loadSpectatorGame();
            } else {
                console.log('Opening game in ACTIVE mode');
                UI.showToast('🎮 Game Resumed', 'info');
                loadActiveGame();
            }

            // Show competition context banner if applicable
            await showCompetitionContextBanner(game);

            UI.hideLoader();
        } catch (error) {
            console.error('Error loading game:', error);
            UI.showToast('Failed to load game', 'error');
            loadHome();
            UI.hideLoader();
        }
    }

    /**
     * Show competition context banner for tournament/league matches
     */
    async function showCompetitionContextBanner(game) {
        const banner = document.getElementById('competition-context-banner');
        const nameEl = document.getElementById('context-competition-name');
        const roundEl = document.getElementById('context-round-name');
        const backBtn = document.getElementById('back-to-bracket-btn');

        if (!banner) return;

        // Hide by default
        banner.classList.add('hidden');

        if (game.tournament_id) {
            try {
                const tournament = await Storage.getTournament(game.tournament_id);
                if (tournament) {
                    const match = tournament.matches?.find(m => m.game_id === game.id);
                    const totalRounds = Math.log2(tournament.max_players);
                    const roundName = match ? Tournament.getRoundName(match.round, totalRounds, tournament.format) : 'Match';

                    nameEl.textContent = tournament.name;
                    roundEl.textContent = roundName;
                    banner.querySelector('.context-icon').textContent = '🏆';

                    // Setup back button
                    backBtn.onclick = () => {
                        Router.navigate('tournament', { tournamentId: game.tournament_id });
                    };
                    backBtn.textContent = 'Back to Bracket';

                    banner.classList.remove('hidden');
                }
            } catch (e) {
                console.warn('Error loading tournament context:', e);
            }
        } else if (game.league_id) {
            try {
                const league = await Storage.getLeague(game.league_id);
                if (league) {
                    const match = league.matches?.find(m => m.game_id === game.id);
                    const roundName = match ? `Round ${match.round}` : 'Match';

                    nameEl.textContent = league.name;
                    roundEl.textContent = roundName;
                    banner.querySelector('.context-icon').textContent = '📊';

                    // Setup back button
                    backBtn.onclick = () => {
                        Router.navigate('league', { leagueId: game.league_id });
                    };
                    backBtn.textContent = 'Back to League';

                    banner.classList.remove('hidden');
                }
            } catch (e) {
                console.warn('Error loading league context:', e);
            }
        }
    }

    /**
     * Check if running in spectator mode
     */
    function getIsSpectatorMode() {
        return isSpectatorMode;
    }

    /**
     * Setup navigation listeners
     */
    function setupNavigation() {
        // Handle navbar brand click to go home
        const navbarBrand = document.querySelector('.navbar-brand');
        if (navbarBrand) {
            navbarBrand.style.cursor = 'pointer';
            navbarBrand.addEventListener('click', () => {
                Router.navigate('home');
            });
        }

        // Desktop nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                Router.navigate(page);
            });
        });

        // Mobile bottom nav links
        document.querySelectorAll('.mobile-nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                Router.navigate(page);
            });
        });
    }

    /**
     * Initialize Lucide icons
     */
    function initIcons() {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    /**
     * Setup home page events
     */
    function setupHomeEvents() {
        // Hero new game button
        document.getElementById('hero-new-game')?.addEventListener('click', () => {
            Router.navigate('new-game');
        });

        // Hero Quick Action cards
        document.querySelectorAll('.quick-action-card').forEach(card => {
            card.addEventListener('click', async () => {
                if (card.dataset.quickGame) {
                    const gameType = parseInt(card.dataset.quickGame);
                    await showQuickPlayerSelect(gameType);
                } else if (card.dataset.navigate) {
                    Router.navigate(card.dataset.navigate);
                }
            });
        });

        // Quick start buttons (501, 301)
        document.querySelectorAll('.btn-quick[data-game]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const gameType = parseInt(btn.dataset.game);
                await showQuickPlayerSelect(gameType);
            });
        });
    }

    /**
     * Show quick player selection modal
     */
    async function showQuickPlayerSelect(gameType) {
        UI.showLoader('Loading players...');
        try {
            const playersMap = await Storage.getPlayers();
            const playerNames = Object.keys(playersMap).sort();

            if (playerNames.length === 0) {
                UI.hideLoader();
                UI.showToast('No players found. Please add players first.', 'warning');
                Router.navigate('players');
                return;
            }

            const content = document.createElement('div');
            content.className = 'quick-player-modal';
            content.innerHTML = `
                <p class="text-muted mb-lg">Select 2 or more players to start a ${gameType} game.</p>
                <div class="player-selection-grid" id="quick-player-grid">
                    ${playerNames.map(name => `
                        <div class="player-select-card" data-name="${name}">
                            <div class="player-select-avatar">👤</div>
                            <div class="player-select-name">${name}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="selection-footer">
                    <div class="selection-count"><span id="selected-count">0</span> players selected (min 2)</div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-secondary btn-small" id="cancel-quick-btn">Cancel</button>
                        <button class="btn btn-primary btn-small" id="start-quick-btn" disabled title="Select at least 2 players">Start Game</button>
                    </div>
                </div>
            `;

            UI.showModal(content, `Quick ${gameType} - Select Players`);
            UI.hideLoader();

            const grid = document.getElementById('quick-player-grid');
            const startBtn = document.getElementById('start-quick-btn');
            const cancelBtn = document.getElementById('cancel-quick-btn');
            const countEl = document.getElementById('selected-count');
            const selectedPlayers = new Set();

            grid.querySelectorAll('.player-select-card').forEach(card => {
                card.onclick = () => {
                    const name = card.dataset.name;
                    if (selectedPlayers.has(name)) {
                        selectedPlayers.delete(name);
                        card.classList.remove('selected');
                    } else {
                        selectedPlayers.add(name);
                        card.classList.add('selected');
                    }

                    const count = selectedPlayers.size;
                    countEl.textContent = count;
                    startBtn.disabled = count < 2;
                };
            });

            startBtn.onclick = async () => {
                UI.hideModal();
                await startQuickGame(gameType, Array.from(selectedPlayers));
            };

            cancelBtn.onclick = () => UI.hideModal();

        } catch (error) {
            console.error('Error loading players for quick select:', error);
            UI.hideLoader();
            UI.showToast('Failed to load players', 'error');
        }
    }

    /**
     * Start a quick game with default settings
     */
    async function startQuickGame(gameType = 501, selectedPlayers = []) {
        // Fallback if no players provided (shouldn't happen with modal)
        const players = selectedPlayers.length > 0 ? selectedPlayers : ['Player 1', 'Player 2'];

        currentGame = Game.createGame({
            playerCount: players.length,
            playerNames: players,
            gameType: gameType,
            winBelow: true, // Amateur mode by default
            scoringMode: 'per-turn'
        });

        try {
            await Storage.saveGame(currentGame);
            Router.navigate('game', { gameId: currentGame.id });
        } catch (error) {
            console.error('Failed to start quick game:', error);
            UI.showToast('Failed to start game', 'error');
        }
    }

    /**
     * Setup new game form events
     */
    function setupNewGameEvents() {
        const form = document.getElementById('new-game-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const playerCount = parseInt(document.getElementById('player-count').value);
                const playerNames = Array.from(document.querySelectorAll('#player-names-container input'))
                    .map(input => input.value);

                let gameType = document.querySelector('input[name="gameType"]:checked')?.value || '501';
                if (gameType === 'custom') {
                    gameType = document.getElementById('custom-points').value;
                }

                const winBelow = document.getElementById('win-below').checked;
                const scoringMode = document.querySelector('input[name="scoringMode"]:checked').value;

                currentGame = Game.createGame({
                    playerCount,
                    playerNames,
                    gameType,
                    winBelow,
                    scoringMode
                });

                try {
                    await Storage.saveGame(currentGame);
                    // Navigate to game URL instead of loading directly
                    Router.navigate('game', { gameId: currentGame.id });
                } catch (error) {
                    UI.showToast('Failed to save game', 'error');
                    console.error('Save game error:', error);
                }
            });
        }
    }

    /**
     * Setup active game events
     */
    function setupGameEvents() {
        document.getElementById('submit-turn-btn')?.addEventListener('click', submitTurn);
        document.getElementById('undo-dart-btn')?.addEventListener('click', undoTurn);
        document.getElementById('end-game-btn')?.addEventListener('click', endGame);
        document.getElementById('share-game-btn')?.addEventListener('click', shareGame);
        document.getElementById('rematch-btn')?.addEventListener('click', startRematch);
        document.getElementById('home-btn')?.addEventListener('click', () => {
            Router.navigate('home');
        });

        // Sound toggle
        const soundBtn = document.getElementById('sound-toggle-btn');
        if (soundBtn) {
            // Set initial icon from stored state
            soundBtn.textContent = SoundFX.isEnabled() ? '🔊' : '🔇';
            soundBtn.addEventListener('click', () => {
                const enabled = SoundFX.toggle();
                soundBtn.textContent = enabled ? '🔊' : '🔇';
            });
        }
    }

    /**
     * Setup history page events
     */
    function setupHistoryEvents() {
        const playerFilter = document.getElementById('history-player-filter');
        const sortSelect = document.getElementById('history-sort');
        const showPracticeCheck = document.getElementById('history-show-practice');
        const showIncompleteCheck = document.getElementById('history-show-incomplete');

        if (playerFilter) {
            playerFilter.addEventListener('change', async (e) => {
                await UI.renderGameHistory(e.target.value, sortSelect.value, 1, showPracticeCheck?.checked, showIncompleteCheck?.checked);
            });
        }

        if (sortSelect) {
            sortSelect.addEventListener('change', async (e) => {
                await UI.renderGameHistory(playerFilter?.value || '', e.target.value, 1, showPracticeCheck?.checked, showIncompleteCheck?.checked);
            });
        }

        if (showPracticeCheck) {
            showPracticeCheck.addEventListener('change', async (e) => {
                await UI.renderGameHistory(playerFilter?.value || '', sortSelect.value, 1, e.target.checked, showIncompleteCheck?.checked);
            });
        }

        if (showIncompleteCheck) {
            showIncompleteCheck.addEventListener('change', async (e) => {
                await UI.renderGameHistory(playerFilter?.value || '', sortSelect.value, 1, showPracticeCheck?.checked, e.target.checked);
            });
        }

        // Pagination button events
        const paginationPrev = document.getElementById('pagination-prev');
        const paginationNext = document.getElementById('pagination-next');

        if (paginationPrev) {
            paginationPrev.addEventListener('click', async (e) => {
                e.preventDefault();
                const state = UI.getPaginationState();
                await UI.renderGameHistory(
                    state.filter,
                    state.sortOrder,
                    state.currentPage - 1,
                    state.includePractice,
                    state.showIncomplete
                );
            });
        }

        if (paginationNext) {
            paginationNext.addEventListener('click', async (e) => {
                e.preventDefault();
                const state = UI.getPaginationState();
                await UI.renderGameHistory(
                    state.filter,
                    state.sortOrder,
                    state.currentPage + 1,
                    state.includePractice,
                    state.showIncomplete
                );
            });
        }

        const backBtn = document.getElementById('back-to-history');
        if (backBtn) {
            backBtn.addEventListener('click', loadHistory);
        }
    }

    /**
     * Setup leaderboard events
     */
    function setupLeaderboardEvents() {
        // Time filters - navigate to update URL
        document.querySelectorAll('.time-filters .filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                const metric = document.querySelector('.leaderboard-tabs .tab-btn.active').dataset.tab;
                Router.navigate('leaderboard', { metric, filter });
            });
        });

        // Metric tabs - navigate to update URL
        document.querySelectorAll('.leaderboard-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const metric = e.target.dataset.tab;
                const filter = document.querySelector('.time-filters .filter-btn.active').dataset.filter;
                Router.navigate('leaderboard', { metric, filter });
            });
        });

        // Back to leaderboard from profile - preserve current tab state
        const backBtn = document.getElementById('back-to-leaderboard');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                const metric = document.querySelector('.leaderboard-tabs .tab-btn.active')?.dataset.tab || 'avg-turn';
                const filter = document.querySelector('.time-filters .filter-btn.active')?.dataset.filter || 'all-time';
                console.log('[back] Navigating to leaderboard:', metric, filter);
                Router.navigate('leaderboard', { metric, filter });
            });
        }
    }

    /**
     * Setup modal events
     */
    function setupModalEvents() {
        const modalClose = document.getElementById('modal-close');
        const modal = document.getElementById('modal');
        
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                if (typeof UI !== 'undefined') UI.hideModal();
            });
        }
        
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.id === 'modal' && typeof UI !== 'undefined') {
                    UI.hideModal();
                }
            });
        }
    }

    /**
     * Load home page
     */
    async function loadHome() {
        UI.showLoader('Loading dashboard...');
        try {
            UI.showPage('home-page');
            await UI.renderRecentGames();
            await UI.renderQuickStats();
            // Subscribe to live updates for active games
            subscribeToHomeUpdates();
        } catch (error) {
            console.error('Error loading home:', error);
            UI.showToast('Failed to load dashboard', 'error');
        } finally {
            UI.hideLoader();
        }
    }

    /**
     * Subscribe to real-time updates for home page (active games)
     */
    function subscribeToHomeUpdates() {
        unsubscribeFromHomeUpdates();

        const supabase = Storage.sb;
        if (!supabase) return;

        homeSubscription = supabase
            .channel('home-games')
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'games'
                },
                async () => {
                    console.log('Games table updated, refreshing home...');
                    await UI.renderRecentGames();
                }
            )
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'game_players'
                },
                async () => {
                    console.log('Game players updated, refreshing home...');
                    await UI.renderRecentGames();
                }
            )
            .on('postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'turns'
                },
                async () => {
                    console.log('New turn added, refreshing home...');
                    await UI.renderRecentGames();
                }
            )
            .subscribe((status) => {
                console.log('Home subscription status:', status);
            });
    }

    /**
     * Unsubscribe from home updates
     */
    function unsubscribeFromHomeUpdates() {
        if (homeSubscription) {
            Storage.sb?.removeChannel(homeSubscription);
            homeSubscription = null;
        }
    }

    /**
     * Load new game page
     */
    function loadNewGame() {
        UI.showPage('new-game-page');
        UI.renderNewGameForm();
    }

    /**
     * Load active game page
     */
    function loadActiveGame() {
        if (!currentGame) return;
        UI.showPage('active-game-page');
        UI.updateActiveGameUI(currentGame);
    }

    /**
     * Load game in spectator mode (read-only) with live updates
     */
    async function loadSpectatorGame() {
        if (!currentGame) return;
        UI.showPage('active-game-page');
        UI.renderSpectatorGame(currentGame);

        // Subscribe to real-time updates
        await subscribeToGameUpdates(currentGame.id);
    }

    /**
     * Subscribe to real-time game updates for spectator mode
     */
    async function subscribeToGameUpdates(gameId) {
        // Clean up any existing subscription
        unsubscribeFromGameUpdates();

        const supabase = Storage.sb;
        if (!supabase) {
            console.warn('Supabase not available for real-time updates');
            return;
        }

        spectatorSubscription = supabase
            .channel(`spectator:${gameId}`)
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'games',
                    filter: `id=eq.${gameId}`
                },
                async (payload) => {
                    console.log('Game updated (spectator):', payload);
                    // Reload the full game to get player data
                    const updatedGame = await Storage.getGame(gameId);
                    if (updatedGame) {
                        currentGame = updatedGame;
                        UI.renderSpectatorGame(currentGame);
                    }
                }
            )
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'game_players',
                    filter: `game_id=eq.${gameId}`
                },
                async () => {
                    // Player stats updated, reload game
                    const updatedGame = await Storage.getGame(gameId);
                    if (updatedGame) {
                        currentGame = updatedGame;
                        UI.renderSpectatorGame(currentGame);
                    }
                }
            )
            .on('postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'turns'
                },
                async () => {
                    // New turn added, reload game
                    const updatedGame = await Storage.getGame(gameId);
                    if (updatedGame) {
                        currentGame = updatedGame;
                        UI.renderSpectatorGame(currentGame);
                    }
                }
            )
            .subscribe((status) => {
                console.log('Spectator subscription status:', status);
                if (status === 'SUBSCRIBED') {
                    UI.showLiveIndicator(true);
                } else if (status === 'CHANNEL_ERROR') {
                    UI.showLiveIndicator(false);
                }
            });
    }

    /**
     * Unsubscribe from game updates
     */
    function unsubscribeFromGameUpdates() {
        if (spectatorSubscription) {
            Storage.sb?.removeChannel(spectatorSubscription);
            spectatorSubscription = null;
            UI.showLiveIndicator(false);
        }
    }

    /**
     * Load history page
     */
    async function loadHistory() {
        const gameDetailPage = document.getElementById('game-detail-page');
        if (gameDetailPage) gameDetailPage.classList.add('hidden');
        document.getElementById('history-page').classList.remove('hidden');
        UI.showPage('history-page');
        
        await populateHistoryPlayerFilter();
        
        const playerFilter = document.getElementById('history-player-filter');
        const sortSelect = document.getElementById('history-sort');
        const showPracticeCheck = document.getElementById('history-show-practice');
        const showIncompleteCheck = document.getElementById('history-show-incomplete');
        
                await UI.renderGameHistory(
                    playerFilter?.value || '', 
                    sortSelect?.value || 'newest', 
                    1, 
                    showPracticeCheck?.checked || false,
                    showIncompleteCheck?.checked ? true : false
                );
    }

    /**
     * Populate the player filter dropdown in history page
     */
    async function populateHistoryPlayerFilter() {
        const filter = document.getElementById('history-player-filter');
        if (!filter) return;

        const players = await Stats.getAllPlayerNames();
        const currentValue = filter.value;
        
        let html = '<option value="">All Players</option>';
        players.forEach(name => {
            html += `<option value="${name}" ${name === currentValue ? 'selected' : ''}>${name}</option>`;
        });
        
        filter.innerHTML = html;
    }

    /**
     * Load leaderboard page
     */
    async function loadLeaderboard(metric = 'avg-turn', filter = 'all-time') {
        const profilePage = document.getElementById('player-profile-page');
        if (profilePage) profilePage.classList.add('hidden');
        document.getElementById('leaderboard-page').classList.remove('hidden');
        UI.showPage('leaderboard-page');

        // Update active states for tabs based on URL params
        document.querySelectorAll('.leaderboard-tabs .tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === metric);
        });
        document.querySelectorAll('.time-filters .filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        await UI.renderLeaderboard(metric, filter);
    }

    /**
     * Load stats page
     */
    async function loadStats() {
        UI.showPage('stats-page');
        await UI.renderStatsPage();
    }

    async function loadPlayers() {
        UI.showPage('players-page');
        await UI.renderPlayersList();
    }

    /**
     * Setup stats page events
     */
    function setupStatsEvents() {
        // Player selector change
        const playerSelect = document.getElementById('stats-player-select');
        if (playerSelect) {
            playerSelect.addEventListener('change', async (e) => {
                const playerName = e.target.value;
                await UI.renderPlayerStatsWidgets(playerName);
            });
        }

        // Compare players button
        const compareBtn = document.getElementById('compare-players-btn');
        if (compareBtn) {
            compareBtn.addEventListener('click', () => {
                UI.openComparisonModal();
            });
        }

        // Run comparison button
        const runCompareBtn = document.getElementById('run-comparison-btn');
        if (runCompareBtn) {
            runCompareBtn.addEventListener('click', () => {
                UI.runPlayerComparison();
            });
        }

        // Listen for preferences changes
        document.addEventListener('statsPreferencesChanged', async (e) => {
            const playerSelect = document.getElementById('stats-player-select');
            if (playerSelect && playerSelect.value) {
                await UI.renderPlayerStatsWidgets(playerSelect.value);
            }
        });
    }

    /**
     * Setup player management events
     */
    function setupPlayerManagementEvents() {
        const showBtn = document.getElementById('show-add-player-btn');
        const saveBtn = document.getElementById('save-player-btn');
        const cancelBtn = document.getElementById('cancel-add-player-btn');
        const nameInput = document.getElementById('new-player-name');
        const form = document.getElementById('add-player-form');
        const errorEl = document.getElementById('add-player-error');

        if (showBtn) {
            showBtn.addEventListener('click', () => {
                form.classList.remove('hidden');
                showBtn.classList.add('hidden');
                nameInput.value = '';
                errorEl.classList.add('hidden');
                nameInput.focus();
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                form.classList.add('hidden');
                showBtn.classList.remove('hidden');
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const name = nameInput.value.trim();
                if (!name) {
                    errorEl.textContent = 'Please enter a player name';
                    errorEl.classList.remove('hidden');
                    return;
                }
                const result = await Storage.addPlayer(name);
                if (result.error) {
                    errorEl.textContent = result.error;
                    errorEl.classList.remove('hidden');
                    return;
                }
                form.classList.add('hidden');
                showBtn.classList.remove('hidden');
                UI.showToast(`Player "${name}" added`, 'success');
                await UI.renderPlayersList();
            });
        }

        if (nameInput) {
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveBtn.click();
                }
            });
        }

        // Delegate clicks on players list
        const listContent = document.getElementById('players-list-content');
        if (listContent) {
            listContent.addEventListener('click', async (e) => {
                // Three-dot menu button
                const menuBtn = e.target.closest('.player-menu-btn');
                if (menuBtn) {
                    e.stopPropagation();
                    showPlayerMenu(menuBtn);
                    return;
                }

                // Restore button (deleted players)
                const restoreBtn = e.target.closest('.restore-player-btn');
                if (restoreBtn) {
                    const result = await Storage.restorePlayer(restoreBtn.dataset.playerId);
                    if (result.error) {
                        UI.showToast(result.error, 'error');
                    } else {
                        UI.showToast(`Player "${restoreBtn.dataset.playerName}" restored`, 'success');
                        await UI.renderPlayersList();
                    }
                    return;
                }

                // Player card navigation
                const playerCard = e.target.closest('.player-card');
                if (playerCard) {
                    const playerName = playerCard.dataset.playerName;
                    if (playerName) {
                        Router.navigate('player-profile', { playerName });
                    }
                }
            });

            // Close player menu when clicking outside
            document.addEventListener('click', () => {
                const openMenu = document.querySelector('.player-dropdown-menu');
                if (openMenu) openMenu.remove();
            });
        }
    }

    function showPlayerMenu(menuBtn) {
        // Remove any existing menu
        const existing = document.querySelector('.player-dropdown-menu');
        if (existing) existing.remove();

        const playerId = menuBtn.dataset.playerId;
        const playerName = menuBtn.dataset.playerName;

        const menu = document.createElement('div');
        menu.className = 'player-dropdown-menu';
        menu.innerHTML = `
            <button class="player-dropdown-item" data-action="rename">Rename</button>
            <button class="player-dropdown-item player-dropdown-item-danger" data-action="delete">Delete</button>
        `;

        // Position relative to the button
        menuBtn.style.position = 'relative';
        menuBtn.appendChild(menu);

        // Handle menu item clicks
        menu.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = e.target.dataset.action;
            menu.remove();
            if (action === 'rename') {
                showRenameModal(playerId, playerName);
            } else if (action === 'delete') {
                showDeleteConfirm(playerId, playerName);
            }
        });
    }

    function showRenameModal(playerId, currentName) {
        const content = document.createElement('div');
        content.innerHTML = `
            <div class="form-group">
                <label for="rename-input">New Name</label>
                <input type="text" id="rename-input" class="form-input" value="${currentName}" maxlength="30">
            </div>
            <p id="rename-error" class="form-error hidden"></p>
            <div style="display: flex; gap: 8px; margin-top: 16px;">
                <button class="btn btn-primary" id="confirm-rename-btn">Rename</button>
                <button class="btn btn-secondary" id="cancel-rename-btn">Cancel</button>
            </div>
        `;
        UI.showModal(content, `Rename Player`);

        const input = document.getElementById('rename-input');
        const errorEl = document.getElementById('rename-error');
        input.select();

        document.getElementById('confirm-rename-btn').addEventListener('click', async () => {
            const newName = input.value.trim();
            if (!newName) {
                errorEl.textContent = 'Please enter a name';
                errorEl.classList.remove('hidden');
                return;
            }
            if (newName === currentName) {
                UI.hideModal();
                return;
            }
            const result = await Storage.renamePlayer(playerId, newName);
            if (result.error) {
                errorEl.textContent = result.error;
                errorEl.classList.remove('hidden');
                return;
            }
            UI.hideModal();
            UI.showToast(`Player renamed to "${newName}"`, 'success');
            await UI.renderPlayersList();
        });

        document.getElementById('cancel-rename-btn').addEventListener('click', () => {
            UI.hideModal();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('confirm-rename-btn').click();
            }
        });
    }

    function showDeleteConfirm(playerId, playerName) {
        const content = document.createElement('div');
        content.innerHTML = `
            <p>Are you sure you want to delete <strong>${playerName}</strong>?</p>
            <p style="color: var(--color-text-light); font-size: 0.85rem;">The player will be removed from the player list and leaderboards. Game history will be preserved.</p>
            <div style="display: flex; gap: 8px; margin-top: 16px;">
                <button class="btn btn-danger" id="confirm-delete-btn">Delete</button>
                <button class="btn btn-secondary" id="cancel-delete-btn">Cancel</button>
            </div>
        `;
        UI.showModal(content, 'Delete Player');

        document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
            const result = await Storage.deletePlayer(playerId);
            if (result.error) {
                UI.hideModal();
                UI.showToast(result.error, 'error');
                return;
            }
            UI.hideModal();
            UI.showToast(`Player "${playerName}" deleted`, 'success');
            await UI.renderPlayersList();
        });

        document.getElementById('cancel-delete-btn').addEventListener('click', () => {
            UI.hideModal();
        });
    }

    /**
     * Provide haptic feedback if supported
     */
    function triggerHaptic(pattern = 50) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    }

    /**
     * Submit current turn
     */
    async function submitTurn() {
        if (!currentGame || isOperationInProgress) return;

        // Prevent multiple submissions
        startOperation();
        UI.showLoader('Submitting turn...');

        try {
            const inputs = document.querySelectorAll('.dart-input');
            console.log('Found dart inputs:', inputs.length);

            const darts = Array.from(inputs)
                .map(input => input.value)
                .filter(v => v);

            console.log('Darts to submit:', darts);

            if (darts.length === 0) {
                UI.showToast('Please enter at least one dart', 'warning');
                endOperation();
                UI.hideLoader();
                return;
            }

            // Track previous turn before submitting
            const previousTurn = currentGame.current_turn;

            const result = Game.submitTurn(currentGame, darts);
            console.log('Turn submission result:', result);

            if (!result.success) {
                UI.showToast(result.error, 'error');
                triggerHaptic([100, 50, 100]); // "Bust" pattern
                endOperation();
                UI.hideLoader();
                return;
            }

            // Calculate turn total for haptic feedback
            const turnTotal = darts.reduce((a, b) => parseInt(a) + parseInt(b), 0);

            console.log('Saving game to database...');
            await Storage.updateGame(currentGame.id, currentGame);
            console.log('Game saved successfully');

            // Determine if round completed (current_turn increased)
            const roundCompleted = currentGame.current_turn > previousTurn;
            console.log(`Round completed: ${roundCompleted} (prev: ${previousTurn}, curr: ${currentGame.current_turn})`);

            // Handle bust
            if (result.busted) {
                const prevIdx = (currentGame.current_player_index - 1 + currentGame.players.length) % currentGame.players.length;
                UI.bustShakeAnimation(prevIdx);
                SoundFX.play('bust');
                triggerHaptic([100, 50, 100]);
                UI.showToast('BUST! Score reverted', 'warning');
                UI.updateWinnersBoard(result.allRankings || Game.getRankings(currentGame), roundCompleted);
                UI.updateActiveGameUI(currentGame, false);
                return;
            }

            // Player finished - update winners board
            if (result.playerFinished) {
                triggerHaptic([50, 100, 50, 100, 200]); // "Celebration" pattern
                // Always animate when player finishes
                UI.updateWinnersBoard(result.allRankings, true);
                UI.showToast(`🏆 ${result.playerFinished} finished in ${['1st', '2nd', '3rd'][result.finishRank - 1] || result.finishRank + 'th'} place!`, 'success');

                // If game ended (last player finished)
                if (result.gameEnded) {
                    SoundFX.play('gameComplete');
                    UI.updateWinnersBoard(result.finalRankings, true);
                    setTimeout(() => {
                        showGameCompletionModal(result.finalRankings);
                    }, 800);
                } else {
                    SoundFX.play('playerFinish');
                    // Continue with next player
                    setTimeout(() => {
                        UI.updateActiveGameUI(currentGame, false); // Don't animate on next player setup
                        UI.showToast(`Next: ${result.nextPlayer}`, 'info');
                    }, 800);
                }
            } else {
                // Sound + haptic based on score tier
                if (turnTotal === 180) {
                    SoundFX.play('maxScore');
                    triggerHaptic(100);
                } else if (turnTotal >= 140) {
                    SoundFX.play('highScore140');
                    triggerHaptic(100);
                } else if (turnTotal >= 100) {
                    SoundFX.play('highScore');
                    triggerHaptic(100);
                } else {
                    SoundFX.play('submit');
                    triggerHaptic(40); // Subtle "click"
                }

                // Update rankings: animate only if round completed
                UI.updateWinnersBoard(result.allRankings || Game.getRankings(currentGame), roundCompleted);
                // Flash the previous player's score card
                const prevIdx = (currentGame.current_player_index - 1 + currentGame.players.length) % currentGame.players.length;
                UI.updateActiveGameUI(currentGame, false);
                UI.flashScoreCard(prevIdx);
                UI.showToast(`Next: ${result.nextPlayer}`, 'info');
            }
        } catch (error) {
            console.error('Error submitting turn:', error);
            UI.showToast('Failed to submit turn', 'error');
        } finally {
            endOperation();
            UI.hideLoader();
        }
    }

    /**
     * Undo last dart
     */
    async function undoTurn() {
        if (!currentGame) return;

        const result = Game.undoLastDart(currentGame);
        if (!result.success) {
            UI.showToast(result.error, 'warning');
            return;
        }

        await Storage.updateGame(currentGame.id, currentGame);
        UI.updateActiveGameUI(currentGame);
        UI.showToast(`Turn undone for ${result.player}`, 'info');
    }

    /**
     * End current game
     */
    async function endGame() {
        if (!currentGame) return;

        const content = document.createElement('div');
        content.innerHTML = `
            <p>Are you sure you want to end this game?</p>
            <p style="color: var(--color-text-light); font-size: 0.85rem;">The game will be marked as completed with current scores.</p>
            <div style="display: flex; gap: 8px; margin-top: 16px;">
                <button class="btn btn-danger" id="confirm-end-game-btn">End Game</button>
                <button class="btn btn-secondary" id="cancel-end-game-btn">Cancel</button>
            </div>
        `;
        UI.showModal(content, 'End Game');
        document.getElementById('confirm-end-game-btn').addEventListener('click', async () => {
            Game.endGame(currentGame);
            await Storage.updateGame(currentGame.id, currentGame);
            currentGame = null;
            UI.hideModal();
            UI.showToast('Game ended', 'info');
            Router.navigate('home');
        });
        document.getElementById('cancel-end-game-btn').addEventListener('click', () => UI.hideModal());
    }

    /**
     * Show game completion modal with final rankings
     */
    async function showGameCompletionModal(finalRankings) {
        const modal = document.getElementById('game-completion-modal');
        const rankingsDiv = document.getElementById('completion-rankings');
        const actionsDiv = document.querySelector('.completion-actions');

        if (!modal || !rankingsDiv) {
            console.error('Modal or rankings div not found!');
            return;
        }

        if (!finalRankings || !Array.isArray(finalRankings) || finalRankings.length === 0) {
            console.error('No valid rankings data available!', finalRankings);
            rankingsDiv.innerHTML = '<p>No rankings available</p>';
            modal.classList.remove('hidden');
            return;
        }

        // Helper: count 180s for a player from the game data
        function count180s(playerName) {
            if (!currentGame) return 0;
            const p = currentGame.players.find(pl => pl.name === playerName);
            if (!p) return 0;
            return p.turns.filter(t => !t.busted && t.darts.reduce((a, b) => a + b, 0) === 180).length;
        }

        // Section A: Final Rankings (enhanced)
        let rankingsHtml = '<div class="final-rankings">';
        finalRankings.forEach((player, index) => {
            const medals = ['🥇', '🥈', '🥉'];
            const medal = medals[index] || '🏅';
            const position = index + 1;
            let suffix = 'th';
            if (position % 10 === 1 && position % 100 !== 11) suffix = 'st';
            else if (position % 10 === 2 && position % 100 !== 12) suffix = 'nd';
            else if (position % 10 === 3 && position % 100 !== 13) suffix = 'rd';

            const isWinner = index === 0;
            const num180 = count180s(player.name);
            const badge180 = num180 > 0 ? `<span class="badge-180">180 x${num180}</span>` : '';

            rankingsHtml += `
                <div class="ranking-row ${isWinner ? 'winner-row' : ''}">
                    <span class="rank-medal">${medal}</span>
                    <span class="rank-position">${position}${suffix}</span>
                    <span class="rank-name">${player.name}${badge180}</span>
                    <span class="rank-stats">${player.turns} turns • ${parseFloat(player.avgPerTurn || player.avgPerDart).toFixed(1)} avg</span>
                </div>
            `;
        });
        rankingsHtml += '</div>';

        // Section B: Head-to-Head Comparison (2-player games only)
        if (finalRankings.length === 2 && currentGame) {
            const p1 = currentGame.players[0];
            const p2 = currentGame.players[1];
            const r1 = finalRankings.find(r => r.name === p1.name) || finalRankings[0];
            const r2 = finalRankings.find(r => r.name === p2.name) || finalRankings[1];

            function h2hRow(label, v1, v2, higherIsBetter = true) {
                const n1 = parseFloat(v1), n2 = parseFloat(v2);
                const w1 = higherIsBetter ? n1 > n2 : n1 < n2;
                const w2 = higherIsBetter ? n2 > n1 : n2 < n1;
                return `<div class="h2h-row">
                    <span class="h2h-val ${w1 ? 'winner-val' : ''}">${v1}</span>
                    <span class="h2h-label">${label}</span>
                    <span class="h2h-val ${w2 ? 'winner-val' : ''}">${v2}</span>
                </div>`;
            }

            const p1_100plus = p1.turns.filter(t => !t.busted && t.darts.reduce((a, b) => a + b, 0) >= 100).length;
            const p2_100plus = p2.turns.filter(t => !t.busted && t.darts.reduce((a, b) => a + b, 0) >= 100).length;
            const p1_checkout = p1.stats.checkoutAttempts > 0 ? ((p1.stats.checkoutSuccess / p1.stats.checkoutAttempts) * 100).toFixed(0) + '%' : '—';
            const p2_checkout = p2.stats.checkoutAttempts > 0 ? ((p2.stats.checkoutSuccess / p2.stats.checkoutAttempts) * 100).toFixed(0) + '%' : '—';

            rankingsHtml += `
                <div class="h2h-comparison">
                    <div class="h2h-title">Head to Head</div>
                    <div class="h2h-header">
                        <span class="h2h-player-name">${p1.name}</span>
                        <span class="h2h-vs">vs</span>
                        <span class="h2h-player-name">${p2.name}</span>
                    </div>
                    ${h2hRow('Avg/Turn', parseFloat(r1.avgPerTurn).toFixed(1), parseFloat(r2.avgPerTurn).toFixed(1), true)}
                    ${h2hRow('Best Turn', p1.stats.maxTurn, p2.stats.maxTurn, true)}
                    ${h2hRow('100+ Turns', p1_100plus, p2_100plus, true)}
                    ${h2hRow('Total Darts', p1.stats.totalDarts, p2.stats.totalDarts, false)}
                    ${h2hRow('Checkout %', p1_checkout, p2_checkout, true)}
                </div>
            `;
        }

        // Section D: Game Highlights
        if (currentGame) {
            let bestTurnVal = 0;
            let bestTurnPlayer = '';
            let total180 = 0;

            currentGame.players.forEach(p => {
                if (p.stats.maxTurn > bestTurnVal) {
                    bestTurnVal = p.stats.maxTurn;
                    bestTurnPlayer = p.name;
                }
                total180 += p.turns.filter(t => !t.busted && t.darts.reduce((a, b) => a + b, 0) === 180).length;
            });

            rankingsHtml += '<div class="game-highlights">';
            rankingsHtml += `
                <div class="highlight-card">
                    <span class="highlight-icon">🎯</span>
                    <span class="highlight-label">Best Turn</span>
                    <span class="highlight-value">${bestTurnVal}</span>
                    <span class="highlight-sub">${bestTurnPlayer}</span>
                </div>
            `;
            if (total180 > 0) {
                rankingsHtml += `
                    <div class="highlight-card">
                        <span class="highlight-icon">💯</span>
                        <span class="highlight-label">180s Hit</span>
                        <span class="highlight-value">${total180}</span>
                    </div>
                `;
            }
            rankingsHtml += '</div>';
        }

        // Section C: Personal Bests Detection
        if (currentGame) {
            let pbHtml = '';
            for (const player of currentGame.players) {
                try {
                    const dbPlayer = await Storage.getPlayerByName(player.name);
                    if (!dbPlayer) continue;
                    const allTimeMaxTurn = dbPlayer.max_turn || 0;
                    const allTimeAvg = dbPlayer.avg_per_turn || 0;
                    const gameAvg = player.turns.length > 0 ? player.stats.totalScore / player.turns.length : 0;
                    if (player.stats.maxTurn > allTimeMaxTurn) {
                        pbHtml += `<div class="pb-item"><span class="pb-icon">⭐</span><span class="pb-player">${player.name}</span><span class="pb-stat">Best Turn</span><span class="pb-value">${player.stats.maxTurn}</span></div>`;
                    }
                    if (gameAvg > allTimeAvg && player.turns.length >= 3) {
                        pbHtml += `<div class="pb-item"><span class="pb-icon">⭐</span><span class="pb-player">${player.name}</span><span class="pb-stat">Best Avg/Turn</span><span class="pb-value">${gameAvg.toFixed(1)}</span></div>`;
                    }
                } catch (e) {
                    // Skip if player lookup fails
                }
            }
            if (pbHtml) {
                rankingsHtml += `<div class="personal-bests"><div class="pb-title">New Personal Bests!</div>${pbHtml}</div>`;
            }
        }

        // Section E: Performance Trend Chart
        if (currentGame && currentGame.players.some(p => p.turns.length >= 2)) {
            rankingsHtml += `
                <div class="completion-chart-container">
                    <div class="completion-chart-title">Performance Trend</div>
                    <canvas id="completion-performance-chart"></canvas>
                </div>
            `;
        }

        rankingsDiv.innerHTML = rankingsHtml;

        // Render performance chart after DOM insert
        if (currentGame && currentGame.players.some(p => p.turns.length >= 2)) {
            requestAnimationFrame(() => {
                const canvas = document.getElementById('completion-performance-chart');
                if (!canvas || typeof Chart === 'undefined') return;

                const playerColors = ['#7d5f92', '#38a2ff', '#2de36d', '#facf39', '#ff6b6b', '#ff8a65'];
                const datasets = currentGame.players.map((player, idx) => {
                    let runningTotal = 0;
                    const data = player.turns.map((turn, i) => {
                        const turnScore = turn.busted ? 0 : turn.darts.reduce((a, b) => a + b, 0);
                        runningTotal += turnScore;
                        return parseFloat((runningTotal / (i + 1)).toFixed(1));
                    });
                    return {
                        label: player.name,
                        data: data,
                        borderColor: playerColors[idx % playerColors.length],
                        backgroundColor: 'transparent',
                        tension: 0.3,
                        pointRadius: 2,
                        borderWidth: 2
                    };
                });

                const maxRounds = Math.max(...currentGame.players.map(p => p.turns.length));
                const labels = Array.from({ length: maxRounds }, (_, i) => i + 1);

                new Chart(canvas, {
                    type: 'line',
                    data: { labels, datasets },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } }
                        },
                        scales: {
                            x: { title: { display: true, text: 'Round', font: { size: 10 } }, grid: { display: false } },
                            y: { title: { display: true, text: 'Running Avg', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.05)' } }
                        }
                    }
                });
            });
        }

        // Check if this is a competition match and update actions
        if (actionsDiv && currentGame) {
            let competitionButton = '';
            let competitionType = null;
            let competitionId = null;

            console.log('=== Game Completion - Competition Check ===');
            console.log('currentGame.tournament_id:', currentGame.tournament_id);
            console.log('currentGame.tournament_match_id:', currentGame.tournament_match_id);
            console.log('currentGame.league_id:', currentGame.league_id);

            if (currentGame.tournament_id) {
                competitionType = 'tournament';
                competitionId = currentGame.tournament_id;

                // Handle competition game completion
                const winner = finalRankings[0];
                console.log('Tournament match completed! Winner:', winner?.name);
                if (winner) {
                    await handleCompetitionGameComplete(currentGame, winner);
                    console.log('handleCompetitionGameComplete finished');
                }

                competitionButton = `
                    <button class="btn btn-success btn-large" id="back-to-tournament-btn">
                        <span class="icon">🏆</span>
                        Back to Tournament
                    </button>
                `;
            } else if (currentGame.league_id) {
                competitionType = 'league';
                competitionId = currentGame.league_id;

                // Handle competition game completion
                const winner = finalRankings[0];
                if (winner) {
                    await handleCompetitionGameComplete(currentGame, winner);
                }

                competitionButton = `
                    <button class="btn btn-success btn-large" id="back-to-league-btn">
                        <span class="icon">📊</span>
                        Back to League
                    </button>
                `;
            }

            // Update actions with competition button if applicable
            actionsDiv.innerHTML = `
                ${competitionButton}
                <button class="btn btn-primary btn-large" id="rematch-btn">
                    <span class="icon">🔄</span>
                    Rematch with Same Players
                </button>
                <button class="btn btn-secondary btn-large" id="home-btn">
                    <span class="icon">🏠</span>
                    Go to Home
                </button>
            `;

            // Re-attach event listeners
            document.getElementById('rematch-btn')?.addEventListener('click', startRematch);
            document.getElementById('home-btn')?.addEventListener('click', () => {
                modal.classList.add('hidden');
                Router.navigate('home');
            });
            document.getElementById('back-to-tournament-btn')?.addEventListener('click', () => {
                modal.classList.add('hidden');
                Router.navigate('tournament', { tournamentId: competitionId });
            });
            document.getElementById('back-to-league-btn')?.addEventListener('click', () => {
                modal.classList.add('hidden');
                Router.navigate('league', { leagueId: competitionId });
            });
        }

        // Show the game completion modal directly (don't use UI.showModal which is for generic modal)
        modal.classList.remove('hidden');
    }

    /**
     * Start a rematch with the same players
     */
    async function startRematch() {
        if (!currentGame) return;

        // Extract player names from current game
        const playerNames = currentGame.players.map(p => p.name);
        const gameType = currentGame.game_type;
        const winCondition = currentGame.win_condition;
        const scoringMode = currentGame.scoring_mode;

        // Hide completion modal
        const modal = document.getElementById('game-completion-modal');
        modal.classList.add('hidden');

        // Create new game with same settings
        const newGame = Game.createGame({
            playerCount: playerNames.length,
            playerNames: playerNames,
            gameType: gameType,
            winBelow: winCondition === 'below',
            scoringMode: scoringMode
        });

        // Save to database
        await Storage.saveGame(newGame);

        // Load and display the new game
        currentGame = newGame;
        loadActiveGame(newGame.id);

        UI.showToast('Starting rematch...', 'info');
    }

    /**
     * Share current game
     */
    function shareGame() {
        if (!currentGame) return;

        // Generate spectator link using main app route
        const baseUrl = window.location.origin + window.location.pathname.replace(/\/$/, '');
        const shareUrl = `${baseUrl}#game/${currentGame.id}`;

        // Copy to clipboard
        navigator.clipboard.writeText(shareUrl).then(() => {
            UI.showToast('Share link copied to clipboard! 📋', 'success');

            // Show modal with share link
            UI.showModal(`
                <div style="text-align: center;">
                    <h3 style="margin-bottom: 15px;">Share This Game</h3>
                    <p style="margin-bottom: 15px;">Send this link to friends to watch the game live:</p>
                    <div style="background: #f5f5f5; padding: 12px; border-radius: 6px; margin: 15px 0; word-break: break-all;">
                        <code style="font-size: 12px;">${shareUrl}</code>
                    </div>
                    <button class="btn btn-primary" onclick="navigator.clipboard.writeText('${shareUrl}'); alert('Copied!');" style="margin-top: 10px;">
                        📋 Copy Link
                    </button>
                </div>
            `, 'Share Game');
        }).catch(() => {
            UI.showToast('Failed to copy link', 'error');
        });
    }

    /**
     * View game detail
     */
    async function viewGameDetail(gameId) {
        document.getElementById('history-page').classList.add('hidden');
        document.getElementById('game-detail-page').classList.remove('hidden');
        UI.showPage('game-detail-page');
        await UI.renderGameDetail(gameId);
    }

    /**
     * View player profile
     */
    async function viewPlayerProfile(playerName) {
        document.getElementById('leaderboard-page').classList.add('hidden');
        document.getElementById('player-profile-page').classList.remove('hidden');
        UI.showPage('player-profile-page');
        await UI.renderPlayerProfile(playerName);
    }

    /**
     * Resume active game (if exists and was interrupted)
     * Only resume if:
     * - Game is marked as active
     * - Game has at least one turn (was actually played)
     * - Game has no completion date (wasn't finished)
     */
    async function resumeGame() {
        try {
            const games = await Storage.getGames();
            console.log('Total games in DB:', games.length);

            // Debug: log all games and their status
            games.forEach(g => {
                console.log(`Game ${g.id.substring(0, 8)}: is_active=${g.is_active}, completed_at=${g.completed_at}, players=${g.players.length}, turns=${g.players.reduce((sum, p) => sum + p.turns.length, 0)}`);
            });

            // Find an active game that was interrupted (not completed)
            // Also accept games that are active with at least 1 turn but no completion date
            const activeGame = games.find(g =>
                g.is_active &&
                !g.completed_at &&
                g.players.some(p => p.turns.length > 0)
            );

            if (activeGame) {
                console.log('Found active game to resume:', activeGame.id);
                currentGame = activeGame;
                loadActiveGame();
                UI.showToast('Game resumed', 'info');
                return true;
            }

            console.log('No active game found to resume');
            return false;
        } catch (error) {
            console.error('Resume game error:', error);
            return false;
        }
    }

    // ============================================================================
    // COMPETITION HANDLERS
    // ============================================================================

    /**
     * Setup competition page events
     */
    function setupCompetitionEvents() {
        // Competition tab switching
        document.querySelectorAll('.competition-tab-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                document.querySelectorAll('.competition-tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const tab = e.target.dataset.tab;
                await UI.renderCompetitionsHub(tab);
            });
        });
    }

    /**
     * Load competitions hub
     */
    async function loadCompetitions() {
        UI.showLoader('Loading competitions...');
        try {
            UI.showPage('competitions-page');
            await UI.renderCompetitionsHub('tournaments');
            setupCompetitionEvents(); // Ensure event listeners are attached
        } catch (error) {
            console.error('Error loading competitions:', error);
            UI.showToast('Failed to load competitions', 'error');
        } finally {
            UI.hideLoader();
        }
    }

    /**
     * Load new tournament page
     */
    function loadNewTournament() {
        UI.showPage('new-tournament-page');
        UI.renderNewTournamentForm();

        // Setup form submission
        const form = document.getElementById('new-tournament-form');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                await createTournament();
            };
        }
    }

    /**
     * Create new tournament
     */
    async function createTournament() {
        const name = document.getElementById('tournament-name').value;
        const format = document.getElementById('tournament-format').value;
        const maxPlayers = parseInt(document.getElementById('tournament-size').value);
        const gameType = parseInt(document.querySelector('input[name="tournament-game-type"]:checked')?.value || '501');
        const scoringMode = document.querySelector('input[name="tournament-scoring-mode"]:checked')?.value || 'per-turn';

        const tournament = Tournament.create({
            name,
            format,
            maxPlayers,
            gameType,
            winCondition: 'exact',
            scoringMode
        });

        // Add players from form
        const playerInputs = document.querySelectorAll('#tournament-player-names .player-name-input');
        playerInputs.forEach(input => {
            if (input.value.trim()) {
                Tournament.addParticipant(tournament, input.value.trim());
            }
        });

        try {
            await Storage.saveTournament(tournament);

            // Save initial participants to database
            if (tournament.participants.length > 0) {
                await Storage.saveTournamentParticipants(tournament.id, tournament.participants);
            }

            currentTournament = tournament;
            UI.showToast('Tournament created!', 'success');
            Router.navigate('tournament', { tournamentId: tournament.id });
        } catch (error) {
            console.error('Error creating tournament:', error);
            UI.showToast('Failed to create tournament', 'error');
        }
    }

    /**
     * Load tournament detail
     */
    async function loadTournament(tournamentId) {
        UI.showLoader('Loading tournament...');
        try {
            const tournament = await Storage.getTournament(tournamentId);
            if (!tournament) {
                UI.showToast('Tournament not found', 'error');
                saveTournamentState(null);
                Router.navigate('competitions');
                return;
            }

            currentTournament = tournament;

            // Persist tournament state if in progress
            if (tournament.status === 'in_progress') {
                saveTournamentState(tournamentId);
            } else if (tournament.status === 'completed') {
                saveTournamentState(null);
            }

            UI.showPage('tournament-page');
            await UI.renderTournamentDetail(tournament);
            setupTournamentDetailEvents();
        } catch (error) {
            console.error('Error loading tournament:', error);
            UI.showToast('Failed to load tournament', 'error');
        } finally {
            UI.hideLoader();
        }
    }

    /**
     * Setup tournament detail page events
     */
    function setupTournamentDetailEvents() {
        // Add participant button
        const addBtn = document.getElementById('add-participant-btn');
        if (addBtn) {
            addBtn.onclick = async () => {
                const nameInput = document.getElementById('new-participant-name');
                const name = nameInput?.value.trim();
                if (!name) {
                    UI.showToast('Enter a player name', 'warning');
                    return;
                }

                const result = Tournament.addParticipant(currentTournament, name);
                if (!result.success) {
                    UI.showToast(result.error, 'error');
                    return;
                }

                await Storage.saveTournamentParticipants(currentTournament.id, [result.participant]);
                nameInput.value = '';

                // Reload tournament from database to get updated participants
                currentTournament = await Storage.getTournament(currentTournament.id);

                await UI.renderTournamentDetail(currentTournament);
                setupTournamentDetailEvents();
                UI.showToast(`${name} added!`, 'success');
            };
        }

        // Remove participant buttons
        document.querySelectorAll('.remove-participant-btn').forEach(btn => {
            btn.onclick = async () => {
                const name = btn.dataset.name;
                Tournament.removeParticipant(currentTournament, name);

                // Delete from database
                try {
                    await Storage.deleteTournamentParticipant(currentTournament.id, name);
                } catch (error) {
                    console.error('Error deleting participant from DB:', error);
                }

                await UI.renderTournamentDetail(currentTournament);
                setupTournamentDetailEvents();
                UI.showToast(`${name} removed`, 'info');
            };
        });

        // Shuffle button
        const shuffleBtn = document.getElementById('shuffle-participants-btn');
        if (shuffleBtn) {
            shuffleBtn.onclick = async () => {
                Tournament.shuffleParticipants(currentTournament);
                await UI.renderTournamentDetail(currentTournament);
                setupTournamentDetailEvents();
                UI.showToast('Shuffled!', 'info');
            };
        }

        // Start tournament button
        const startBtn = document.getElementById('start-tournament-btn');
        if (startBtn) {
            startBtn.onclick = async () => {
                const result = Tournament.generateBracket(currentTournament);
                if (!result.success) {
                    UI.showToast(result.error, 'error');
                    return;
                }

                try {
                    // Clear existing participants and re-save with updated bracket positions
                    await Storage.clearTournamentParticipants(currentTournament.id);
                    await Storage.saveTournamentParticipants(currentTournament.id, currentTournament.participants);
                    await Storage.saveTournamentMatches(currentTournament.id, currentTournament.matches);
                    await Storage.updateTournament(currentTournament.id, { status: 'in_progress' });

                    UI.showToast('Tournament started!', 'success');
                    await UI.renderTournamentDetail(currentTournament);
                    setupTournamentDetailEvents();
                } catch (error) {
                    console.error('Error starting tournament:', error);
                    UI.showToast('Failed to start tournament', 'error');
                }
            };
        }

        // Start match buttons
        document.querySelectorAll('.start-match-btn').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const matchCard = btn.closest('.match-card');
                const matchId = matchCard?.dataset.matchId;
                if (!matchId) return;

                await startTournamentMatch(matchId);
            };
        });

        // Repair bracket button
        const repairBtn = document.getElementById('repair-bracket-btn');
        if (repairBtn) {
            repairBtn.onclick = async () => {
                await repairTournamentBracket(currentTournament.id);
            };
        }
    }

    /**
     * Start a tournament match
     */
    async function startTournamentMatch(matchId) {
        const result = Tournament.startMatch(currentTournament, matchId);
        if (!result.success) {
            UI.showToast(result.error, 'error');
            return;
        }

        // Add tournament context to game
        result.game.tournament_id = currentTournament.id;
        result.game.tournament_match_id = matchId;

        try {
            await Storage.saveGame(result.game);
            await Storage.updateTournamentMatch(matchId, {
                status: 'in_progress',
                game_id: result.game.id
            });

            currentGame = result.game;
            Router.navigate('game', { gameId: result.game.id });
        } catch (error) {
            console.error('Error starting match:', error);
            UI.showToast('Failed to start match', 'error');
        }
    }

    /**
     * Load new league page
     */
    function loadNewLeague() {
        UI.showPage('new-league-page');
        UI.renderNewLeagueForm();

        // Setup form submission
        const form = document.getElementById('new-league-form');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                await createLeague();
            };
        }
    }

    /**
     * Create new league
     */
    async function createLeague() {
        const name = document.getElementById('league-name').value;
        const gameType = parseInt(document.getElementById('league-game-type').value);
        const matchesPerPairing = parseInt(document.getElementById('league-matches-per-pairing')?.value || '1');

        const league = League.create({
            name,
            gameType,
            matchesPerPairing,
            winCondition: 'exact',
            scoringMode: 'per-dart'
        });

        // Add players from form
        const playerInputs = document.querySelectorAll('#league-player-names .player-name-input');
        playerInputs.forEach(input => {
            if (input.value.trim()) {
                League.addParticipant(league, input.value.trim());
            }
        });

        try {
            await Storage.saveLeague(league);
            currentLeague = league;
            UI.showToast('League created!', 'success');
            Router.navigate('league', { leagueId: league.id });
        } catch (error) {
            console.error('Error creating league:', error);
            UI.showToast('Failed to create league', 'error');
        }
    }

    /**
     * Load league detail
     */
    async function loadLeague(leagueId) {
        UI.showLoader('Loading league...');
        try {
            const league = await Storage.getLeague(leagueId);
            if (!league) {
                UI.showToast('League not found', 'error');
                saveLeagueState(null);
                Router.navigate('competitions');
                return;
            }

            currentLeague = league;

            // Persist league state if in progress
            if (league.status === 'in_progress') {
                saveLeagueState(leagueId);
            } else if (league.status === 'completed') {
                saveLeagueState(null);
            }

            UI.showPage('league-page');
            await UI.renderLeagueDetail(league);
            setupLeagueDetailEvents();
        } catch (error) {
            console.error('Error loading league:', error);
            UI.showToast('Failed to load league', 'error');
        } finally {
            UI.hideLoader();
        }
    }

    /**
     * Setup league detail page events
     */
    function setupLeagueDetailEvents() {
        // Add participant button
        const addBtn = document.getElementById('add-participant-btn');
        if (addBtn) {
            addBtn.onclick = async () => {
                const nameInput = document.getElementById('new-participant-name');
                const name = nameInput?.value.trim();
                if (!name) {
                    UI.showToast('Enter a player name', 'warning');
                    return;
                }

                const result = League.addParticipant(currentLeague, name);
                if (!result.success) {
                    UI.showToast(result.error, 'error');
                    return;
                }

                await Storage.saveLeagueParticipants(currentLeague.id, [result.participant]);
                nameInput.value = '';

                // Reload league from database to get updated participants
                currentLeague = await Storage.getLeague(currentLeague.id);

                await UI.renderLeagueDetail(currentLeague);
                setupLeagueDetailEvents();
                UI.showToast(`${name} added!`, 'success');
            };
        }

        // Remove participant buttons
        document.querySelectorAll('.remove-participant-btn').forEach(btn => {
            btn.onclick = async () => {
                const name = btn.dataset.name;
                League.removeParticipant(currentLeague, name);
                await UI.renderLeagueDetail(currentLeague);
                setupLeagueDetailEvents();
            };
        });

        // Start league button
        const startBtn = document.getElementById('start-league-btn');
        if (startBtn) {
            startBtn.onclick = async () => {
                const result = League.generateFixtures(currentLeague);
                if (!result.success) {
                    UI.showToast(result.error, 'error');
                    return;
                }

                try {
                    await Storage.saveLeagueParticipants(currentLeague.id, currentLeague.participants);
                    await Storage.saveLeagueMatches(currentLeague.id, currentLeague.matches);
                    await Storage.updateLeague(currentLeague.id, { status: 'in_progress' });

                    UI.showToast('League started!', 'success');
                    await UI.renderLeagueDetail(currentLeague);
                    setupLeagueDetailEvents();
                } catch (error) {
                    console.error('Error starting league:', error);
                    UI.showToast('Failed to start league', 'error');
                }
            };
        }

        // Start match buttons
        document.querySelectorAll('.start-match-btn').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const fixtureCard = btn.closest('.fixture-card');
                const matchId = fixtureCard?.dataset.matchId;
                if (!matchId) return;

                await startLeagueMatch(matchId);
            };
        });
    }

    /**
     * Start a league match
     */
    async function startLeagueMatch(matchId) {
        const result = League.startMatch(currentLeague, matchId);
        if (!result.success) {
            UI.showToast(result.error, 'error');
            return;
        }

        // Add league context to game
        result.game.league_id = currentLeague.id;
        result.game.league_match_id = matchId;

        try {
            await Storage.saveGame(result.game);
            await Storage.updateLeagueMatch(matchId, {
                status: 'in_progress',
                game_id: result.game.id
            });

            currentGame = result.game;
            Router.navigate('game', { gameId: result.game.id });
        } catch (error) {
            console.error('Error starting match:', error);
            UI.showToast('Failed to start match', 'error');
        }
    }

    /**
     * Handle game completion for competitions
     * Called when a competition game ends
     */
    async function handleCompetitionGameComplete(game, winner) {
        if (game.tournament_id && game.tournament_match_id) {
            // Tournament game
            const tournament = await Storage.getTournament(game.tournament_id);
            if (tournament) {
                const winnerParticipant = tournament.participants.find(p => p.name === winner.name);
                const currentMatch = tournament.matches.find(m => m.id === game.tournament_match_id);

                // Record result (this also advances winner to next match in memory)
                Tournament.recordMatchResult(tournament, game.tournament_match_id, winnerParticipant?.id, winner.name);

                // Update current match in database
                await Storage.updateTournamentMatch(game.tournament_match_id, {
                    status: 'completed',
                    winner_name: winner.name
                });

                // Update next match in database (where winner was advanced)
                // Only pass names - updateTournamentMatch will look up player IDs
                if (currentMatch?.winner_next_match_id) {
                    const nextMatch = tournament.matches.find(m => m.id === currentMatch.winner_next_match_id);
                    if (nextMatch) {
                        await Storage.updateTournamentMatch(nextMatch.id, {
                            player1_name: nextMatch.player1_name || undefined,
                            player2_name: nextMatch.player2_name || undefined,
                            status: nextMatch.status
                        });
                        console.log('Advanced winner to next match:', nextMatch.id, 'Players:', nextMatch.player1_name, 'vs', nextMatch.player2_name);
                    }
                }

                // For double elimination, also update loser's next match
                if (tournament.format === 'double_elimination' && currentMatch?.loser_next_match_id) {
                    const loserMatch = tournament.matches.find(m => m.id === currentMatch.loser_next_match_id);
                    if (loserMatch) {
                        await Storage.updateTournamentMatch(loserMatch.id, {
                            player1_name: loserMatch.player1_name || undefined,
                            player2_name: loserMatch.player2_name || undefined,
                            status: loserMatch.status
                        });
                        console.log('Advanced loser to losers bracket:', loserMatch.id);
                    }
                }

                if (tournament.status === 'completed') {
                    await Storage.updateTournament(tournament.id, {
                        status: 'completed',
                        winner_name: tournament.winner_name
                    });
                }

                currentTournament = tournament;
            }
        } else if (game.league_id && game.league_match_id) {
            // League game
            const league = await Storage.getLeague(game.league_id);
            if (league) {
                const winnerParticipant = league.participants.find(p => p.name === winner.name);
                League.recordMatchResult(league, game.league_match_id, winnerParticipant?.id, winner.name);

                // Update database
                await Storage.updateLeagueMatch(game.league_match_id, {
                    status: 'completed',
                    winner_name: winner.name
                });

                // Update participant standings
                for (const p of league.participants) {
                    const dbParticipant = league.participants.find(lp => lp.name === p.name);
                    if (dbParticipant) {
                        await Storage.updateLeagueParticipant(dbParticipant.id, p);
                    }
                }

                if (league.status === 'completed') {
                    await Storage.updateLeague(league.id, {
                        status: 'completed',
                        winner_name: league.winner_name
                    });
                }

                currentLeague = league;
            }
        }
    }

    /**
     * Repair tournament bracket - advance all winners from completed matches
     * Use this to fix tournaments where matches completed before the advancement fix
     */
    async function repairTournamentBracket(tournamentId) {
        UI.showLoader('Repairing tournament bracket...');
        try {
            let tournament = await Storage.getTournament(tournamentId);
            if (!tournament) {
                UI.showToast('Tournament not found', 'error');
                return false;
            }

            console.log('Repairing tournament:', tournament.name);
            console.log('Matches:', tournament.matches);

            let repaired = 0;
            let synced = 0;

            // STEP 1: Sync match statuses from completed games
            // This fixes matches where the game was completed but the match wasn't updated
            console.log('Checking matches for game sync...');
            for (const match of tournament.matches) {
                console.log(`Match ${match.match_number} (round ${match.round}): status=${match.status}, game_id=${match.game_id}`);
                if (match.game_id && match.status !== 'completed') {
                    // Fetch the game to check if it's completed
                    const game = await Storage.getGame(match.game_id);
                    console.log(`  Game ${match.game_id}: is_active=${game?.is_active}, players=`, game?.players?.map(p => ({name: p.name, winner: p.winner, finish_rank: p.finish_rank})));
                    if (game && !game.is_active) {
                        // Game is completed, find the winner (note: is_winner is mapped to 'winner' in transformed game)
                        const winner = game.players.find(p => p.winner || p.finish_rank === 1);
                        if (winner) {
                            console.log(`  Syncing completed game for match ${match.match_number}: winner is ${winner.name}`);

                            // Update match with winner info
                            await Storage.updateTournamentMatch(match.id, {
                                status: 'completed',
                                winner_name: winner.name
                            });

                            match.status = 'completed';
                            match.winner_name = winner.name;
                            match.winner_id = winner.id;
                            synced++;
                        }
                    }
                }
            }

            // Re-fetch tournament if we synced any matches to get updated data
            if (synced > 0) {
                console.log(`Synced ${synced} match(es) from completed games`);
                tournament = await Storage.getTournament(tournamentId);
            }

            // STEP 2: Process all completed matches and advance winners
            for (const match of tournament.matches) {
                if (match.status === 'completed' && match.winner_name && match.winner_next_match_id) {
                    const nextMatch = tournament.matches.find(m => m.id === match.winner_next_match_id);
                    if (nextMatch) {
                        // Check if winner is already in next match
                        const alreadyAdvanced = nextMatch.player1_name === match.winner_name ||
                                                 nextMatch.player2_name === match.winner_name;

                        if (!alreadyAdvanced) {
                            console.log(`Advancing ${match.winner_name} from match ${match.match_number} (round ${match.round}) to next match`);

                            // Place winner in next match
                            if (!nextMatch.player1_name) {
                                nextMatch.player1_id = match.winner_id;
                                nextMatch.player1_name = match.winner_name;
                            } else if (!nextMatch.player2_name) {
                                nextMatch.player2_id = match.winner_id;
                                nextMatch.player2_name = match.winner_name;
                            }

                            // Update match status
                            if (nextMatch.player1_name && nextMatch.player2_name) {
                                nextMatch.status = 'ready';
                            }

                            // Save to database - only pass names, not IDs
                            await Storage.updateTournamentMatch(nextMatch.id, {
                                player1_name: nextMatch.player1_name || undefined,
                                player2_name: nextMatch.player2_name || undefined,
                                status: nextMatch.status
                            });

                            repaired++;
                        }
                    }
                }
            }

            UI.hideLoader();

            const totalFixed = synced + repaired;
            if (totalFixed > 0) {
                let message = '';
                if (synced > 0 && repaired > 0) {
                    message = `Synced ${synced} game(s), advanced ${repaired} winner(s)!`;
                } else if (synced > 0) {
                    message = `Synced ${synced} completed game(s)!`;
                } else {
                    message = `Advanced ${repaired} winner(s) to next round!`;
                }
                UI.showToast(message, 'success');
                // Reload tournament to show updated state
                await loadTournament(tournamentId);
            } else {
                UI.showToast('No repairs needed - bracket is up to date', 'info');
            }

            return true;
        } catch (error) {
            console.error('Error repairing tournament:', error);
            UI.showToast('Failed to repair tournament', 'error');
            UI.hideLoader();
            return false;
        }
    }

    // ============================================================================
    // PRACTICE MODE
    // ============================================================================

    async function loadPractice() {
        UI.showPage('practice-page');
        UI.showLoader('Loading players...');

        try {
            const playersMap = await Storage.getPlayers();
            const playerNames = Object.keys(playersMap).sort();
            const container = document.getElementById('practice-player-selection');
            const countEl = document.getElementById('practice-selected-count');
            const startBtn = document.getElementById('start-free-practice-btn');

            if (container) {
                if (playerNames.length === 0) {
                    container.innerHTML = '<p class="placeholder-small">No players found. <a href="#/players">Add players</a></p>';
                    if (startBtn) startBtn.disabled = true;
                } else {
                    const selectedPlayers = new Set();
                    container.innerHTML = playerNames.map(name => `
                        <div class="player-select-card compact" data-name="${name}">
                            <div class="player-select-avatar">👤</div>
                            <div class="player-select-name">${name}</div>
                        </div>
                    `).join('');

                    container.querySelectorAll('.player-select-card').forEach(card => {
                        card.onclick = () => {
                            const name = card.dataset.name;
                            if (selectedPlayers.has(name)) {
                                selectedPlayers.delete(name);
                                card.classList.remove('selected');
                            } else {
                                selectedPlayers.add(name);
                                card.classList.add('selected');
                            }

                            const count = selectedPlayers.size;
                            if (countEl) countEl.textContent = count;
                            if (startBtn) {
                                startBtn.disabled = count === 0;
                                // Store selected players on the button
                                startBtn.dataset.players = Array.from(selectedPlayers).join(',');
                            }
                        };
                    });
                }
            }
            initIcons();
        } catch (error) {
            console.error('Error loading players for practice:', error);
            UI.showToast('Failed to load players', 'error');
        } finally {
            UI.hideLoader();
        }
    }

    function setupPracticeEvents() {
        // Free practice start
        const startFreeBtn = document.getElementById('start-free-practice-btn');
        if (startFreeBtn) {
            startFreeBtn.onclick = async () => {
                const playerNames = startFreeBtn.dataset.players?.split(',').filter(p => p) || [];
                const target = parseInt(document.getElementById('practice-target')?.value || '501');
                const scoringMode = document.getElementById('practice-scoring-mode')?.value || 'per-dart';

                if (playerNames.length === 0) {
                    UI.showToast('Select at least one player', 'warning');
                    return;
                }

                await startPracticeGame(playerNames, target, scoringMode, true);
            };
        }

        // Drill buttons
        document.querySelectorAll('.start-drill-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const drill = btn.dataset.drill;
                const playersMap = await Storage.getPlayers();
                const playerNames = Object.keys(playersMap).sort();

                if (playerNames.length === 0) {
                    UI.showToast('Add a player first!', 'warning');
                    Router.navigate('players');
                    return;
                }

                // For drills, we use the quick player selection modal to pick ONE player
                const content = document.createElement('div');
                content.className = 'quick-player-modal';
                content.innerHTML = `
                    <p class="text-muted mb-lg">Select a player for this drill.</p>
                    <div class="player-selection-grid" id="drill-player-grid">
                        ${playerNames.map(name => `
                            <div class="player-select-card compact" data-name="${name}">
                                <div class="player-select-avatar">👤</div>
                                <div class="player-select-name">${name}</div>
                            </div>
                        `).join('')}
                    </div>
                `;

                UI.showModal(content, `Start Drill`);

                const grid = document.getElementById('drill-player-grid');
                grid.querySelectorAll('.player-select-card').forEach(card => {
                    card.onclick = async () => {
                        const playerName = card.dataset.name;
                        UI.hideModal();
                        
                        switch (drill) {
                            case 'ton80':
                                await startPracticeGame([playerName], 501, 'per-turn', true);
                                break;
                            case 'doubles':
                                await startPracticeGame([playerName], 301, 'per-dart', false);
                                break;
                            case 'highscore':
                                await startPracticeGame([playerName], 501, 'per-turn', true);
                                break;
                        }
                    };
                });
            });
        });
    }

    async function startPracticeGame(playerNames, gameType, scoringMode, winBelow) {
        UI.showLoader('Starting practice...');
        currentGame = Game.createGame({
            playerCount: playerNames.length,
            playerNames: playerNames,
            gameType: gameType,
            winBelow: winBelow,
            scoringMode: scoringMode,
            is_practice: true
        });

        try {
            await Storage.saveGame(currentGame);
            Router.navigate('game', { gameId: currentGame.id });
        } catch (error) {
            console.error('Failed to start practice game:', error);
            UI.showToast('Failed to start practice game', 'error');
        } finally {
            UI.hideLoader();
        }
    }

    function setupDeleteEvents() {
        // Event handlers are inline onclick calling App.confirmDelete* methods
    }

    function confirmDeleteGame(gameId) {
        const content = document.createElement('div');
        content.innerHTML = `
            <p>Delete this game?</p>
            <p style="color: var(--color-text-light); font-size: 0.85rem;">This cannot be undone.</p>
            <div style="display: flex; gap: 8px; margin-top: 16px;">
                <button class="btn btn-danger" id="confirm-delete-btn">Delete</button>
                <button class="btn btn-secondary" id="cancel-delete-btn">Cancel</button>
            </div>
        `;
        UI.showModal(content, 'Delete Game');
        document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
            await Storage.deleteGame(gameId);
            UI.hideModal();
            UI.showToast('Game deleted', 'success');
            handleRoute(Router.parseUrl());
        });
        document.getElementById('cancel-delete-btn').addEventListener('click', () => UI.hideModal());
    }

    function confirmDeleteTournament(id, name) {
        const content = document.createElement('div');
        content.innerHTML = `
            <p>Delete tournament <strong>${name}</strong>?</p>
            <p style="color: var(--color-text-light); font-size: 0.85rem;">This cannot be undone.</p>
            <div style="display: flex; gap: 8px; margin-top: 16px;">
                <button class="btn btn-danger" id="confirm-delete-btn">Delete</button>
                <button class="btn btn-secondary" id="cancel-delete-btn">Cancel</button>
            </div>
        `;
        UI.showModal(content, 'Delete Tournament');
        document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
            await Storage.deleteTournament(id);
            UI.hideModal();
            UI.showToast('Tournament deleted', 'success');
            handleRoute(Router.parseUrl());
        });
        document.getElementById('cancel-delete-btn').addEventListener('click', () => UI.hideModal());
    }

    /**
     * Manually finalize a tournament if all matches are done
     */
    async function finalizeTournament(tournamentId) {
        const tournament = await Storage.getTournament(tournamentId);
        if (!tournament) return;

        UI.showLoader('Finalizing tournament...');
        try {
            // Check completion logic
            Tournament.checkTournamentComplete(tournament);

            if (tournament.status === 'completed') {
                // Update in storage
                await Storage.updateTournament(tournament.id, {
                    status: 'completed',
                    winner_name: tournament.winner_name
                });

                UI.showToast(`Tournament completed! Winner: ${tournament.winner_name}`, 'success');
                await loadTournament(tournament.id);
            } else {
                UI.showToast('Tournament could not be completed automatically. Ensure all matches have winners.', 'warning');
            }
        } catch (error) {
            console.error('Error finalizing tournament:', error);
            UI.showToast('Failed to finalize tournament', 'error');
        } finally {
            UI.hideLoader();
        }
    }

    function confirmDeleteLeague(id, name) {
        const content = document.createElement('div');
        content.innerHTML = `
            <p>Delete league <strong>${name}</strong>?</p>
            <p style="color: var(--color-text-light); font-size: 0.85rem;">This cannot be undone.</p>
            <div style="display: flex; gap: 8px; margin-top: 16px;">
                <button class="btn btn-danger" id="confirm-delete-btn">Delete</button>
                <button class="btn btn-secondary" id="cancel-delete-btn">Cancel</button>
            </div>
        `;
        UI.showModal(content, 'Delete League');
        document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
            await Storage.deleteLeague(id);
            UI.hideModal();
            UI.showToast('League deleted', 'success');
            handleRoute(Router.parseUrl());
        });
        document.getElementById('cancel-delete-btn').addEventListener('click', () => UI.hideModal());
    }

    // Public API
    return {
        init,
        handleRoute,
        getIsSpectatorMode,
        loadHome,
        loadNewGame,
        loadActiveGame,
        loadSpectatorGame,
        loadHistory,
        loadLeaderboard,
        loadGameFromUrl,
        viewGameDetail,
        viewPlayerProfile,
        resumeGame,
        submitTurn,
        undoTurn,
        endGame,
        shareGame,
        loadPlayers,
        loadPractice,
        // Competition functions
        loadCompetitions,
        loadTournament,
        loadLeague,
        loadNewTournament,
        loadNewLeague,
        handleCompetitionGameComplete,
        repairTournamentBracket,
        // State persistence
        getActiveCompetition,
        saveTournamentState,
        saveLeagueState,
        // Delete actions (called from inline onclick)
        confirmDeleteGame,
        confirmDeleteTournament,
        confirmDeleteLeague,
        finalizeTournament
    };
})();

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 APP.JS VERSION 2.0 - NORMALIZED SCHEMA');

    // Ensure Storage is initialized before anything else
    try {
        console.log('Starting Storage initialization...');
        await Storage.init();

        // Wait for Storage.sb to be available (with timeout)
        let attempts = 0;
        while (!Storage.sb && attempts < 10) {
            console.log('Waiting for Storage.sb to be ready...', attempts);
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (!Storage.sb) {
            throw new Error('Storage.sb not available after initialization');
        }

        // Show info toast if running in local mode
        if (Storage.isLocal()) {
            console.log('Running in local/offline mode');
            UI.showToast('Running in offline mode (localStorage)', 'info');
        }

        console.log('Storage ready, initializing app...');
    } catch (error) {
        console.error('Failed to initialize Storage:', error);
        if (typeof UI !== 'undefined') {
            UI.showToast('Failed to connect to database. Please refresh the page.', 'error');
        }
        return;
    }

    // Ensure UI is defined before initializing app
    if (typeof UI === 'undefined') {
        console.error('UI module not loaded! App initialization failed.');
        return;
    }

    // Initialize app event listeners
    App.init();

    // Initialize router with route change handler
    Router.init(App.handleRoute);

    // Hide splash screen after animation completes
    const splashScreen = document.getElementById('splash-screen');
    if (splashScreen) {
        setTimeout(() => {
            splashScreen.classList.add('hidden');
            // Remove from DOM after transition
            setTimeout(() => {
                splashScreen.remove();
            }, 500);
        }, 2500); // Show splash for 2.5 seconds
    }

    // Periodic auto-save for current game
    setInterval(async () => {
        if (window.currentGame) {
            try {
                await Storage.updateGame(window.currentGame.id, window.currentGame);
            } catch (error) {
                console.error('Auto-save failed:', error);
            }
        }
    }, 30000);
});

// Handle beforeunload
window.addEventListener('beforeunload', async (e) => {
    // Check if there's an active game that needs saving
    if (window.currentGame && window.currentGame.is_active) {
        e.preventDefault();
        e.returnValue = '';
    }
});
// v2.1 update
