/**
 * UI Module
 * Handles DOM manipulation and rendering
 */

const UI = (() => {
    // Cache previous scores for countdown animation
    const previousPlayerScores = new Map();

    /**
     * Animate score countdown from oldVal to newVal on an element
     */
    function animateScoreCountdown(element, from, to, duration = 600) {
        if (from === to) return;
        element.classList.add('counting');
        const start = performance.now();
        const diff = to - from;

        function step(timestamp) {
            const elapsed = timestamp - start;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out-cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(from + diff * eased);
            element.textContent = current;
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                element.textContent = to;
                element.classList.remove('counting');
            }
        }
        requestAnimationFrame(step);
    }

    /**
     * Get human-readable time ago string
     */
    function getTimeAgo(dateStr) {
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now - date;
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        const weeks = Math.floor(days / 7);
        if (weeks < 5) return `${weeks}w ago`;
        const months = Math.floor(days / 30);
        return `${months}mo ago`;
    }

    const avatarColors = [
        '#e57373', '#f06292', '#ba68c8', '#9575cd', '#7986cb', '#64b5f6',
        '#4fc3f7', '#4dd0e1', '#4db6ac', '#81c784', '#aed581', '#ff8a65',
        '#d4e157', '#ffd54f', '#ffb74d', '#a1887f', '#90a4ae'
    ];

    function getColorForName(name) {
        if (!name) return avatarColors[0];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
            hash = hash & hash;
        }
        const index = Math.abs(hash) % avatarColors.length;
        return avatarColors[index];
    }


    /**
     * Show toast notification with icons and progress bar
     */
    function showToast(message, type = 'info', duration = 3500) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            'success': 'check-circle',
            'error': 'alert-circle',
            'warning': 'alert-triangle',
            'info': 'info'
        };
        const iconName = icons[type] || 'info';

        toast.innerHTML = `
            <div class="toast-content">
                <i data-lucide="${iconName}" class="toast-icon"></i>
                <div class="toast-message">${message}</div>
            </div>
            <div class="toast-progress"></div>
        `;
        
        container.appendChild(toast);
        
        // Initialize Lucide icon
        if (window.lucide) {
            window.lucide.createIcons({
                attrs: {
                    class: ['toast-icon']
                },
                nameAttr: 'data-lucide'
            });
        }

        // Set progress bar animation
        const progressBar = toast.querySelector('.toast-progress');
        progressBar.style.transition = `width ${duration}ms linear`;
        
        // Trigger reflow then start animation
        setTimeout(() => {
            progressBar.style.width = '0%';
        }, 10);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 300ms ease-in-out forwards';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    /**
     * Show loader overlay
     */
    function showLoader(text = 'Loading...') {
        const loader = document.getElementById('loader');
        const loaderText = loader.querySelector('.loader-text');
        loaderText.textContent = text;
        loader.classList.remove('hidden');
    }

    /**
     * Hide loader overlay
     */
    function hideLoader() {
        const loader = document.getElementById('loader');
        loader.classList.add('hidden');
    }

    /**
     * Show modal dialog
     */
    function showModal(content, title = '') {
        const modal = document.getElementById('modal');
        const body = document.getElementById('modal-body');
        body.innerHTML = '';

        if (title) {
            const titleEl = document.createElement('h2');
            titleEl.textContent = title;
            body.appendChild(titleEl);
        }

        if (typeof content === 'string') {
            body.innerHTML += content;
        } else {
            body.appendChild(content);
        }

        modal.classList.remove('hidden');
    }

    /**
     * Hide modal
     */
    function hideModal() {
        document.getElementById('modal').classList.add('hidden');
    }

    /**
     * Show page
     */
    function showPage(pageId) {
        const page = pageId.replace('-page', '');
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');

        // Update Desktop Nav
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.page === page);
        });

        // Update Mobile Bottom Nav
        document.querySelectorAll('.mobile-nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.page === page);
        });

        // Re-render Lucide icons for the new page content if needed
        if (window.lucide) {
            window.lucide.createIcons();
        }

        // Scroll to top
        window.scrollTo(0, 0);
    }

    /**
     * Helper: Setup player autocomplete for an input field
     * @param {HTMLInputElement} input - The input element
     * @param {Array<string>} existingPlayers - List of existing player names
     * @param {HTMLElement} container - Container to check for duplicates
     * @param {Function} onSelect - Optional callback when player is selected
     */
    function setupPlayerAutocomplete(input, existingPlayers, container, onSelect = null) {
        const wrapper = input.parentElement;
        if (!wrapper) return;

        // Create suggestions list if it doesn't exist
        let suggestionsList = wrapper.querySelector('.player-suggestions');
        if (!suggestionsList) {
            suggestionsList = document.createElement('div');
            suggestionsList.className = 'player-suggestions';
            suggestionsList.style.display = 'none';
            wrapper.appendChild(suggestionsList);
        }

        // Handle input for suggestions
        input.addEventListener('input', (e) => {
            const value = e.target.value.toLowerCase().trim();

            if (value.length === 0) {
                suggestionsList.style.display = 'none';
                return;
            }

            // Get all currently selected player names (excluding this input)
            const selectedNames = Array.from(container.querySelectorAll('.player-name-input'))
                .filter(inp => inp !== input)
                .map(inp => inp.value.toLowerCase().trim())
                .filter(name => name !== '');

            // Filter existing players matching the input, excluding already selected ones
            const matches = existingPlayers.filter(player =>
                player.toLowerCase().includes(value) &&
                !selectedNames.includes(player.toLowerCase())
            );

            if (matches.length === 0) {
                suggestionsList.style.display = 'none';
                return;
            }

            // Show suggestions
            suggestionsList.innerHTML = matches.map(player => `
                <div class="suggestion-item" data-player="${player}">
                    ${player}
                </div>
            `).join('');
            suggestionsList.style.display = 'block';

            // Handle suggestion clicks
            suggestionsList.querySelectorAll('.suggestion-item').forEach(item => {
                item.addEventListener('click', () => {
                    input.value = item.getAttribute('data-player');
                    suggestionsList.style.display = 'none';
                    if (onSelect) onSelect();
                });
            });
        });

        // Hide suggestions when clicking outside
        input.addEventListener('blur', () => {
            setTimeout(() => {
                suggestionsList.style.display = 'none';
            }, 200);
        });

        // Show suggestions on focus if there's value
        input.addEventListener('focus', () => {
            if (input.value.length > 0) {
                const event = new Event('input', { bubbles: true });
                input.dispatchEvent(event);
            }
        });
    }

    /**
     * Render recent games on home page
     */
    async function renderStatsWidget() {
        try {
            const stats = await Stats.getQuickStats();

            const statGames = document.getElementById('stat-games');
            const statPlayers = document.getElementById('stat-players');
            const statHighTurn = document.getElementById('stat-high-turn');

            if (statGames) statGames.textContent = stats.totalGames || '0';
            if (statPlayers) statPlayers.textContent = stats.totalPlayers || '0';
            if (statHighTurn) statHighTurn.textContent = stats.highTurn || '0';
        } catch (error) {
            console.error('Error rendering stats widget:', error);
        }
    }

    async function renderRecentGames() {
        try {
            const container = document.getElementById('recent-games-list');
            if (!container) {
                console.error('recent-games-list container not found');
                return;
            }

            // Also render stats widget
            await renderStatsWidget();

            // Check for active competition first
            let activeCompetition = null;
            try {
                activeCompetition = await App.getActiveCompetition();
            } catch (e) {
                console.warn('Error checking active competition:', e);
            }

            // OPTIMIZED: Use pagination to load only what we need
            // Get interrupted games (active, not completed)
            const { games: interruptedGames } = await Storage.getGamesPaginated(1, 10, {
                completed: false,
                active: true, // MUST be active
                includePractice: false // Don't show practice in interrupted by default
            });

            // Get 5 most recent completed games
            const { games: completedGames } = await Storage.getGamesPaginated(1, 5, {
                completed: true,
                includePractice: false // Don't show practice in recent by default
            });


            let html = '';

            // Show active tournament/league section
            if (activeCompetition) {
                const { type, data } = activeCompetition;
                const readyMatches = type === 'tournament'
                    ? Tournament.getReadyMatches(data).length
                    : (data.matches?.filter(m => m.status === 'pending').length || 0);
                const inProgressMatches = type === 'tournament'
                    ? Tournament.getInProgressMatches(data).length
                    : (data.matches?.filter(m => m.status === 'in_progress').length || 0);

                const statusText = inProgressMatches > 0
                    ? `${inProgressMatches} match${inProgressMatches > 1 ? 'es' : ''} in progress`
                    : `${readyMatches} match${readyMatches > 1 ? 'es' : ''} ready to play`;

                html += `
                    <div class="active-tournament-section">
                        <div class="active-tournament-header">
                            <span class="active-tournament-icon">${type === 'tournament' ? '🏆' : '📊'}</span>
                            <span class="active-tournament-title">${data.name}</span>
                        </div>
                        <div class="active-tournament-status">${statusText}</div>
                        <button class="btn btn-primary" onclick="Router.navigate('${type}', { ${type}Id: '${data.id}' })">
                            Continue ${type === 'tournament' ? 'Tournament' : 'League'}
                        </button>
                    </div>
                `;
            }

            if (interruptedGames.length === 0 && completedGames.length === 0 && !activeCompetition) {
                container.innerHTML = '<p class="placeholder">No games yet. Start your first game!</p>';
                return;
            }

            // Show interrupted games first with Resume button
            if (interruptedGames.length > 0) {
                html += '<div class="interrupted-games-section">';
                html += '<div class="section-title">⏸️ Interrupted Games</div>';

                interruptedGames.forEach(game => {
                    const currentPlayerIndex = game.current_player_index || 0;
                    const currentPlayer = game.players[currentPlayerIndex];
                    const date = new Date(game.created_at);
                    const dateStr = date.toLocaleDateString();
                    const totalTurns = game.players.reduce((sum, p) => sum + (p.totalTurns || p.turns?.length || 0), 0);
                    const isOwner = Device.isGameOwner(game.device_id);

                    html += `
                        <div class="game-card interrupted-card">
                            <div class="game-card-header">
                                <div class="game-card-title">${game.game_type} Points</div>
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    <div class="game-card-date">${dateStr}</div>
                                    ${game.is_practice ? '<span class="practice-badge">Practice</span>' : ''}
                                    <span class="game-status-badge" style="background: ${isOwner ? '#ff9800' : '#4caf50'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${isOwner ? 'IN PROGRESS' : 'LIVE'}</span>
                                </div>
                            </div>
                            <div class="game-card-players">
                                ${game.players.map(p => {
                                    const playerTurns = p.turns.length;
                                    return `
                                        <div class="player-badge ${p.name === currentPlayer?.name ? 'current' : ''}" style="display: flex; justify-content: space-between; align-items: center;">
                                            <span>${p.name}</span>
                                            <span style="font-weight: 700; color: ${p.currentScore <= 50 ? '#4caf50' : 'inherit'};">${p.currentScore}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                            <div class="game-card-footer">
                                <span>Turn ${totalTurns} • Now: ${currentPlayer?.name || 'N/A'}</span>
                                <span class="game-type-badge">${game.players.length} players</span>
                            </div>
                            <div style="display: flex; gap: 8px; margin-top: 8px;">
                                <button class="btn ${isOwner ? 'btn-primary' : 'btn-success'} btn-small" onclick="Router.navigate('game', {gameId: '${game.id}'})" style="flex: 1;">
                                    ${isOwner ? '▶️ Resume Game' : '📺 Watch Live'}
                                </button>
                                <button class="btn btn-danger btn-small delete-game-btn" data-game-id="${game.id}" onclick="event.stopPropagation(); App.confirmDeleteGame(this.dataset.gameId)"><svg class="icon-bin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M5 6v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
                            </div>
                        </div>
                    `;
                });

                html += '</div>';
            }

            // Show completed games
            if (completedGames.length > 0) {
                const needsWrapper = interruptedGames.length > 0;
                if (needsWrapper) {
                    html += '<div class="recent-games-section" style="margin-top: 16px;">';
                }

                html += '<div class="section-title">📜 Recent Games</div>';

                html += completedGames.map(game => {
                    const winner = game.players.find(p => p.winner);
                    const date = new Date(game.created_at);
                    const dateStr = date.toLocaleDateString();
                    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const hasTurns = game.players.some(p => (p.totalTurns || 0) > 0);

                    return `
                        <div class="game-card" onclick="Router.navigate('game-detail', {gameId: '${game.id}'})">
                            <div class="game-card-header">
                                <div class="game-card-title">${game.game_type} Points</div>
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    <div class="game-card-date">${dateStr} ${timeStr}</div>
                                    ${game.is_practice ? '<span class="practice-badge">Practice</span>' : ''}
                                    <span class="game-status-badge" style="background: #4caf50; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">COMPLETED</span>
                                    ${!hasTurns ? `<button class="btn btn-danger btn-small delete-game-btn" data-game-id="${game.id}" onclick="event.stopPropagation(); App.confirmDeleteGame(this.dataset.gameId)"><svg class="icon-bin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M5 6v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>` : ''}
                                </div>
                            </div>
                            <div class="game-card-players">
                                ${game.players.map(p => `
                                    <div class="player-badge ${p.winner ? 'winner' : ''}">
                                        ${p.name}
                                    </div>
                                `).join('')}
                            </div>
                            <div class="game-card-footer">
                                <span>🏆 ${winner?.name || 'N/A'}</span>
                                <span class="game-type-badge">${game.players.length} players</span>
                            </div>
                        </div>
                    `;
                }).join('');

                if (needsWrapper) {
                    html += '</div>';
                }
            }

            container.innerHTML = html;
            console.log('Recent games rendered successfully');
        } catch (error) {
            console.error('Error rendering recent games:', error);
            const container = document.getElementById('recent-games-list');
            if (container) {
                container.innerHTML = '<p class="placeholder">Error loading games. Please refresh the page.</p>';
            }
        }
    }

    /**
     * Render quick stats on home page
     * OPTIMIZED: Uses Stats.getQuickStats() which queries database directly
     */
    async function renderQuickStats() {
        const stats = await Stats.getQuickStats();

        // All-time stats
        const statGames = document.getElementById('stat-games');
        const statPlayers = document.getElementById('stat-players');
        const statHighTurn = document.getElementById('stat-high-turn');

        if (statGames) statGames.textContent = stats.totalGames || '0';
        if (statPlayers) statPlayers.textContent = stats.totalPlayers || '0';
        if (statHighTurn) statHighTurn.textContent = stats.highTurn || '0';

        // Today's stats
        try {
            const todayStats = await Stats.getTodayStats();
            const todayGames = document.getElementById('today-games');
            const todayBest = document.getElementById('today-best');
            const todayHigh = document.getElementById('today-high');

            if (todayGames) todayGames.textContent = todayStats.gamesPlayed || '0';
            if (todayBest) todayBest.textContent = todayStats.bestAvg || '—';
            if (todayHigh) todayHigh.textContent = todayStats.highTurn || '—';
        } catch (e) {
            console.warn('Could not load today stats:', e);
        }

        // Mini leaderboard - Best avg per turn (minimum 7 games)
        try {
            const leaderboard = await Stats.getLeaderboard('avg-turn', 'all-time');
            // Filter to players with at least 7 games
            const qualifiedPlayers = leaderboard.filter(p => p.stats.gamesPlayed >= 7);
            for (let i = 0; i < 3; i++) {
                const nameEl = document.getElementById(`leader-${i + 1}`);
                const winsEl = document.getElementById(`leader-${i + 1}-wins`);
                if (nameEl && qualifiedPlayers[i]) {
                    nameEl.textContent = qualifiedPlayers[i].name;
                    if (winsEl) winsEl.textContent = qualifiedPlayers[i].stats.avgPerTurn;
                } else if (nameEl) {
                    nameEl.textContent = '—';
                    if (winsEl) winsEl.textContent = '';
                }
            }
        } catch (e) {
            console.warn('Could not load leaderboard:', e);
        }

        // Check for active game (continue banner)
        try {
            const activeGames = await Storage.getActiveGames();
            const myActiveGame = activeGames.find(g => g.device_id === Device.getDeviceId());
            const banner = document.getElementById('continue-game-banner');
            const detail = document.getElementById('continue-game-detail');
            const continueBtn = document.getElementById('continue-game-btn');

            if (banner && myActiveGame) {
                banner.classList.remove('hidden');
                if (detail) {
                    const playerCount = myActiveGame.players?.length || 0;
                    const currentTurn = myActiveGame.current_turn || 1;
                    const currentPlayerIdx = myActiveGame.current_player_index || 0;
                    const currentPlayerName = myActiveGame.players?.[currentPlayerIdx]?.name || '';
                    detail.textContent = `${myActiveGame.game_type} • ${playerCount} players • Turn ${currentTurn}${currentPlayerName ? ` • ${currentPlayerName}'s turn` : ''}`;
                }
                if (continueBtn) {
                    continueBtn.onclick = () => Router.navigate('game', { gameId: myActiveGame.id });
                }
            } else if (banner) {
                banner.classList.add('hidden');
            }
        } catch (e) {
            console.warn('Could not check active games:', e);
        }

        // Live games (spectatable)
        try {
            const activeGames = await Storage.getActiveGames();
            const otherGames = activeGames.filter(g => g.device_id !== Device.getDeviceId());
            const liveList = document.getElementById('live-games-list');

            if (liveList) {
                if (otherGames.length > 0) {
                    liveList.innerHTML = otherGames.slice(0, 3).map(g => `
                        <div class="live-game-item" onclick="Router.navigate('game', { gameId: '${g.id}' })">
                            <span class="live-game-info">${g.game_type}</span>
                            <span class="live-game-players">${g.players?.map(p => p.name).join(' vs ') || 'Game'}</span>
                        </div>
                    `).join('');
                } else {
                    liveList.innerHTML = '<p class="placeholder-small">No live games</p>';
                }
            }
        } catch (e) {
            console.warn('Could not load live games:', e);
        }
    }

    /**
     * Render new game form
     */
    async function renderNewGameForm() {
        const form = document.getElementById('new-game-form');
        const playerCountInput = document.getElementById('player-count');
        const gameTypeSelect = document.getElementById('game-type');
        const customPointsInput = document.getElementById('custom-points');
        const playerNamesContainer = document.getElementById('player-names-container');

        // Get all existing players for autocomplete
        let existingPlayers = [];
        try {
            const players = await Storage.getPlayers();
            existingPlayers = Object.keys(players) || [];
        } catch (error) {
            console.warn('Could not load players for autocomplete:', error);
        }

        // Handle player count changes
        document.getElementById('increase-players').onclick = (e) => {
            e.preventDefault();
            const current = parseInt(playerCountInput.value);
            if (current < 8) {
                playerCountInput.value = current + 1;
                updatePlayerNameInputs();
            }
        };

        document.getElementById('decrease-players').onclick = (e) => {
            e.preventDefault();
            const current = parseInt(playerCountInput.value);
            if (current > 1) {
                playerCountInput.value = current - 1;
                updatePlayerNameInputs();
            }
        };

        // Handle game type changes (radio buttons)
        form.querySelectorAll('input[name="gameType"]').forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === 'custom' && radio.checked) {
                    customPointsInput.classList.remove('hidden');
                    customPointsInput.focus();
                } else {
                    customPointsInput.classList.add('hidden');
                }
            });
        });

        function updatePlayerNameInputs() {
            const count = parseInt(playerCountInput.value);

            // Preserve existing values before rebuilding
            const existingValues = [];
            playerNamesContainer.querySelectorAll('.player-name-input').forEach(input => {
                existingValues.push(input.value);
            });

            playerNamesContainer.innerHTML = '';

            for (let i = 0; i < count; i++) {
                const wrapper = document.createElement('div');
                wrapper.style.position = 'relative';

                const input = document.createElement('input');
                input.type = 'text';
                input.name = `player-${i}`;
                input.placeholder = `Player ${i + 1} (optional)`;
                input.className = 'player-name-input';
                input.setAttribute('autocomplete', 'off');

                // Restore previous value if it exists
                if (i < existingValues.length) {
                    input.value = existingValues[i];
                }

                // Autocomplete suggestion list
                const suggestionsList = document.createElement('div');
                suggestionsList.className = 'player-suggestions';
                suggestionsList.style.display = 'none';

                // Handle input for suggestions
                input.addEventListener('input', (e) => {
                    const value = e.target.value.toLowerCase().trim();

                    // Validate for duplicates whenever input changes
                    validatePlayerNames();

                    if (value.length === 0) {
                        suggestionsList.style.display = 'none';
                        return;
                    }

                    // Get all currently selected player names (excluding this input)
                    const selectedNames = Array.from(playerNamesContainer.querySelectorAll('.player-name-input'))
                        .filter(inp => inp !== input)
                        .map(inp => inp.value.toLowerCase().trim())
                        .filter(name => name !== '');

                    // Filter existing players matching the input, excluding already selected ones
                    const matches = existingPlayers.filter(player =>
                        player.toLowerCase().includes(value) &&
                        !selectedNames.includes(player.toLowerCase())
                    );

                    if (matches.length === 0) {
                        suggestionsList.style.display = 'none';
                        return;
                    }

                    // Show suggestions
                    suggestionsList.innerHTML = matches.map(player => `
                        <div class="suggestion-item" data-player="${player}">
                            ${player}
                        </div>
                    `).join('');
                    suggestionsList.style.display = 'block';

                    // Handle suggestion clicks
                    suggestionsList.querySelectorAll('.suggestion-item').forEach(item => {
                        item.addEventListener('click', () => {
                            input.value = item.getAttribute('data-player');
                            suggestionsList.style.display = 'none';
                            validatePlayerNames();
                        });
                    });
                });

                // Hide suggestions when clicking outside
                input.addEventListener('blur', () => {
                    setTimeout(() => {
                        suggestionsList.style.display = 'none';
                    }, 200);
                    validatePlayerNames();
                });

                input.addEventListener('focus', () => {
                    if (input.value.length > 0) {
                        const event = new Event('input', { bubbles: true });
                        input.dispatchEvent(event);
                    }
                });

                wrapper.appendChild(input);
                wrapper.appendChild(suggestionsList);
                playerNamesContainer.appendChild(wrapper);
            }
        }

        // Validate player names for duplicates and enable/disable submit button
        function validatePlayerNames() {
            const submitButton = document.querySelector('#new-game-form button[type="submit"]');
            if (!submitButton) return;

            const playerInputs = Array.from(playerNamesContainer.querySelectorAll('.player-name-input'));
            const enteredNames = playerInputs
                .map(input => input.value.trim())
                .filter(name => name !== '');

            // Check for duplicates (case-insensitive)
            const normalizedNames = enteredNames.map(name => name.toLowerCase());
            const hasDuplicates = normalizedNames.length !== new Set(normalizedNames).size;

            // Clear previous error styling
            playerInputs.forEach(input => {
                input.style.borderColor = '';
            });

            // Show/hide duplicate error message
            let dupError = playerNamesContainer.querySelector('.duplicate-error');
            if (!dupError) {
                dupError = document.createElement('p');
                dupError.className = 'duplicate-error form-error';
                playerNamesContainer.appendChild(dupError);
            }

            if (hasDuplicates) {
                // Find and highlight duplicates
                const nameCounts = {};
                playerInputs.forEach(input => {
                    const name = input.value.trim().toLowerCase();
                    if (name !== '') {
                        nameCounts[name] = (nameCounts[name] || 0) + 1;
                    }
                });

                const dupNames = [...new Set(playerInputs
                    .filter(input => {
                        const name = input.value.trim().toLowerCase();
                        return name !== '' && nameCounts[name] > 1;
                    })
                    .map(input => input.value.trim())
                )];

                playerInputs.forEach(input => {
                    const name = input.value.trim().toLowerCase();
                    if (name !== '' && nameCounts[name] > 1) {
                        input.style.borderColor = '#f44336';
                    }
                });

                dupError.textContent = `Duplicate name: ${dupNames.join(', ')}`;
                dupError.style.display = 'block';
                submitButton.disabled = true;
                submitButton.style.opacity = '0.5';
                submitButton.style.cursor = 'not-allowed';
                submitButton.title = 'Remove duplicate player names to continue';
            } else {
                dupError.style.display = 'none';
                submitButton.disabled = false;
                submitButton.style.opacity = '';
                submitButton.style.cursor = '';
                submitButton.title = '';
            }
        }

        updatePlayerNameInputs();
    }

    /**
     * Render scoreboard during active game
     */
    function renderScoreboard(game) {
        const container = document.getElementById('scoreboard');

        // Build sparkline and trend data per player
        const playerExtras = game.players.map((player) => {
            const turns = player.turns || [];
            const turnScores = turns.map(t => (t.busted ? 0 : t.darts.reduce((a, b) => a + b, 0)));

            // Trend: compare last 3 vs previous 3
            let trendHtml = '';
            if (turnScores.length >= 2) {
                const last3 = turnScores.slice(-3);
                const prev3 = turnScores.slice(-6, -3);
                const lastAvg = last3.reduce((a, b) => a + b, 0) / last3.length;
                const prevAvg = prev3.length > 0 ? prev3.reduce((a, b) => a + b, 0) / prev3.length : lastAvg;
                const diff = lastAvg - prevAvg;
                if (diff > 2) {
                    trendHtml = '<span class="trend-indicator trend-up">&#9650;</span>';
                } else if (diff < -2) {
                    trendHtml = '<span class="trend-indicator trend-down">&#9660;</span>';
                } else {
                    trendHtml = '<span class="trend-indicator trend-neutral">&#9654;</span>';
                }
            }

            // Sparkline: last 5 turn scores
            let sparkHtml = '';
            if (turnScores.length > 0) {
                const last5 = turnScores.slice(-5);
                const maxVal = Math.max(...last5, 1);
                sparkHtml = '<span class="sparkline-container" data-values="' + last5.join(',') + '">' +
                    last5.map(v => {
                        const h = Math.max(2, Math.round((v / maxVal) * 16));
                        return '<span class="sparkline-bar" style="height:' + h + 'px"></span>';
                    }).join('') +
                    '</span>';
            }

            return { trendHtml, sparkHtml };
        });

        container.innerHTML = game.players.map((player, index) => {
            const isCurrent = index === game.current_player_index;
            const stats = player.stats;
            const extras = playerExtras[index];
            const avgDisplay = player.turns.length > 0 ? (stats.totalScore / player.turns.length).toFixed(1) : '—';
            return `
                <div class="player-score-card ${isCurrent ? 'current' : ''}" data-player-index="${index}">
                    <div class="player-score-name">${player.name}</div>
                    <div class="player-score-value">${player.currentScore}</div>
                    <div class="player-score-stats">
                        <div>Turns: ${player.turns.length}</div>
                        <div>Avg: ${avgDisplay} ${extras.trendHtml}</div>
                        <div>${extras.sparkHtml}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Animate score countdown for any changed scores
        game.players.forEach((player, index) => {
            const key = player.name + '_' + index;
            const prev = previousPlayerScores.get(key);
            if (prev !== undefined && prev !== player.currentScore) {
                const el = container.querySelector(`.player-score-card[data-player-index="${index}"] .player-score-value`);
                if (el) {
                    animateScoreCountdown(el, prev, player.currentScore, 600);
                }
            }
            previousPlayerScores.set(key, player.currentScore);
        });
    }

    /**
     * Render dart input fields
     */
    function renderDartInputs(game) {
        const container = document.getElementById('dart-inputs-container');
        const player = Game.getCurrentPlayer(game);
        const mode = game.scoring_mode;

        container.innerHTML = '';

        if (mode === 'per-dart') {
            for (let i = 0; i < 3; i++) {
                const group = document.createElement('div');
                group.className = 'dart-input-group';
                group.innerHTML = `
                    <label>Dart ${i + 1}</label>
                    <input type="number" min="0" max="180" class="dart-input" placeholder="0">
                `;
                container.appendChild(group);
            }
        } else {
            const group = document.createElement('div');
            group.className = 'dart-input-group';
            group.innerHTML = `
                <label>Turn Total (3 darts)</label>
                <input type="number" min="0" max="180" class="dart-input" placeholder="0">
            `;
            container.appendChild(group);
        }

        // Add Enter key listener to all dart inputs
        container.querySelectorAll('.dart-input').forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('submit-turn-btn').click();
                }
            });
        });

        // Add quick buttons
        const quickSection = document.createElement('div');
        quickSection.className = 'dart-number-pad';
        Game.getQuickDarts().forEach(dart => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'dart-quick-btn';
            btn.textContent = dart;
            btn.onclick = (e) => {
                e.preventDefault();
                const inputs = container.querySelectorAll('.dart-input');
                const firstEmpty = Array.from(inputs).find(input => !input.value);
                if (firstEmpty) {
                    firstEmpty.value = dart;
                    firstEmpty.focus();
                }
            };
            quickSection.appendChild(btn);
        });
        container.appendChild(quickSection);

        // Checkout suggestions
        if (game.win_condition === 'exact' && player.currentScore <= 170 && player.currentScore >= 2) {
            const routes = Game.getCheckoutSuggestions(player.currentScore);
            if (routes) {
                const checkoutDiv = document.createElement('div');
                checkoutDiv.className = 'checkout-suggestions';
                checkoutDiv.innerHTML = `
                    <div class="checkout-label">Checkout</div>
                    <div class="checkout-routes">
                        ${routes.map(r => `<span class="checkout-pill">${r}</span>`).join('')}
                    </div>
                `;
                container.appendChild(checkoutDiv);
            }
        }
    }

    /**
     * Render current player info
     */
    function renderCurrentPlayer(game) {
        const player = Game.getCurrentPlayer(game);
        const amateurBadge = game.win_condition === 'below'
            ? '<span class="amateur-mode-badge">Amateur Mode</span>'
            : '';

        // Handle completed games or invalid player index
        if (!player) {
            const winner = game.players.find(p => p.winner);
            document.getElementById('current-player-name').textContent = winner
                ? `${winner.name} Wins!`
                : 'Game Complete';
            document.getElementById('game-title').innerHTML = `${game.game_type} - Finished ${amateurBadge}`;
            return;
        }

        document.getElementById('current-player-name').textContent = `${player.name}'s Turn`;
        document.getElementById('game-title').innerHTML = `${game.game_type} - Turn ${game.current_turn + 1} ${amateurBadge}`;
    }

    /**
     * Render turn history
     */
    function renderTurnHistory(game) {
        const container = document.getElementById('turn-history');
        if (!container) return;

        const startScore = game.game_type;
        const maxRounds = Math.max(...game.players.map(p => p.turns.length), 0);

        if (maxRounds === 0) {
            container.innerHTML = '<p class="placeholder" style="font-size: 0.8rem;">No turns yet</p>';
            return;
        }

        let html = '<div class="scoreboard-table-wrapper"><table class="scoreboard-table">';

        // Header row - player names
        html += '<thead><tr><th class="scoreboard-round-col">Rnd</th>';
        game.players.forEach((p, i) => {
            const isCurrent = i === game.current_player_index;
            html += `<th class="scoreboard-player-col" colspan="2">${isCurrent ? '➜ ' : ''}${p.name}</th>`;
        });
        html += '</tr>';
        // Sub-header
        html += '<tr><th></th>';
        game.players.forEach(() => {
            html += '<th class="scoreboard-sub-header">Score</th><th class="scoreboard-sub-header">Left</th>';
        });
        html += '</tr></thead>';

        // Body - latest round on top
        html += '<tbody>';
        for (let r = maxRounds - 1; r >= 0; r--) {
            html += `<tr class="${r === maxRounds - 1 ? 'scoreboard-latest' : ''}">`;
            html += `<td class="scoreboard-round-num">${r + 1}</td>`;
            game.players.forEach(p => {
                const turn = (p.turns || [])[r];
                if (turn) {
                    const darts = Array.isArray(turn.darts) ? turn.darts : [turn.darts || 0];
                    const total = darts.reduce((a, b) => a + b, 0);
                    const isBusted = turn.busted;
                    const isHighScore = total >= 100;
                    const scoreClass = isBusted ? 'scoreboard-busted' : isHighScore ? 'scoreboard-high' : '';
                    html += `<td class="scoreboard-score ${scoreClass}" title="${darts.length > 1 ? darts.join('+') : ''}">${total}${isBusted ? '*' : ''}</td>`;
                    html += `<td class="scoreboard-remaining">${turn.remaining}</td>`;
                } else {
                    html += '<td class="scoreboard-score">-</td><td class="scoreboard-remaining">-</td>';
                }
            });
            html += '</tr>';
        }
        html += '</tbody></table></div>';

        container.innerHTML = html;
    }

    /**
     * Pagination state
     */
    let paginationState = {
        currentPage: 1,
        gamesPerPage: 6,
        totalPages: 1,
        totalGames: 0,
        filter: '',
        sortOrder: 'newest',
        includePractice: false
    };

    // Pagination state for player profile games list
    let profilePaginationState = {
        currentPage: 1,
        totalPages: 1,
        gamesPerPage: 10,
        playerName: '',
        totalGames: 0
    };

    /**
     * Render game history list with pagination
     * OPTIMIZED: Uses database-level pagination instead of client-side
     */
    async function renderGameHistory(filter = '', sortOrder = 'newest', page = 1, includePractice = false, showIncomplete = false) {
        const container = document.getElementById('games-history-list');
        console.log('Filtering history:', { filter, includePractice, showIncomplete });

        // OPTIMIZED: Database-level pagination and filtering
        const { games: paginatedGames, pagination } = await Storage.getGamesPaginated(
            page,
            paginationState.gamesPerPage,
            {
                completed: showIncomplete ? undefined : true,
                showIncomplete: showIncomplete,
                playerName: filter || undefined,
                sortOrder: sortOrder,
                includePractice: includePractice
            }
        );

        // Update pagination state
        paginationState.filter = filter;
        paginationState.sortOrder = sortOrder;
        paginationState.includePractice = includePractice;
        paginationState.showIncomplete = showIncomplete;
        paginationState.currentPage = pagination.page;
        paginationState.totalPages = pagination.totalPages;
        paginationState.totalGames = pagination.total;

        // Show/hide pagination controls
        const paginationControls = document.getElementById('pagination-controls');
        if (pagination.total === 0) {
            const hasFilter = filter && filter.trim().length > 0;
            container.innerHTML = hasFilter
                ? `<p class="placeholder">No games found for "${filter}". Try a different name or clear the filter.</p>`
                : '<p class="placeholder">No games yet. Start your first game to see it here!</p>';
            if (paginationControls) paginationControls.style.display = 'none';
            document.getElementById('history-games-count').textContent = 'Total: 0 games';
            return;
        }

        // Render games for current page
        container.innerHTML = paginatedGames.map(game => {
            const winner = game.players.find(p => p.winner);
            const date = new Date(game.created_at);
            const dateStr = date.toLocaleDateString();
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const hasTurns = game.players.some(p => (p.totalTurns || 0) > 0);

            return `
                <div class="game-card" onclick="Router.navigate('game-detail', {gameId: '${game.id}'})">
                    <div class="game-card-header">
                        <div class="game-card-title">${game.game_type} Points</div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <div class="game-card-date">${dateStr} ${timeStr}</div>
                            ${game.is_practice ? '<span class="practice-badge">Practice</span>' : ''}
                            <span class="game-status-badge" style="background: #4caf50; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">COMPLETED</span>
                            ${!hasTurns ? `<button class="btn btn-danger btn-small delete-game-btn" data-game-id="${game.id}" onclick="event.stopPropagation(); App.confirmDeleteGame(this.dataset.gameId)"><svg class="icon-bin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M5 6v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>` : ''}
                        </div>
                    </div>
                    <div class="game-card-players">
                        ${game.players.map(p => `
                            <div class="player-badge ${p.winner ? 'winner' : ''}">
                                ${p.name}
                            </div>
                        `).join('')}
                    </div>
                    <div class="game-card-footer">
                        <span>🏆 ${winner?.name || 'N/A'}</span>
                        <span class="game-type-badge">${game.players.length} players</span>
                    </div>
                </div>
            `;
        }).join('');

        // Update pagination controls
        updatePaginationControls();

        // Update games count
        document.getElementById('history-games-count').textContent = `Total: ${pagination.total} games`;
    }

    /**
     * Update pagination UI controls
     */
    function updatePaginationControls() {
        const { currentPage, totalPages, gamesPerPage, totalGames } = paginationState;
        const paginationControls = document.getElementById('pagination-controls');
        const paginationInfo = document.getElementById('pagination-info-text');
        const paginationPrev = document.getElementById('pagination-prev');
        const paginationNext = document.getElementById('pagination-next');
        const paginationNumbers = document.getElementById('pagination-numbers');

        if (!paginationControls) return;

        // Show/hide pagination
        if (totalPages <= 1) {
            paginationControls.style.display = 'none';
            return;
        }

        paginationControls.style.display = 'flex';

        // Update info text
        const startIdx = (currentPage - 1) * gamesPerPage + 1;
        const endIdx = Math.min(currentPage * gamesPerPage, totalGames || 0);
        paginationInfo.textContent = `Showing ${startIdx}-${endIdx} of ${totalGames || 0} (Page ${currentPage} of ${totalPages})`;

        // Update prev/next buttons
        paginationPrev.disabled = currentPage === 1;
        paginationNext.disabled = currentPage === totalPages;

        // Generate page number buttons
        paginationNumbers.innerHTML = '';
        const maxVisible = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);

        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            const btn = document.createElement('button');
            btn.className = `btn btn-secondary btn-small pagination-number ${i === currentPage ? 'active' : ''}`;
            btn.textContent = i;
            btn.onclick = (e) => {
                e.preventDefault();
                renderGameHistory(paginationState.filter, paginationState.sortOrder, i, paginationState.includePractice, paginationState.showIncomplete);
            };
            paginationNumbers.appendChild(btn);
        }
    }

    /**
     * Render paginated game history for a specific player profile
     */
    async function renderPlayerGameHistory(playerName, page = 1) {
        const container = document.getElementById('profile-games-list');
        if (!container) return;

        profilePaginationState.playerName = playerName;
        profilePaginationState.currentPage = page;

        try {
            const { games, pagination } = await Storage.getGamesPaginated(
                page,
                profilePaginationState.gamesPerPage,
                {
                    playerName: playerName,
                    completed: undefined,
                    showIncomplete: null, // Show both complete and incomplete
                    includePractice: null  // Show both practice and regular
                }
            );

            profilePaginationState.totalPages = pagination.totalPages;
            profilePaginationState.totalGames = pagination.total;

            document.getElementById('profile-history-count').textContent = `Total: ${pagination.total} games`;

            if (games.length === 0) {
                container.innerHTML = '<p class="placeholder">No games found for this player.</p>';
                document.getElementById('profile-pagination-controls').style.display = 'none';
                return;
            }

            container.innerHTML = games.map(game => {
                const winner = game.players.find(p => p.winner);
                const date = new Date(game.created_at).toLocaleDateString();
                const playerInGame = game.players.find(p => p.name === playerName);
                const isWinner = playerInGame?.winner;

                return `
                    <div class="game-card history-card ${isWinner ? 'winner-light' : ''}" onclick="Router.navigate('game-detail', {gameId: '${game.id}'})">
                        <div class="game-card-header">
                            <div class="game-card-title">${game.game_type} Points</div>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <div class="game-card-date">${date}</div>
                                ${game.is_practice ? '<span class="practice-badge">Practice</span>' : ''}
                                ${!game.completed_at ? '<span class="status-badge progress">In Progress</span>' : ''}
                            </div>
                        </div>
                        <div class="game-card-body">
                            <div class="history-card-players">
                                ${game.players.map(p => `
                                    <div class="player-pill ${p.name === playerName ? 'current' : ''} ${p.winner ? 'winner' : ''}">
                                        ${p.winner ? '🏆 ' : ''}${p.name}
                                    </div>
                                `).join('<span class="vs">vs</span>')}
                            </div>
                            <div class="game-card-result">
                                ${isWinner ? '<span class="result-win">WIN</span>' : (game.completed_at ? '<span class="result-loss">LOSS</span>' : '<span class="result-ongoing">PLAYING</span>')}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            updateProfilePaginationUI();
        } catch (error) {
            console.error('Error loading player history:', error);
            container.innerHTML = '<p class="placeholder">Error loading games.</p>';
        }
    }

    /**
     * Update pagination controls for player profile history
     */
    function updateProfilePaginationUI() {
        const { currentPage, totalPages } = profilePaginationState;
        const controls = document.getElementById('profile-pagination-controls');
        const numbers = document.getElementById('profile-pagination-numbers');
        const prev = document.getElementById('profile-pagination-prev');
        const next = document.getElementById('profile-pagination-next');

        if (!controls || totalPages <= 1) {
            if (controls) controls.style.display = 'none';
            return;
        }

        controls.style.display = 'flex';
        prev.disabled = currentPage === 1;
        next.disabled = currentPage === totalPages;

        numbers.innerHTML = '';
        const maxVisible = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);

        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            const btn = document.createElement('button');
            btn.className = `btn btn-secondary btn-small pagination-number ${i === currentPage ? 'active' : ''}`;
            btn.textContent = i;
            btn.onclick = (e) => {
                e.preventDefault();
                renderPlayerGameHistory(profilePaginationState.playerName, i);
            };
            numbers.appendChild(btn);
        }

        prev.onclick = (e) => {
            e.preventDefault();
            if (currentPage > 1) renderPlayerGameHistory(profilePaginationState.playerName, currentPage - 1);
        };

        next.onclick = (e) => {
            e.preventDefault();
            if (currentPage < totalPages) renderPlayerGameHistory(profilePaginationState.playerName, currentPage + 1);
        };
    }

    /**
     * Render game detail view
     */
    async function renderGameDetail(gameId) {
        const game = await Storage.getGame(gameId);
        if (!game) return;

        const content = document.getElementById('game-detail-content');
        const winner = game.players.find(p => p.winner);
        const date = new Date(game.created_at);

        const createdTime = new Date(game.created_at).getTime();
        const completedTime = game.completed_at ? new Date(game.completed_at).getTime() : null;
        const duration = completedTime ? Game.formatDuration(completedTime - createdTime) : 'N/A';

        // Compact inline header
        let html = `
            <div class="detail-header-compact">
                <span class="detail-badge">${game.game_type}</span>
                <span class="detail-info">${date.toLocaleDateString()}</span>
                <span class="detail-info">⏱ ${duration}</span>
                ${game.is_practice ? '<span class="practice-badge">Practice</span>' : ''}
                ${winner ? `<span class="detail-winner">🏆 ${winner.name}</span>` : ''}
            </div>
        `;

        // Player stats cards - compute from actual turn data
        if (game.completed_at) {
            const playerStats = game.players.map(p => {
                const turns = p.turns || [];
                const totalScore = turns.reduce((sum, t) => {
                    const darts = Array.isArray(t.darts) ? t.darts : [t.darts || 0];
                    return sum + darts.reduce((a, b) => a + b, 0);
                }, 0);
                const totalDarts = turns.reduce((sum, t) => {
                    const darts = Array.isArray(t.darts) ? t.darts : [t.darts || 0];
                    return sum + darts.length;
                }, 0);
                return {
                    name: p.name,
                    remaining: p.currentScore,
                    winner: p.winner,
                    finish_rank: p.finish_rank,
                    turns: turns.length,
                    darts: totalDarts,
                    totalScore: totalScore,
                    avgPerTurn: turns.length > 0 ? (totalScore / turns.length).toFixed(1) : '0'
                };
            }).sort((a, b) => (a.finish_rank || 999) - (b.finish_rank || 999));

            html += '<div class="detail-stats-grid">';
            playerStats.forEach((p, index) => {
                const position = index + 1;
                const isWinner = p.finish_rank === 1 || p.winner;
                const startScore = game.game_type;
                const progress = ((startScore - p.remaining) / startScore) * 100;

                html += `
                    <div class="detail-player-card ${isWinner ? 'winner' : ''}">
                        <div class="detail-player-header">
                            <span class="detail-player-rank">${isWinner ? '🏆' : '#' + position}</span>
                            <span class="detail-player-name">${p.name}</span>
                        </div>
                        <div class="detail-progress-bar">
                            <div class="detail-progress-fill" style="width: ${progress}%"></div>
                        </div>
                        <div class="detail-player-stats">
                            <div class="stat-item"><span class="stat-value">${p.darts}</span><span class="stat-label">Darts</span></div>
                            <div class="stat-item"><span class="stat-value">${p.turns}</span><span class="stat-label">Turns</span></div>
                            <div class="stat-item"><span class="stat-value">${p.avgPerTurn}</span><span class="stat-label">Avg</span></div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        // Scoreboard - side-by-side columns per player with running totals
        const startScore = game.game_type;
        const maxRounds = Math.max(...game.players.map(p => (p.turns || []).length), 0);

        if (maxRounds > 0) {
            html += '<div class="turn-history-section"><h4>Scoreboard</h4>';
            html += '<div class="scoreboard-table-wrapper"><table class="scoreboard-table">';

            // Header row - player names
            html += '<thead><tr><th class="scoreboard-round-col">Rnd</th>';
            game.players.forEach(p => {
                html += `<th class="scoreboard-player-col" colspan="2">${p.winner ? '👑 ' : ''}${p.name}</th>`;
            });
            html += '</tr>';
            // Sub-header
            html += '<tr><th></th>';
            game.players.forEach(() => {
                html += '<th class="scoreboard-sub-header">Score</th><th class="scoreboard-sub-header">Left</th>';
            });
            html += '</tr></thead>';

            // Body - one row per round, latest on top
            html += '<tbody>';
            for (let r = maxRounds - 1; r >= 0; r--) {
                html += `<tr class="${r === maxRounds - 1 ? 'scoreboard-latest' : ''}">`;
                html += `<td class="scoreboard-round-num">${r + 1}</td>`;
                game.players.forEach(p => {
                    const turn = (p.turns || [])[r];
                    if (turn) {
                        const darts = Array.isArray(turn.darts) ? turn.darts : [turn.darts || 0];
                        const total = darts.reduce((a, b) => a + b, 0);
                        const isBusted = turn.busted;
                        const isHighScore = total >= 100;
                        const scoreClass = isBusted ? 'scoreboard-busted' : isHighScore ? 'scoreboard-high' : '';
                        html += `<td class="scoreboard-score ${scoreClass}" title="${darts.length > 1 ? darts.join('+') : ''}">${total}${isBusted ? '*' : ''}</td>`;
                        html += `<td class="scoreboard-remaining">${turn.remaining}</td>`;
                    } else {
                        html += '<td class="scoreboard-score">-</td><td class="scoreboard-remaining">-</td>';
                    }
                });
                html += '</tr>';
            }
            html += '</tbody></table></div>';
        }

        content.innerHTML = html;
    }

    /**
     * Render leaderboard
     */
    async function renderLeaderboard(metric = 'wins', timeFilter = 'all-time', searchQuery = '') {
        const container = document.getElementById('leaderboard-content');
        const podiumContainer = document.getElementById('leaderboard-podium');
        
        let rankings = await Stats.getLeaderboard(metric, timeFilter);

        // Apply search filter if provided
        if (searchQuery) {
            const query = searchQuery.toLowerCase().trim();
            rankings = rankings.filter(r => r.name.toLowerCase().includes(query));
        }

        if (rankings.length === 0) {
            if (podiumContainer) podiumContainer.innerHTML = '';
            container.innerHTML = `<p class="placeholder">${searchQuery ? 'No players found matching "' + searchQuery + '"' : 'No games yet'}</p>`;
            return;
        }

        const metricLabel = {
            'wins': 'Wins',
            'win-rate': 'Win Rate',
            'avg-turn': 'Avg/Turn',
            '100s': '100+',
            'max-turn': 'Top Turn'
        }[metric] || 'Wins';

        const formatMetricValue = (val, type) => {
            if (type === 'win-rate') return `${parseFloat(val).toFixed(1)}%`;
            if (type === 'avg-turn') return parseFloat(val).toFixed(2);
            return val;
        };

        // Render Podium (Only if no search query)
        if (podiumContainer) {
            if (!searchQuery && rankings.length >= 3) {
                const top3 = rankings.slice(0, 3);
                // Order: 2, 1, 3 for visual balance
                const displayOrder = [
                    { ...top3[1], actualRank: 2, medal: '🥈' },
                    { ...top3[0], actualRank: 1, medal: '🥇' },
                    { ...top3[2], actualRank: 3, medal: '🥉' }
                ];
                
                podiumContainer.innerHTML = displayOrder.map(player => `
                    <div class="podium-card rank-${player.actualRank}" onclick="App.viewPlayerProfile('${player.name}')">
                        <span class="podium-rank-icon">${player.medal}</span>
                        <div>
                            <div class="podium-name">${player.name}</div>
                            <div class="podium-value">${formatMetricValue(player.metric, metric)}</div>
                            <div class="podium-label">${metricLabel}</div>
                        </div>
                    </div>
                `).join('');
                podiumContainer.style.display = 'grid';
            } else {
                podiumContainer.innerHTML = '';
                podiumContainer.style.display = 'none';
            }
        }

        // Render List (Players from rank 4 onwards, or all if searching)
        const listStart = (!searchQuery && rankings.length >= 3) ? 3 : 0;
        const listPlayers = rankings.slice(listStart);

        let html = '<div class="leaderboard-entries">';

        html += listPlayers.map((entry, index) => {
            const rank = listStart + index + 1;
            const rankClass = rank <= 3 ? `rank-${rank}` : '';
            let metricDisplay = formatMetricValue(entry.metric, metric);
            let secondaryStat = '';

            switch (metric) {
                case 'wins':
                    secondaryStat = `${entry.stats.winRate}% win rate`;
                    break;
                case 'win-rate':
                    secondaryStat = `${entry.stats.gamesWon}/${entry.stats.gamesPlayed} wins`;
                    break;
                case 'avg-turn':
                    secondaryStat = `${entry.stats.gamesPlayed} games`;
                    break;
                case '100s':
                    secondaryStat = `${entry.stats.gamesPlayed} games`;
                    break;
                case 'max-turn':
                    secondaryStat = `${entry.stats.gamesPlayed} games`;
                    break;
            }

            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
            const rankDisplay = medal || `#${rank}`;

            return `
                <div class="leaderboard-entry ${rankClass}" onclick="App.viewPlayerProfile('${entry.name}')">
                    <div class="leaderboard-rank ${rankClass}">${rankDisplay}</div>
                    <div class="leaderboard-player">
                        <div class="leaderboard-player-name">${entry.name}</div>
                        <div class="leaderboard-player-detail">${secondaryStat}</div>
                    </div>
                    <div class="leaderboard-stat">
                        <div class="leaderboard-stat-value">${metricDisplay}</div>
                        <div class="leaderboard-stat-label">${metricLabel}</div>
                    </div>
                    <i data-lucide="chevron-right" class="leaderboard-arrow"></i>
                </div>
            `;
        }).join('');

        html += '</div>';
        container.innerHTML = html;
        
        // Init Lucide icons
        if (window.lucide) window.lucide.createIcons();
    }

    /**
     * Render player profile with charts
     */
    async function renderPlayerProfile(playerName) {
        const content = document.getElementById('player-profile-content');

        // Show loading state
        content.innerHTML = '<div class="loading-charts"><p>Loading stats...</p></div>';

        // Fetch all data in parallel for better performance
        const [stats, scoreDistribution, recentPerformance, practiceStats] = await Promise.all([
            Stats.calculatePlayerStats(playerName),
            Stats.getScoreDistribution(playerName),
            Stats.getRecentPerformance(playerName, 10),
            Stats.calculatePracticeStats(playerName)
        ]);

        const initials = playerName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        const avatarColor = getColorForName(playerName);

        let html = `
            <div class="profile-header">
                <div class="profile-avatar" style="background-color: ${avatarColor}">${initials}</div>
                <div class="profile-header-info">
                    <h2 class="profile-name">${playerName}</h2>
                    <p class="profile-joindate">Joined ${stats.joinedDate}</p>
                </div>
            </div>

            <!-- Charts Section -->
            <div class="profile-charts-grid">
                <!-- Win/Loss Chart -->
                <div class="chart-card">
                    <h3>Win/Loss Record</h3>
                    <div class="chart-container chart-container-small">
                        <canvas id="winLossChart"></canvas>
                    </div>
                    <div class="chart-summary">
                        <span class="chart-stat wins">${stats.gamesWon} Wins</span>
                        <span class="chart-stat losses">${stats.gamesPlayed - stats.gamesWon} Losses</span>
                    </div>
                </div>

                <!-- Stats Radar Chart -->
                <div class="chart-card">
                    <h3>Performance Overview</h3>
                    <div class="chart-container chart-container-small">
                        <canvas id="statsRadarChart"></canvas>
                    </div>
                </div>
            </div>

            <!-- Performance Trend Chart (Full Width) -->
            <div class="chart-card chart-card-wide">
                <h3>Performance Trend (Last 10 Games)</h3>
                <div class="chart-container chart-container-line">
                    <canvas id="performanceChart"></canvas>
                </div>
            </div>

            <!-- Score Distribution Chart -->
            <div class="chart-card chart-card-wide">
                <h3>Turn Score Distribution</h3>
                <div class="chart-container chart-container-bar">
                    <canvas id="scoreDistributionChart"></canvas>
                </div>
            </div>

            <!-- Stats Grid -->
            <div class="profile-section">
                <h3>Overall Stats</h3>
                <div class="stats-matrix">
                    <div class="stat-box">
                        <div class="stat-box-label"><i data-lucide="gamepad-2"></i>Games Played</div>
                        <div class="stat-box-value">${stats.gamesPlayed}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-label"><i data-lucide="trophy"></i>Wins</div>
                        <div class="stat-box-value">${stats.gamesWon}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-label"><i data-lucide="percent"></i>Win Rate</div>
                        <div class="stat-box-value">${stats.winRate}%</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-label"><i data-lucide="bar-chart-2"></i>Avg/Turn</div>
                        <div class="stat-box-value">${stats.avgPerTurn || stats.avgPerDart}</div>
                    </div>
                </div>
            </div>

            <div class="profile-section">
                <h3>Dart Stats</h3>
                <div class="stats-matrix">
                    <div class="stat-box">
                        <div class="stat-box-label"><i data-lucide="sigma"></i>Total Score</div>
                        <div class="stat-box-value">${(stats.totalScore || 0).toLocaleString()}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-label"><i data-lucide="repeat"></i>Total Turns</div>
                        <div class="stat-box-value">${stats.avgPerTurn && parseFloat(stats.avgPerTurn) > 0 ? Math.round(stats.totalScore / parseFloat(stats.avgPerTurn)) : 0}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-label"><i data-lucide="chevrons-up"></i>Max Turn</div>
                        <div class="stat-box-value">${stats.maxTurn}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-label"><i data-lucide="target"></i>100+ Turns</div>
                        <div class="stat-box-value">${stats.total100s}</div>
                    </div>
                </div>
            </div>

            ${practiceStats ? `
            <div class="profile-section">
                <h3>Practice Stats</h3>
                <div class="stats-matrix">
                    <div class="stat-box">
                        <div class="stat-box-label"><i data-lucide="dumbbell"></i>Sessions</div>
                        <div class="stat-box-value">${practiceStats.gamesPlayed}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-label"><i data-lucide="repeat"></i>Total Turns</div>
                        <div class="stat-box-value">${practiceStats.totalTurns}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-label"><i data-lucide="bar-chart-2"></i>Avg/Turn</div>
                        <div class="stat-box-value">${practiceStats.avgPerTurn}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-label"><i data-lucide="chevrons-up"></i>Max Turn</div>
                        <div class="stat-box-value">${practiceStats.maxTurn}</div>
                    </div>
                </div>
            </div>
            ` : ''}

            <div class="profile-section">
                <h3>High Scores</h3>
                <div class="stats-matrix">
                    <div class="stat-box">
                        <div class="stat-box-label"><i data-lucide="rocket"></i>140+ Turns</div>
                        <div class="stat-box-value">${stats.total140plus}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-label"><i data-lucide="pie-chart"></i>Checkout %</div>
                        <div class="stat-box-value">${stats.checkoutPercentage}%</div>
                    </div>
                </div>
            </div>
        `;

        // Head-to-Head section with chart
        if (Object.keys(stats.headToHead).length > 0) {
            html += `
                <div class="profile-section">
                    <h3>Head-to-Head Records</h3>
                    <div class="chart-container chart-container-h2h">
                        <canvas id="headToHeadChart"></canvas>
                    </div>
                    <div class="head-to-head-list">
                        ${Object.entries(stats.headToHead).map(([opponent, record]) => {
                            const total = record.wins + record.losses;
                            return `
                                <div class="h2h-card">
                                    <div class="h2h-opponent">${opponent}</div>
                                    <div class="h2h-record">
                                        <span class="h2h-wins">${record.wins}W</span>
                                        <span class="h2h-losses">${record.losses}L</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        // Full Game History Section (AT THE VERY BOTTOM)
        html += `
            <div class="profile-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-lg);">
                    <h3>Game History</h3>
                    <p id="profile-history-count" style="font-size: 0.85rem; color: var(--color-text-light);"></p>
                </div>
                <div id="profile-games-list" class="games-list">
                    <div class="loading-charts"><p>Loading games...</p></div>
                </div>
                
                <!-- Pagination -->
                <div id="profile-pagination-controls" class="pagination-controls mt-xl" style="display: none;">
                    <button class="btn btn-secondary btn-small" id="profile-pagination-prev">&larr; Prev</button>
                    <div id="profile-pagination-numbers" class="pagination-numbers"></div>
                    <button class="btn btn-secondary btn-small" id="profile-pagination-next">Next &rarr;</button>
                </div>
            </div>
        `;

        document.getElementById('profile-player-name').textContent = `${playerName}'s Profile`;
        content.innerHTML = html;

        // Render charts after DOM is updated
        setTimeout(() => {
            // Win/Loss Doughnut Chart
            Charts.createWinLossChart(
                'winLossChart',
                stats.gamesWon,
                stats.gamesPlayed - stats.gamesWon
            );

            // Stats Radar Chart
            Charts.createStatsRadarChart('statsRadarChart', stats);

            // Performance Trend Line Chart
            Charts.createPerformanceChart('performanceChart', recentPerformance);

            // Score Distribution Bar Chart
            Charts.createScoreDistributionChart('scoreDistributionChart', scoreDistribution);

            // Head-to-Head Chart (if data exists)
            if (Object.keys(stats.headToHead).length > 0) {
                Charts.createHeadToHeadChart('headToHeadChart', stats.headToHead);
            }

            // Render paginated game history for this player
            renderPlayerGameHistory(playerName, 1);

            // Initialize any new icons
            if (window.lucide) {
                window.lucide.createIcons();
            }
        }, 50);
    }

    /**
     * Update active game UI
     */
    function updateActiveGameUI(game, animate = false) {
        renderScoreboard(game);
        renderCurrentPlayer(game);
        renderDartInputs(game);
        renderTurnHistory(game);

        // Update live rankings with current game standings
        const rankings = Game.getRankings(game);
        updateWinnersBoard(rankings, animate);
    }

    function flashScoreCard(playerIndex) {
        const card = document.querySelector(`.player-score-card[data-player-index="${playerIndex}"]`);
        if (!card) return;
        card.classList.add('score-flash');
        setTimeout(() => card.classList.remove('score-flash'), 600);
    }

    function bustShakeAnimation(playerIndex) {
        const card = document.querySelector(`.player-score-card[data-player-index="${playerIndex}"]`);
        const dartEntry = document.querySelector('.dart-entry-section');
        if (card) {
            card.classList.add('bust-shake');
            setTimeout(() => card.classList.remove('bust-shake'), 800);
        }
        if (dartEntry) {
            dartEntry.classList.add('bust-flash');
            setTimeout(() => dartEntry.classList.remove('bust-flash'), 800);
        }
    }

    /**
     * Render game in spectator mode (read-only view)
     */
    function renderSpectatorGame(game) {
        renderScoreboard(game);
        renderCurrentPlayer(game);
        renderTurnHistory(game);

        // Hide dart input controls for spectator
        const dartEntrySection = document.querySelector('.dart-entry-section');
        if (dartEntrySection) {
            dartEntrySection.style.display = 'none';
        }

        // Show spectator indicator (only add once)
        const pageHeader = document.querySelector('.page-header');
        if (pageHeader && !document.getElementById('spectator-indicator')) {
            const spectatorIndicator = document.createElement('div');
            spectatorIndicator.id = 'spectator-indicator';
            spectatorIndicator.className = 'spectator-badge';
            spectatorIndicator.innerHTML = `
                <div class="live-pulse-container">
                    <span class="pulse-dot"></span>
                    <span id="live-indicator-text">LIVE</span>
                </div>
                <span class="badge-text">Spectator Mode</span>
            `;
            pageHeader.appendChild(spectatorIndicator);
        }

        // Update live rankings with current game standings
        const rankings = Game.getRankings(game);
        updateWinnersBoard(rankings, false);

        // Show spectator-specific leaderboard with player stats from current game
        renderSpectatorLeaderboard(game);
    }

    /**
     * Show/hide live indicator for spectator mode
     */
    function showLiveIndicator(isLive) {
        const badge = document.querySelector('.spectator-badge');
        const pulse = document.querySelector('.live-pulse-container');
        
        if (badge && pulse) {
            pulse.style.display = isLive ? 'flex' : 'none';
            badge.style.opacity = isLive ? '1' : '0.7';
            badge.title = isLive ? 'Connected - Live updates enabled' : 'Disconnected';
        }
    }

    /**
     * Render leaderboard for spectator view showing players in current game
     */
    async function renderSpectatorLeaderboard(game) {
        try {
            // Find or create a container for spectator leaderboard
            let leaderboardContainer = document.getElementById('spectator-leaderboard-container');

            if (!leaderboardContainer) {
                // Create container after turn history
                const turnHistorySection = document.querySelector('.turn-history-section');
                if (turnHistorySection) {
                    leaderboardContainer = document.createElement('div');
                    leaderboardContainer.id = 'spectator-leaderboard-container';
                    leaderboardContainer.className = 'spectator-leaderboard';
                    leaderboardContainer.style.cssText = 'background: var(--color-bg-lighter); border-radius: var(--radius-lg); padding: var(--spacing-xl); box-shadow: var(--shadow-md); margin-top: var(--spacing-xl);';
                    turnHistorySection.parentNode.insertBefore(leaderboardContainer, turnHistorySection.nextSibling);
                }
            }

            if (!leaderboardContainer) return;

            // Build leaderboard for players in this game
            let html = '<h3 style="margin-top: 0; color: var(--color-primary-dark); text-align: center;">👥 Player Leaderboard</h3>';
            html += '<div style="display: flex; flex-direction: column; gap: 8px;">';

            // Sort players by current score (lowest remaining is best)
            const sortedPlayers = [...game.players].sort((a, b) => {
                // Finished players first (by rank)
                if (a.winner && b.winner) {
                    return (a.finish_rank || 999) - (b.finish_rank || 999);
                }
                if (a.winner) return -1;
                if (b.winner) return 1;
                // Then by current score (lowest first)
                return a.currentScore - b.currentScore;
            });

            sortedPlayers.forEach((player, index) => {
                const stats = player.stats;
                let statusIcon = '';
                let statusText = '';

                if (player.winner) {
                    const medals = ['🥇', '🥈', '🥉'];
                    statusIcon = medals[player.finish_rank - 1] || '🏅';
                    statusText = `Finished - ${player.finish_rank}${player.finish_rank % 10 === 1 && player.finish_rank % 100 !== 11 ? 'st' : player.finish_rank % 10 === 2 && player.finish_rank % 100 !== 12 ? 'nd' : player.finish_rank % 10 === 3 && player.finish_rank % 100 !== 13 ? 'rd' : 'th'}`;
                } else {
                    statusIcon = '▶️';
                    statusText = `Playing - ${player.currentScore} remaining`;
                }

                html += `
                    <div style="display: grid; grid-template-columns: 50px 1fr 150px; gap: 12px; align-items: center; padding: 12px; background: var(--color-bg-light); border-radius: 6px; border-left: 4px solid var(--color-primary);">
                        <div style="text-align: center; font-size: 20px;">${statusIcon}</div>
                        <div>
                            <div style="font-weight: 600; color: var(--color-text-dark); margin-bottom: 4px;">${player.name}</div>
                            <div style="font-size: 12px; color: var(--color-text-light);">${statusText}</div>
                        </div>
                        <div style="text-align: right; font-size: 12px; color: var(--color-text-light);">
                            <div style="font-weight: 600; color: var(--color-primary);">${player.turns.length} turns</div>
                            <div>${stats.totalDarts} darts • Avg: ${player.turns.length > 0 ? (stats.totalScore / player.turns.length).toFixed(1) : '—'}</div>
                        </div>
                    </div>
                `;
            });

            html += '</div>';
            leaderboardContainer.innerHTML = html;
        } catch (error) {
            console.error('Error rendering spectator leaderboard:', error);
        }
    }

    // Store previous rankings for animation tracking
    let previousRankings = {};
    let previousPositions = {}; // Track position changes

    /**
     * Update live rankings board with Olympic medal podium style
     * Shows finished players in medal podium, then active players below
     * @param {Array} rankings - Player rankings
     * @param {Boolean} animate - Whether to animate rank changes (only on round completion)
     */
    function updateWinnersBoard(rankings, animate = false) {
        const board = document.getElementById('live-rankings');
        const rankList = document.getElementById('rankings-list');
        const rankEmojis = ['🥇', '🥈', '🥉'];
        const rankLabels = ['1st', '2nd', '3rd'];

        if (!rankings || rankings.length === 0) {
            board.classList.add('hidden');
            return;
        }

        // Separate finished and active players
        const finishedPlayers = rankings.filter(p => p.rank !== undefined && p.rank !== null && p.rank > 0)
            .sort((a, b) => a.rank - b.rank);
        const activePlayers = rankings.filter(p => !(p.rank !== undefined && p.rank !== null && p.rank > 0))
            .sort((a, b) => a.score - b.score);

        let html = '';

        // Show podium for finished players (top 3)
        if (finishedPlayers.length > 0) {
            html += '<div class="podium-container">';

            // Silver (2nd place)
            if (finishedPlayers[1]) {
                const player = finishedPlayers[1];
                html += `
                    <div class="podium-position silver" data-player="${player.name}">
                        <div class="podium-medal">🥈</div>
                        <div class="podium-name">${player.name}</div>
                        <div class="podium-rank">2nd</div>
                        <div class="podium-height"></div>
                    </div>
                `;
            }

            // Gold (1st place)
            if (finishedPlayers[0]) {
                const player = finishedPlayers[0];
                html += `
                    <div class="podium-position gold" data-player="${player.name}">
                        <div class="podium-medal">🥇</div>
                        <div class="podium-name">${player.name}</div>
                        <div class="podium-rank">1st</div>
                        <div class="podium-height gold-height"></div>
                    </div>
                `;
            }

            // Bronze (3rd place)
            if (finishedPlayers[2]) {
                const player = finishedPlayers[2];
                html += `
                    <div class="podium-position bronze" data-player="${player.name}">
                        <div class="podium-medal">🥉</div>
                        <div class="podium-name">${player.name}</div>
                        <div class="podium-rank">3rd</div>
                        <div class="podium-height"></div>
                    </div>
                `;
            }

            html += '</div>';

            // Additional finished players (4th+)
            if (finishedPlayers.length > 3) {
                html += '<div class="other-finished-header">Other Finalists</div>';
                for (let i = 3; i < finishedPlayers.length; i++) {
                    const player = finishedPlayers[i];
                    const suffix = i === 3 ? 'th' : i === 4 ? 'th' : 'th';
                    html += `
                        <div class="ranking-item finished" data-player="${player.name}">
                            <div class="ranking-medal">🏅</div>
                            <div class="ranking-info">
                                <div class="ranking-name">${player.name}</div>
                                <div class="ranking-detail">✓ ${player.rank}${suffix}</div>
                            </div>
                            <div class="ranking-score">
                                <div>0</div>
                                <div class="ranking-darts">Darts: ${player.darts}</div>
                            </div>
                        </div>
                    `;
                }
            }
        }

        // Show active players if any
        if (activePlayers.length > 0) {
            if (finishedPlayers.length > 0) {
                html += '<div class="active-header">In Progress</div>';
            }

            activePlayers.forEach((player, index) => {
                let scoreChangeIndicator = '';
                let positionChangeIndicator = '';
                let animationClass = '';

                // Calculate position
                const position = finishedPlayers.length + index + 1;
                let suffix = 'th';
                if (position % 10 === 1 && position % 100 !== 11) suffix = 'st';
                else if (position % 10 === 2 && position % 100 !== 12) suffix = 'nd';
                else if (position % 10 === 3 && position % 100 !== 13) suffix = 'rd';
                const positionLabel = position + suffix;

                // Only show changes if animating (round completed)
                if (animate) {
                    // Score changes
                    const prevScore = previousRankings[player.name];
                    if (prevScore !== undefined && prevScore !== player.score) {
                        if (prevScore > player.score) {
                            scoreChangeIndicator = ' ↓ ' + (prevScore - player.score);
                            animationClass = 'score-down';
                        } else {
                            scoreChangeIndicator = ' ↑ ' + (player.score - prevScore);
                            animationClass = 'score-up';
                        }
                    }

                    // Position changes
                    const prevPosition = previousPositions[player.name];
                    if (prevPosition !== undefined && prevPosition !== position) {
                        if (prevPosition > position) {
                            positionChangeIndicator = ' 📈'; // Moved up
                            animationClass += ' position-up';
                        } else if (prevPosition < position) {
                            positionChangeIndicator = ' 📉'; // Moved down
                            animationClass += ' position-down';
                        }
                    } else if (prevPosition !== undefined && prevPosition === position) {
                        positionChangeIndicator = ' ➡️'; // Stayed same
                    }
                }

                html += `
                    <div class="ranking-item active ${animationClass}" data-player="${player.name}">
                        <div class="ranking-medal">${positionLabel}</div>
                        <div class="ranking-info">
                            <div class="ranking-name">${player.name}</div>
                            <div class="ranking-detail">In Progress${scoreChangeIndicator}${positionChangeIndicator}</div>
                        </div>
                        <div class="ranking-score">
                            <div>${player.score}</div>
                            <div class="ranking-darts">Darts: ${player.darts}</div>
                        </div>
                    </div>
                `;

                // Only update previous rankings if animating
                if (animate) {
                    previousRankings[player.name] = player.score;
                    previousPositions[player.name] = position;
                }
            });
        }

        rankList.innerHTML = html;
        board.classList.remove('hidden');

        // Trigger animation only if animate is true
        if (animate) {
            setTimeout(() => {
                document.querySelectorAll('.ranking-item.score-up, .ranking-item.score-down').forEach(item => {
                    item.classList.remove('score-up', 'score-down');
                });
            }, 300);
        }
    }

    /**
     * Render the global stats page
     */
    async function renderStatsPage() {
        const summaryContainer = document.getElementById('global-stats-summary');
        const widgetsContainer = document.getElementById('player-stats-widgets');
        const playerSelect = document.getElementById('stats-player-select');

        // Show loading
        summaryContainer.innerHTML = '<div class="loading-charts"><p>Loading statistics...</p></div>';
        widgetsContainer.innerHTML = '';

        // Get global stats and player names
        const [globalStats, playerNames] = await Promise.all([
            Stats.getGlobalStats(),
            Stats.getAllPlayerNames()
        ]);

        // Populate player dropdown
        playerSelect.innerHTML = '<option value="">-- Select Player --</option>' +
            playerNames.map(name => `<option value="${name}">${name}</option>`).join('');

        // Also populate comparison dropdowns
        const compareSelect1 = document.getElementById('compare-player-1');
        const compareSelect2 = document.getElementById('compare-player-2');
        if (compareSelect1 && compareSelect2) {
            const options = '<option value="">Select Player</option>' +
                playerNames.map(name => `<option value="${name}">${name}</option>`).join('');
            compareSelect1.innerHTML = options;
            compareSelect2.innerHTML = options;
        }

        // Render global stats summary with animated counters
        const counters = [];

        let html = `
            <!-- Global Stats Cards -->
            <div class="global-stats-grid">
                <div class="global-stat-card">
                    <div class="global-stat-icon">🎮</div>
                    <div class="global-stat-content">
                        <div class="global-stat-value" id="counter-games">${globalStats.totalGames}</div>
                        <div class="global-stat-label">Total Games</div>
                    </div>
                </div>
                <div class="global-stat-card">
                    <div class="global-stat-icon">👥</div>
                    <div class="global-stat-content">
                        <div class="global-stat-value" id="counter-players">${globalStats.totalPlayers}</div>
                        <div class="global-stat-label">Active Players</div>
                    </div>
                </div>
                <div class="global-stat-card">
                    <div class="global-stat-icon">🎯</div>
                    <div class="global-stat-content">
                        <div class="global-stat-value" id="counter-darts">${globalStats.totalDarts.toLocaleString()}</div>
                        <div class="global-stat-label">Darts Thrown</div>
                    </div>
                </div>
                <div class="global-stat-card">
                    <div class="global-stat-icon">📊</div>
                    <div class="global-stat-content">
                        <div class="global-stat-value" id="counter-score">${globalStats.totalScore.toLocaleString()}</div>
                        <div class="global-stat-label">Total Points</div>
                    </div>
                </div>
                <div class="global-stat-card highlight">
                    <div class="global-stat-icon">🔥</div>
                    <div class="global-stat-content">
                        <div class="global-stat-value" id="counter-100s">${globalStats.total100s}</div>
                        <div class="global-stat-label">Total 100+</div>
                    </div>
                </div>
                <div class="global-stat-card">
                    <div class="global-stat-icon">⚡</div>
                    <div class="global-stat-content">
                        <div class="global-stat-value" id="counter-140s">${globalStats.total140plus}</div>
                        <div class="global-stat-label">140+ Turns</div>
                    </div>
                </div>
            </div>

            <!-- Records Section -->
            <div class="records-section">
                <h3>🏅 All-Time Records</h3>
                <div class="records-grid">
                    <div class="record-card">
                        <div class="record-icon">📈</div>
                        <div class="record-content">
                            <div class="record-value">${globalStats.records.highestAvg || '0.00'}</div>
                            <div class="record-label">Best Avg/Turn</div>
                            <div class="record-holder">${globalStats.records.highestAvgPlayer || 'N/A'}</div>
                        </div>
                    </div>
                    <div class="record-card">
                        <div class="record-icon">🎯</div>
                        <div class="record-content">
                            <div class="record-value">${globalStats.records.most100s || 0}</div>
                            <div class="record-label">Most 100+</div>
                            <div class="record-holder">${globalStats.records.most100sPlayer || 'N/A'}</div>
                        </div>
                    </div>
                    <div class="record-card">
                        <div class="record-icon">💥</div>
                        <div class="record-content">
                            <div class="record-value">${globalStats.records.highestMaxTurn || 0}</div>
                            <div class="record-label">Highest Turn</div>
                            <div class="record-holder">${globalStats.records.highestMaxTurnPlayer || 'N/A'}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Fun Facts Section -->
            <div class="fun-facts-section">
                <h3>📊 Fun Facts</h3>
                <div class="fun-facts-grid">
                    <div class="fun-fact">
                        <span class="fun-fact-value">${globalStats.averagePerDart}</span>
                        <span class="fun-fact-label">Global Avg per Dart</span>
                    </div>
                    <div class="fun-fact">
                        <span class="fun-fact-value">${globalStats.totalDarts > 0 ? Math.round(globalStats.totalDarts / Math.max(globalStats.totalGames, 1)) : 0}</span>
                        <span class="fun-fact-label">Avg Darts per Game</span>
                    </div>
                    <div class="fun-fact">
                        <span class="fun-fact-value">${globalStats.totalGames > 0 ? (globalStats.total100s / globalStats.totalGames).toFixed(2) : 0}</span>
                        <span class="fun-fact-label">100+ per Game</span>
                    </div>
                </div>
            </div>
        `;

        summaryContainer.innerHTML = html;

        // Initial placeholder for player widgets
        widgetsContainer.innerHTML = `
            <div class="player-widgets-placeholder">
                <p>👆 Select a player above to see detailed statistics, achievements, and performance trends</p>
            </div>
        `;
    }

    /**
     * Render player-specific widgets on stats page
     */
    async function renderPlayerStatsWidgets(playerName) {
        const container = document.getElementById('player-stats-widgets');
        if (!playerName) {
            container.innerHTML = `
                <div class="player-widgets-placeholder">
                    <p>👆 Select a player above to see detailed statistics, achievements, and performance trends</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '<div class="loading-charts"><p>Loading player stats...</p></div>';

        // Get player data
        const [stats, scoreDistribution, recentPerformance] = await Promise.all([
            Stats.calculatePlayerStats(playerName),
            Stats.getScoreDistribution(playerName),
            Stats.getRecentPerformance(playerName, 20)
        ]);

        const prefs = StatsWidgets.getPreferences();

        let html = `<div class="player-widgets-header"><h2>${playerName}'s Dashboard</h2></div>`;

        // Achievements section
        if (prefs.showAchievements) {
            const achievementsHtml = StatsWidgets.renderAchievementBadges(stats, false);
            html += `
                <div class="widget-section achievements-container" data-player="${playerName}">
                    <h3>🏆 Achievements</h3>
                    ${achievementsHtml}
                </div>
            `;
        }

        // Streaks section
        if (prefs.showStreaks) {
            const streakData = StatsWidgets.calculateStreaks(recentPerformance);
            html += `
                <div class="widget-section">
                    <h3>🔥 Current Form</h3>
                    ${StatsWidgets.renderStreaks(streakData)}
                </div>
            `;
        }

        // Progress Rings section
        if (prefs.showProgressRings) {
            html += `
                <div class="widget-section">
                    <h3>🎯 Goal Progress</h3>
                    ${StatsWidgets.renderProgressRings(stats, prefs.goals)}
                </div>
            `;
        }

        // Charts row
        html += `
            <div class="charts-row">
                <div class="chart-card">
                    <h3>Win/Loss Record</h3>
                    <div class="chart-container chart-container-small">
                        <canvas id="playerWinLossChart"></canvas>
                    </div>
                </div>
                <div class="chart-card">
                    <h3>Performance Overview</h3>
                    <div class="chart-container chart-container-small">
                        <canvas id="playerRadarChart"></canvas>
                    </div>
                </div>
            </div>
            <div class="chart-card chart-card-wide">
                <h3>Performance Trend</h3>
                <div class="chart-container chart-container-line">
                    <canvas id="playerPerformanceChart"></canvas>
                </div>
            </div>
            <div class="chart-card chart-card-wide">
                <h3>Score Distribution</h3>
                <div class="chart-container chart-container-bar">
                    <canvas id="playerScoreDistChart"></canvas>
                </div>
            </div>
        `;

        // Activity Heatmap section
        if (prefs.showHeatmap) {
            const activityData = await StatsWidgets.getActivityData(playerName, 84);
            html += `
                <div class="widget-section">
                    <h3>📅 Activity (Last 12 Weeks)</h3>
                    ${StatsWidgets.renderActivityHeatmap(activityData, 12)}
                </div>
            `;
        }

        container.innerHTML = html;

        // Render charts and init interactions
        setTimeout(() => {
            Charts.createWinLossChart('playerWinLossChart', stats.gamesWon, stats.gamesPlayed - stats.gamesWon);
            Charts.createStatsRadarChart('playerRadarChart', stats);
            Charts.createPerformanceChart('playerPerformanceChart', recentPerformance);
            Charts.createScoreDistributionChart('playerScoreDistChart', scoreDistribution);
            StatsWidgets.initHeatmapInteractions();
        }, 50);
    }

    /**
     * Open comparison modal
     */
    function openComparisonModal() {
        const modal = document.getElementById('comparison-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    /**
     * Close comparison modal
     */
    function closeComparisonModal() {
        const modal = document.getElementById('comparison-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * Run player comparison
     */
    async function runPlayerComparison() {
        const player1 = document.getElementById('compare-player-1')?.value;
        const player2 = document.getElementById('compare-player-2')?.value;
        const resultContainer = document.getElementById('comparison-result');

        if (!player1 || !player2) {
            resultContainer.innerHTML = '<p class="error">Please select both players</p>';
            return;
        }

        if (player1 === player2) {
            resultContainer.innerHTML = '<p class="error">Please select different players</p>';
            return;
        }

        resultContainer.innerHTML = '<div class="loading-charts"><p>Comparing...</p></div>';

        const [stats1, stats2] = await Promise.all([
            Stats.calculatePlayerStats(player1),
            Stats.calculatePlayerStats(player2)
        ]);

        let html = StatsWidgets.renderPlayerComparison(stats1, stats2, player1, player2);
        html += `
            <div class="comparison-chart-container">
                <canvas id="comparisonRadarChart"></canvas>
            </div>
        `;

        resultContainer.innerHTML = html;

        // Render comparison radar chart
        setTimeout(() => {
            StatsWidgets.createComparisonRadarChart('comparisonRadarChart', stats1, stats2, player1, player2);
        }, 50);
    }

    // ============================================================================
    // PLAYER MANAGEMENT RENDERING
    // ============================================================================

    async function renderPlayersList() {
        const container = document.getElementById('players-list-content');
        if (!container) return;

        try {
            const playersObj = await Storage.getPlayers();
            const players = Object.values(playersObj).sort((a, b) =>
                a.name.localeCompare(b.name)
            );
            const deletedPlayers = await Storage.getDeletedPlayers();

            if (players.length === 0 && deletedPlayers.length === 0) {
                container.innerHTML = '<p class="placeholder">No players yet. Add a player or start a game!</p>';
                return;
            }

            // Fetch recent games for form dots
            const recentGames = await Storage.getCompletedGamesWithPlayerStats();
            const playerFormMap = {};
            (recentGames || []).forEach(game => {
                (game.game_players || []).forEach(gp => {
                    const name = gp.player?.name;
                    if (!name) return;
                    if (!playerFormMap[name]) playerFormMap[name] = [];
                    playerFormMap[name].push({
                        won: gp.is_winner,
                        date: game.completed_at || game.created_at
                    });
                });
            });
            // Sort by date desc and keep last 5
            Object.keys(playerFormMap).forEach(name => {
                playerFormMap[name].sort((a, b) => new Date(b.date) - new Date(a.date));
                playerFormMap[name] = playerFormMap[name].slice(0, 5);
            });

            let html = '';

            if (players.length > 0) {
                html += `<div class="player-management-list">${players.map(p => {
                    const winRate = p.total_games_played > 0
                        ? Math.round((p.total_games_won / p.total_games_played) * 100)
                        : 0;
                    const avgPerTurn = p.avg_per_turn ? parseFloat(p.avg_per_turn).toFixed(1) : '0';
                    const maxTurn = p.max_turn_score || 0;
                    const initials = p.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                    const form = playerFormMap[p.name] || [];
                    const formDots = form.length > 0
                        ? form.map(f => `<span class="form-dot ${f.won ? 'form-win' : 'form-loss'}">${f.won ? 'W' : 'L'}</span>`).join('')
                        : '';
                    const lastPlayed = form.length > 0 ? getTimeAgo(form[0].date) : null;
                    const escapedName = p.name.replace(/'/g, "\\'");
                    const joinedAgo = p.created_at ? getTimeAgo(p.created_at) : null;
                    const avatarColor = getColorForName(p.name);

                    return `
                        <div class="player-card" data-player-id="${p.id}" data-player-name="${p.name}">
                            <div class="player-card-avatar" style="background-color: ${avatarColor}">${initials}</div>
                            <div class="player-card-info">
                                <div class="player-card-name">${p.name}</div>
                                <div class="player-card-meta">${joinedAgo ? `Joined ${joinedAgo}` : 'New player'}${formDots ? ` <span class="form-dots">${formDots}</span>` : ''}</div>
                                <div class="player-card-meta">${p.total_games_played} games${lastPlayed ? ` · Last: ${lastPlayed}` : ''}</div>
                            </div>
                            <div class="player-card-right">
                                <div class="player-card-stats">
                                    <span class="player-stat-value">${avgPerTurn}</span>
                                    <span class="player-stat-label">AVG</span>
                                </div>
                                <div class="player-card-stats">
                                    <span class="player-stat-value">${winRate}%</span>
                                    <span class="player-stat-label">WINS</span>
                                </div>
                                <button class="btn-icon player-menu-btn" data-player-id="${p.id}" data-player-name="${p.name}" data-games="${p.total_games_played || 0}">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                                </button>
                            </div>
                        </div>`;
                }).join('')}</div>`;
            } else {
                html += '<p class="placeholder">No active players. Add a player or start a game!</p>';
            }

            if (deletedPlayers.length > 0) {
                html += `
                    <div class="deleted-players-section">
                        <button class="deleted-players-toggle" id="toggle-deleted-players">
                            <span class="deleted-players-toggle-icon">&#9654;</span>
                            Deleted Players (${deletedPlayers.length})
                        </button>
                        <div class="deleted-players-list" id="deleted-players-list" style="display: none;">
                            ${deletedPlayers.sort((a, b) => a.name.localeCompare(b.name)).map(p => `
                                <div class="deleted-player-card" data-player-id="${p.id}">
                                    <div class="deleted-player-info">
                                        <span class="deleted-player-name">${p.name}</span>
                                        <span class="deleted-player-meta">${p.total_games_played || 0} games</span>
                                    </div>
                                    <button class="btn btn-secondary btn-small restore-player-btn" data-player-id="${p.id}" data-player-name="${p.name}">Restore</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>`;
            }

            container.innerHTML = html;

            // Wire up toggle for deleted players
            const toggleBtn = document.getElementById('toggle-deleted-players');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    const list = document.getElementById('deleted-players-list');
                    const icon = toggleBtn.querySelector('.deleted-players-toggle-icon');
                    if (list.style.display === 'none') {
                        list.style.display = 'block';
                        icon.innerHTML = '&#9660;';
                    } else {
                        list.style.display = 'none';
                        icon.innerHTML = '&#9654;';
                    }
                });
            }
        } catch (error) {
            console.error('Error rendering players list:', error);
            container.innerHTML = '<p class="placeholder">Failed to load players</p>';
        }
    }

    // ============================================================================
    // COMPETITION RENDERING FUNCTIONS
    // ============================================================================

    /**
     * Render competitions hub page
     */
    async function renderCompetitionsHub(activeTab = 'tournaments') {
        const container = document.getElementById('competitions-content');
        if (!container) return;

        // Show/hide appropriate create buttons
        const createTournamentBtn = document.getElementById('create-tournament-btn');
        const createLeagueBtn = document.getElementById('create-league-btn');

        if (createTournamentBtn && createLeagueBtn) {
            if (activeTab === 'tournaments') {
                createTournamentBtn.style.display = 'inline-block';
                createLeagueBtn.style.display = 'none';
            } else {
                createTournamentBtn.style.display = 'none';
                createLeagueBtn.style.display = 'inline-block';
            }
        }

        container.innerHTML = '<p class="placeholder">Loading competitions...</p>';

        try {
            if (activeTab === 'tournaments') {
                const tournaments = await Storage.getTournaments();
                renderTournamentsList(container, tournaments);
            } else {
                const leagues = await Storage.getLeagues();
                renderLeaguesList(container, leagues);
            }
        } catch (error) {
            console.error('Error rendering competitions:', error);
            container.innerHTML = '<p class="placeholder">Error loading competitions</p>';
        }
    }

    /**
     * Render tournaments list
     */
    function renderTournamentsList(container, tournaments) {
        if (tournaments.length === 0) {
            container.innerHTML = '<p class="placeholder">No tournaments yet. Create your first tournament!</p>';
            return;
        }

        const html = tournaments.map(t => {
            const statusColors = {
                'registration': '#ff9800',
                'in_progress': '#4caf50',
                'completed': '#9e9e9e'
            };
            const statusLabels = {
                'registration': 'Registration Open',
                'in_progress': 'In Progress',
                'completed': 'Completed'
            };

            const participantCount = t.participants?.length || 0;
            const completedMatches = t.matches?.filter(m => m.status === 'completed').length || 0;
            const totalMatches = t.matches?.length || 0;

            return `
                <div class="competition-card" onclick="Router.navigate('tournament', {tournamentId: '${t.id}'})">
                    <div class="competition-card-header">
                        <div class="competition-card-title">${t.name}</div>
                        <span class="competition-status-badge" style="background: ${statusColors[t.status]};">
                            ${statusLabels[t.status]}
                        </span>
                    </div>
                    <div class="competition-card-info">
                        <span>${t.format === 'single_elimination' ? 'Single Elim.' : 'Double Elim.'}</span>
                        <span>${t.game_type} Points</span>
                        <span>${participantCount}/${t.max_players} Players</span>
                    </div>
                    <div class="competition-card-footer">
                        ${t.status === 'completed'
                            ? `<span>Winner: ${t.winner_name || 'TBD'}</span>`
                            : `<span>Matches: ${completedMatches}/${totalMatches}</span>`
                        }
                        <span style="display: flex; align-items: center; gap: 8px;">
                            ${new Date(t.created_at).toLocaleDateString()}
                            ${completedMatches === 0 ? `<button class="btn btn-danger btn-small delete-tournament-btn" data-tournament-id="${t.id}" data-tournament-name="${t.name}" onclick="event.stopPropagation(); App.confirmDeleteTournament(this.dataset.tournamentId, this.dataset.tournamentName)"><svg class="icon-bin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M5 6v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>` : ''}
                        </span>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    /**
     * Render leagues list
     */
    function renderLeaguesList(container, leagues) {
        if (leagues.length === 0) {
            container.innerHTML = '<p class="placeholder">No leagues yet. Create your first league!</p>';
            return;
        }

        const html = leagues.map(l => {
            const statusColors = {
                'registration': '#ff9800',
                'in_progress': '#4caf50',
                'completed': '#9e9e9e'
            };
            const statusLabels = {
                'registration': 'Registration Open',
                'in_progress': 'In Progress',
                'completed': 'Completed'
            };

            const participantCount = l.participants?.length || 0;
            const completedMatches = l.matches?.filter(m => m.status === 'completed').length || 0;
            const totalMatches = l.matches?.length || 0;
            const progress = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0;

            return `
                <div class="competition-card" onclick="Router.navigate('league', {leagueId: '${l.id}'})">
                    <div class="competition-card-header">
                        <div class="competition-card-title">${l.name}</div>
                        <span class="competition-status-badge" style="background: ${statusColors[l.status]};">
                            ${statusLabels[l.status]}
                        </span>
                    </div>
                    <div class="competition-card-info">
                        <span>Round Robin</span>
                        <span>${l.game_type} Points</span>
                        <span>${participantCount} Players</span>
                    </div>
                    ${l.status === 'in_progress' ? `
                        <div class="competition-progress">
                            <div class="competition-progress-bar" style="width: ${progress}%;"></div>
                        </div>
                    ` : ''}
                    <div class="competition-card-footer">
                        ${l.status === 'completed'
                            ? `<span>Winner: ${l.winner_name || 'TBD'}</span>`
                            : `<span>Progress: ${completedMatches}/${totalMatches} matches</span>`
                        }
                        <span style="display: flex; align-items: center; gap: 8px;">
                            ${new Date(l.created_at).toLocaleDateString()}
                            ${completedMatches === 0 ? `<button class="btn btn-danger btn-small delete-league-btn" data-league-id="${l.id}" data-league-name="${l.name}" onclick="event.stopPropagation(); App.confirmDeleteLeague(this.dataset.leagueId, this.dataset.leagueName)"><svg class="icon-bin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M5 6v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>` : ''}
                        </span>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    /**
     * Render tournament detail view with bracket
     */
    async function renderTournamentDetail(tournament) {
        const container = document.getElementById('tournament-detail-content');
        if (!container || !tournament) return;

        const totalRounds = Math.log2(tournament.max_players);
        const bracket = Tournament.getBracket(tournament);

        let html = `
            <div class="tournament-header">
                <div class="tournament-info">
                    <h2>${tournament.name}</h2>
                    <div class="tournament-meta">
                        <span>${tournament.format === 'single_elimination' ? 'Single Elimination' : 'Double Elimination'}</span>
                        <span>${tournament.game_type} Points</span>
                        <span>${tournament.participants?.length || 0}/${tournament.max_players} Players</span>
                    </div>
                </div>
                ${tournament.status === 'in_progress' && tournament.matches.every(m => m.status === 'completed') ? `
                    <div class="tournament-actions">
                        <button class="btn btn-accent btn-small" onclick="App.finalizeTournament('${tournament.id}')">
                            Complete Tournament
                        </button>
                    </div>
                ` : ''}
                ${tournament.status === 'completed' ? `
                    <div class="tournament-winner-celebration">
                        <div class="confetti-container">
                            <div class="confetti"></div>
                            <div class="confetti"></div>
                            <div class="confetti"></div>
                            <div class="confetti"></div>
                            <div class="confetti"></div>
                            <div class="confetti"></div>
                            <div class="confetti"></div>
                            <div class="confetti"></div>
                            <div class="confetti"></div>
                            <div class="confetti"></div>
                            <div class="confetti"></div>
                            <div class="confetti"></div>
                        </div>
                        <div class="trophy-container">
                            <div class="trophy-glow"></div>
                            <div class="trophy-icon">🏆</div>
                        </div>
                        <div class="winner-crown">👑</div>
                        <div class="winner-label">TOURNAMENT CHAMPION</div>
                        <div class="winner-name-large">${tournament.winner_name}</div>
                        <div class="winner-stars">
                            <span class="star">⭐</span>
                            <span class="star">⭐</span>
                            <span class="star">⭐</span>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        // Registration phase - show player management
        if (tournament.status === 'registration') {
            html += renderTournamentRegistration(tournament);
        } else {
            // In progress or completed - show bracket with progress indicator
            // html += renderTournamentProgress(tournament); // This is redundant with the summary in the bracket
            html += renderTournamentBracket(tournament, bracket, totalRounds);
        }

        // Ready matches section
        if (tournament.status === 'in_progress') {
            const readyMatches = Tournament.getReadyMatches(tournament);
            const inProgressMatches = Tournament.getInProgressMatches(tournament);

            if (inProgressMatches.length > 0) {
                html += `
                    <div class="matches-section">
                        <h3>In Progress</h3>
                        <div class="matches-list">
                            ${inProgressMatches.map(m => `
                                <div class="match-card in-progress" onclick="Router.navigate('game', {gameId: '${m.game_id}'})">
                                    <div class="match-players">
                                        <span>${m.player1_name}</span>
                                        <span class="vs">vs</span>
                                        <span>${m.player2_name}</span>
                                    </div>
                                    <div class="match-round">${Tournament.getRoundName(m.round, totalRounds, tournament.format)}</div>
                                    <button class="btn btn-small btn-primary">Watch</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            if (readyMatches.length > 0) {
                html += `
                    <div class="matches-section">
                        <h3>Ready to Play</h3>
                        <div class="matches-list">
                            ${readyMatches.map(m => `
                                <div class="match-card ready" data-match-id="${m.id}">
                                    <div class="match-players">
                                        <span>${m.player1_name}</span>
                                        <span class="vs">vs</span>
                                        <span>${m.player2_name}</span>
                                    </div>
                                    <div class="match-round">${Tournament.getRoundName(m.round, totalRounds, tournament.format)}</div>
                                    <button class="btn btn-small btn-success start-match-btn">Start Match</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            // Show repair button if:
            // 1. There are completed matches but no ready/in-progress matches (winners not advanced)
            // 2. OR there are matches with game_ids that aren't marked as completed (games finished but match not updated)
            const completedMatches = tournament.matches.filter(m => m.status === 'completed').length;
            const pendingMatches = tournament.matches.filter(m => m.status === 'pending').length;
            const matchesWithGamesNotCompleted = tournament.matches.filter(m => m.game_id && m.status !== 'completed').length;
            const needsRepair = (completedMatches > 0 && readyMatches.length === 0 && inProgressMatches.length === 0 && pendingMatches > 0)
                || matchesWithGamesNotCompleted > 0;
            if (needsRepair) {
                html += `
                    <div class="repair-section" style="margin-top: var(--spacing-xl); padding: var(--spacing-lg); background: #fff3cd; border-radius: var(--radius-lg); text-align: center;">
                        <p style="margin-bottom: var(--spacing-md); color: #856404;">
                            <strong>⚠️ Bracket Issue Detected</strong><br>
                            Some match results may not have advanced winners to the next round.
                        </p>
                        <button class="btn btn-primary" id="repair-bracket-btn">
                            🔧 Repair Bracket
                        </button>
                    </div>
                `;
            }
        }

        container.innerHTML = html;

        // Setup registration UI if in registration phase
        if (tournament.status === 'registration') {
            setupTournamentRegistrationUI(tournament);
        }
    }

    /**
     * Render tournament progress indicator
     */
    function renderTournamentProgress(tournament) {
        const totalMatches = tournament.matches?.length || 0;
        const completedMatches = tournament.matches?.filter(m => m.status === 'completed').length || 0;
        const percentage = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0;

        return `
            <div class="tournament-progress">
                <div class="tournament-progress-header">
                    <span class="tournament-progress-text">Tournament Progress: ${completedMatches}/${totalMatches} matches</span>
                    <span class="tournament-progress-percentage">${percentage}%</span>
                </div>
                <div class="tournament-progress-bar">
                    <div class="tournament-progress-fill" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }

    /**
     * Render tournament registration view with enhanced UX
     */
    function renderTournamentRegistration(tournament) {
        // Get currently registered names for filtering
        const registeredNames = (tournament.participants || []).map(p => p.name.toLowerCase());
        const isFull = (tournament.participants?.length || 0) >= tournament.max_players;

        let html = `
            <div class="registration-section">
                <h3>Player Registration (${tournament.participants?.length || 0}/${tournament.max_players})</h3>

                ${!isFull ? `
                <div class="player-input-row">
                    <div style="position: relative; flex: 1;">
                        <input type="text" id="new-participant-name" placeholder="Type player name..." class="form-input" autocomplete="off">
                        <div id="participant-suggestions" class="player-suggestions" style="display: none;"></div>
                    </div>
                    <button class="btn btn-primary" id="add-participant-btn">Add Player</button>
                </div>

                <!-- Quick Add Chips for existing players -->
                <div class="quick-add-section" id="quick-add-section">
                    <div class="quick-add-header">Quick add existing players:</div>
                    <div class="quick-add-chips" id="quick-add-chips">
                        <!-- Populated dynamically -->
                        <span class="loading-chips">Loading players...</span>
                    </div>
                </div>
                ` : `
                <div class="registration-full-notice" style="padding: var(--spacing-lg); background: rgba(45, 227, 109, 0.1); border-radius: var(--radius-md); text-align: center; color: var(--color-success); font-weight: 600;">
                    Tournament is full! Ready to start.
                </div>
                `}

                <div class="participants-list">
                    ${(tournament.participants || []).map((p, i) => `
                        <div class="participant-item" style="animation-delay: ${i * 0.05}s">
                            <span class="participant-position">#${i + 1}</span>
                            <span class="participant-name">${p.name}</span>
                            <button class="btn btn-small btn-danger remove-participant-btn" data-name="${p.name}">Remove</button>
                        </div>
                    `).join('')}
                </div>

                ${tournament.participants?.length >= 2 ? `
                    <div class="seeding-options">
                        <div style="flex: 1;">
                            <label>Seeding Options</label>
                            <div style="display: flex; gap: var(--spacing-sm);">
                                <button class="seeding-btn active" id="shuffle-participants-btn">
                                    <span>🎲</span> Shuffle Random
                                </button>
                                <button class="seeding-btn" id="seed-by-winrate-btn">
                                    <span>📊</span> Seed by Win Rate
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="registration-actions" style="margin-top: var(--spacing-xl);">
                        <button class="btn btn-success btn-large" id="start-tournament-btn" style="width: 100%;">
                            <span style="font-size: 20px; margin-right: 8px;">🚀</span>
                            Start Tournament
                        </button>
                    </div>
                ` : `
                    <div class="registration-hint" style="text-align: center; color: var(--color-text-light); padding: var(--spacing-lg); font-size: var(--font-size-sm);">
                        Add at least 2 players to start the tournament
                    </div>
                `}
            </div>
        `;
        return html;
    }

    /**
     * Setup tournament registration autocomplete and quick-add chips
     */
    async function setupTournamentRegistrationUI(tournament) {
        const input = document.getElementById('new-participant-name');
        const suggestionsEl = document.getElementById('participant-suggestions');
        const quickAddSection = document.getElementById('quick-add-section');
        const quickAddChips = document.getElementById('quick-add-chips');
        const seedByWinrateBtn = document.getElementById('seed-by-winrate-btn');
        const shuffleBtn = document.getElementById('shuffle-participants-btn');

        if (!input || !suggestionsEl) return;

        // Get existing players
        let existingPlayers = [];
        try {
            const players = await Storage.getPlayers();
            existingPlayers = Object.keys(players) || [];
        } catch (error) {
            console.warn('Could not load players:', error);
        }

        // Get registered names
        const registeredNames = (tournament.participants || []).map(p => p.name.toLowerCase());

        // Setup autocomplete
        input.addEventListener('input', (e) => {
            const value = e.target.value.toLowerCase().trim();

            if (value.length === 0) {
                suggestionsEl.style.display = 'none';
                return;
            }

            const matches = existingPlayers.filter(player =>
                player.toLowerCase().includes(value) &&
                !registeredNames.includes(player.toLowerCase())
            ).slice(0, 5);

            if (matches.length === 0) {
                suggestionsEl.style.display = 'none';
                return;
            }

            suggestionsEl.innerHTML = matches.map(player => `
                <div class="suggestion-item" data-player="${player}">${player}</div>
            `).join('');
            suggestionsEl.style.display = 'block';

            suggestionsEl.querySelectorAll('.suggestion-item').forEach(item => {
                item.addEventListener('click', () => {
                    input.value = item.getAttribute('data-player');
                    suggestionsEl.style.display = 'none';
                    // Trigger add
                    document.getElementById('add-participant-btn')?.click();
                });
            });
        });

        input.addEventListener('blur', () => {
            setTimeout(() => { suggestionsEl.style.display = 'none'; }, 200);
        });

        // Allow Enter key to add
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('add-participant-btn')?.click();
            }
        });

        // Setup quick-add chips
        if (quickAddChips) {
            const availablePlayers = existingPlayers.filter(p =>
                !registeredNames.includes(p.toLowerCase())
            ).slice(0, 10);

            if (availablePlayers.length === 0) {
                quickAddSection.style.display = 'none';
            } else {
                quickAddChips.innerHTML = availablePlayers.map(player => `
                    <button class="quick-add-chip" data-player="${player}">${player}</button>
                `).join('');

                quickAddChips.querySelectorAll('.quick-add-chip').forEach(chip => {
                    chip.addEventListener('click', async () => {
                        const playerName = chip.getAttribute('data-player');
                        chip.classList.add('added');
                        chip.disabled = true;

                        // Trigger add via the existing add participant logic
                        const nameInput = document.getElementById('new-participant-name');
                        if (nameInput) {
                            nameInput.value = playerName;
                            document.getElementById('add-participant-btn')?.click();
                        }
                    });
                });
            }
        }

        // Setup seeding buttons
        if (seedByWinrateBtn && shuffleBtn) {
            seedByWinrateBtn.addEventListener('click', async () => {
                shuffleBtn.classList.remove('active');
                seedByWinrateBtn.classList.add('active');

                // Get player stats and sort by win rate
                try {
                    const players = await Storage.getPlayers();
                    tournament.participants.sort((a, b) => {
                        const statsA = players[a.name] || { winRate: 0 };
                        const statsB = players[b.name] || { winRate: 0 };
                        return (statsB.winRate || 0) - (statsA.winRate || 0);
                    });

                    // Re-assign bracket positions
                    tournament.participants.forEach((p, i) => {
                        p.bracket_position = i + 1;
                    });

                    await UI.renderTournamentDetail(tournament);
                    await setupTournamentRegistrationUI(tournament);
                    showToast('Seeded by win rate!', 'success');
                } catch (e) {
                    console.error('Error seeding:', e);
                    showToast('Failed to seed players', 'error');
                }
            });
        }
    }

    /**
     * Render tournament bracket visualization with CSS connectors
     */
    function renderTournamentBracket(tournament, bracket, totalRounds) {
        let html = '<div class="bracket-wrapper-outer">';

        // Tournament Summary Stats
        const completedMatches = tournament.matches.filter(m => m.status === 'completed').length;
        const totalMatches = tournament.matches.length;
        const progress = Math.round((completedMatches / totalMatches) * 100) || 0;

        html += `
            <div class="tournament-progress-summary">
                <div class="summary-stat">
                    <span class="stat-label">Progress</span>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: ${progress}%"></div>
                    </div>
                    <span class="stat-value">${progress}%</span>
                </div>
                <div class="summary-stat">
                    <span class="stat-label">Matches</span>
                    <span class="stat-value">${completedMatches} / ${totalMatches}</span>
                </div>
                <div class="summary-stat">
                    <span class="stat-label">Players</span>
                    <span class="stat-value">${tournament.participants.filter(p => !p.eliminated).length} Active / ${tournament.participants.length}</span>
                </div>
            </div>
        `;

        html += '<div class="bracket-container-horizontal">';

        // Winners bracket
        html += '<div class="bracket-section winners-bracket">';
        html += '<div class="section-header-row"><h4>Winners Bracket</h4></div>';
        html += '<div class="bracket-rounds-horizontal">';

        for (let round = 1; round <= totalRounds; round++) {
            const roundMatches = bracket.winners[round] || [];
            const roundName = Tournament.getRoundName(round, totalRounds, tournament.format);
            const isLastRound = round === totalRounds;

            html += `
                <div class="bracket-round-column" data-round="${round}">
                    <div class="round-header-pill">${roundName}</div>
                    <div class="round-matches-container">
                        ${renderBracketRoundMatches(roundMatches, isLastRound)}
                    </div>
                </div>
            `;
        }

        html += '</div></div>';

        // Losers bracket (if double elimination)
        if (tournament.format === 'double_elimination' && Object.keys(bracket.losers).length > 0) {
            html += '<div class="bracket-section losers-bracket">';
            html += '<div class="section-header-row"><h4>Losers Bracket</h4></div>';
            html += '<div class="bracket-rounds-horizontal">';

            const loserRounds = Object.keys(bracket.losers).sort((a, b) => a - b);
            const lastLoserRound = loserRounds[loserRounds.length - 1];

            loserRounds.forEach(round => {
                const roundMatches = bracket.losers[round] || [];
                const isLastRound = round === lastLoserRound;
                html += `
                    <div class="bracket-round-column" data-round="${round}">
                        <div class="round-header-pill secondary">LB Round ${round}</div>
                        <div class="round-matches-container">
                            ${renderBracketRoundMatches(roundMatches, isLastRound)}
                        </div>
                    </div>
                `;
            });

            html += '</div></div>';

            // Grand finals
            if (bracket.grandFinals) {
                html += '<div class="bracket-section grand-finals">';
                html += '<div class="section-header-row"><h4>Grand Finals</h4></div>';
                html += `
                    <div class="bracket-match-wrapper-centered">
                        <div class="round-header-pill gold">Championship</div>
                        ${renderBracketMatch(bracket.grandFinals)}
                    </div>
                `;
                html += '</div>';
            }
        }

        html += '</div></div>';
        return html;
    }

    /**
     * Render matches for a bracket round with pair grouping for connectors
     */
    function renderBracketRoundMatches(matches, isLastRound) {
        if (matches.length === 0) return '';

        // If single match (finals), no pairing needed
        if (matches.length === 1) {
            return `<div class="bracket-match-wrapper ${matches[0].status}">${renderBracketMatch(matches[0])}</div>`;
        }

        // Group matches into pairs for connector visualization
        let html = '';
        for (let i = 0; i < matches.length; i += 2) {
            const match1 = matches[i];
            const match2 = matches[i + 1];

            // Determine pair status (for connector color)
            const pairStatus = getPairStatus(match1, match2);

            html += `<div class="match-pair ${pairStatus}" ${isLastRound ? '' : ''}>`;
            html += `<div class="bracket-match-wrapper ${match1.status}">${renderBracketMatch(match1)}</div>`;
            if (match2) {
                html += `<div class="bracket-match-wrapper ${match2.status}">${renderBracketMatch(match2)}</div>`;
            }
            html += '</div>';
        }

        return html;
    }

    /**
     * Determine the status class for a pair of matches
     */
    function getPairStatus(match1, match2) {
        const m1Status = match1?.status || 'pending';
        const m2Status = match2?.status || 'pending';

        if (m1Status === 'completed' && m2Status === 'completed') return 'completed';
        if (m1Status === 'in_progress' || m2Status === 'in_progress') return 'in-progress';
        if (m1Status === 'ready' || m2Status === 'ready') return 'ready';
        return 'pending';
    }

    /**
     * Render a single bracket match
     */
    /**
     * Get player initials for avatar
     */
    function getPlayerInitials(name) {
        if (!name || name === 'TBD') return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }

    /**
     * Render bracket match with enhanced visuals
     */
    function renderBracketMatch(match) {
        const statusClass = match.status === 'completed' ? 'completed' :
                           match.status === 'ready' ? 'ready' :
                           match.status === 'in_progress' ? 'in-progress' : 'pending';

        // Add click handler for ready matches
        const clickHandler = match.status === 'ready' ? `onclick="App.loadTournament && document.querySelector('[data-match-id=\\'${match.id}\\'] .start-match-btn')?.click()"` : '';

        const p1Initials = getPlayerInitials(match.player1_name);
        const p2Initials = getPlayerInitials(match.player2_name);

        return `
            <div class="bracket-match ${statusClass}" data-match-id="${match.id}" ${clickHandler}>
                <div class="match-slot ${match.winner_id === match.player1_id ? 'winner' : ''} ${!match.player1_id ? 'tbd' : ''}">
                    <div class="player-info">
                        <div class="player-avatar">${p1Initials}</div>
                        <span class="player-name">${match.player1_name || 'TBD'}</span>
                    </div>
                    ${match.status === 'completed' && match.winner_id === match.player1_id ? '<span class="winner-mark">✓</span>' : ''}
                </div>
                <div class="match-slot ${match.winner_id === match.player2_id ? 'winner' : ''} ${!match.player2_id ? 'tbd' : ''}">
                    <div class="player-info">
                        <div class="player-avatar">${p2Initials}</div>
                        <span class="player-name">${match.player2_name || 'TBD'}</span>
                    </div>
                    ${match.status === 'completed' && match.winner_id === match.player2_id ? '<span class="winner-mark">✓</span>' : ''}
                </div>
                ${match.status === 'ready' ? '<div class="match-status-badge">READY</div>' : ''}
                ${match.status === 'in_progress' ? '<div class="match-status-badge in-progress">LIVE</div>' : ''}
            </div>
        `;
    }

    /**
     * Render league detail view
     */
    async function renderLeagueDetail(league) {
        const container = document.getElementById('league-detail-content');
        if (!container || !league) return;

        let html = `
            <div class="league-header">
                <div class="league-info">
                    <h2>${league.name}</h2>
                    <div class="league-meta">
                        <span>Round Robin</span>
                        <span>${league.game_type} Points</span>
                        <span>${league.participants?.length || 0} Players</span>
                        <span>W:${league.points_for_win} D:${league.points_for_draw} L:${league.points_for_loss}</span>
                    </div>
                </div>
                ${league.status === 'completed' ? `
                    <div class="league-winner">
                        <span class="winner-label">Champion</span>
                        <span class="winner-name">${league.winner_name}</span>
                    </div>
                ` : ''}
            </div>
        `;

        // Registration phase
        if (league.status === 'registration') {
            html += renderLeagueRegistration(league);
        } else {
            // Show standings table
            html += renderLeagueStandings(league);

            // Show fixtures
            html += renderLeagueFixtures(league);
        }

        container.innerHTML = html;
    }

    /**
     * Render league registration view
     */
    function renderLeagueRegistration(league) {
        let html = `
            <div class="registration-section">
                <h3>Player Registration (${league.participants?.length || 0} players)</h3>
                <div class="player-input-row">
                    <input type="text" id="new-participant-name" placeholder="Enter player name" class="form-input">
                    <button class="btn btn-primary" id="add-participant-btn">Add Player</button>
                </div>
                <div class="participants-list">
                    ${(league.participants || []).map((p, i) => `
                        <div class="participant-item">
                            <span class="participant-position">#${i + 1}</span>
                            <span class="participant-name">${p.name}</span>
                            <button class="btn btn-small btn-danger remove-participant-btn" data-name="${p.name}">Remove</button>
                        </div>
                    `).join('')}
                </div>
                ${league.participants?.length >= 2 ? `
                    <div class="registration-actions">
                        <button class="btn btn-success btn-large" id="start-league-btn">Generate Fixtures & Start</button>
                    </div>
                ` : ''}
            </div>
        `;
        return html;
    }

    /**
     * Render league standings table
     */
    function renderLeagueStandings(league) {
        const standings = League.getStandings(league);

        let html = `
            <div class="standings-section">
                <h3>Standings</h3>
                <div class="standings-table">
                    <div class="standings-header">
                        <span class="col-rank">#</span>
                        <span class="col-name">Player</span>
                        <span class="col-p">P</span>
                        <span class="col-w">W</span>
                        <span class="col-d">D</span>
                        <span class="col-l">L</span>
                        <span class="col-diff">+/-</span>
                        <span class="col-pts">PTS</span>
                    </div>
                    ${standings.map((p, i) => `
                        <div class="standings-row ${i === 0 ? 'leader' : ''}">
                            <span class="col-rank">${p.rank}</span>
                            <span class="col-name">${p.name}</span>
                            <span class="col-p">${p.played}</span>
                            <span class="col-w">${p.wins}</span>
                            <span class="col-d">${p.draws}</span>
                            <span class="col-l">${p.losses}</span>
                            <span class="col-diff">${p.legDiff >= 0 ? '+' : ''}${p.legDiff}</span>
                            <span class="col-pts">${p.points}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        return html;
    }

    /**
     * Render league fixtures
     */
    function renderLeagueFixtures(league) {
        const fixturesByRound = League.getFixturesByRound(league);
        const pendingMatches = League.getPendingMatches(league);
        const inProgressMatches = League.getInProgressMatches(league);

        let html = '';

        // In progress matches
        if (inProgressMatches.length > 0) {
            html += `
                <div class="fixtures-section">
                    <h3>In Progress</h3>
                    <div class="fixtures-list">
                        ${inProgressMatches.map(m => `
                            <div class="fixture-card in-progress" onclick="Router.navigate('game', {gameId: '${m.game_id}'})">
                                <span class="fixture-player">${m.player1_name}</span>
                                <span class="fixture-vs">vs</span>
                                <span class="fixture-player">${m.player2_name}</span>
                                <button class="btn btn-small btn-primary">Watch</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Pending matches (ready to play)
        if (pendingMatches.length > 0 && league.status === 'in_progress') {
            html += `
                <div class="fixtures-section">
                    <h3>Ready to Play</h3>
                    <div class="fixtures-list">
                        ${pendingMatches.slice(0, 10).map(m => `
                            <div class="fixture-card pending" data-match-id="${m.id}">
                                <span class="fixture-player">${m.player1_name}</span>
                                <span class="fixture-vs">vs</span>
                                <span class="fixture-player">${m.player2_name}</span>
                                <button class="btn btn-small btn-success start-match-btn">Play</button>
                            </div>
                        `).join('')}
                        ${pendingMatches.length > 10 ? `<p class="more-fixtures">+ ${pendingMatches.length - 10} more fixtures</p>` : ''}
                    </div>
                </div>
            `;
        }

        // All fixtures by round
        html += `
            <div class="fixtures-section">
                <h3>All Fixtures</h3>
                ${Object.keys(fixturesByRound).map(round => `
                    <div class="fixture-round">
                        <div class="fixture-round-header">Round ${round}</div>
                        <div class="fixtures-list">
                            ${fixturesByRound[round].map(m => {
                                const statusClass = m.status === 'completed' ? 'completed' :
                                                   m.status === 'in_progress' ? 'in-progress' : 'pending';
                                return `
                                    <div class="fixture-card ${statusClass}" ${m.game_id ? `onclick="Router.navigate('game-detail', {gameId: '${m.game_id}'})"` : ''}>
                                        <span class="fixture-player ${m.winner_id === m.player1_id ? 'winner' : ''}">${m.player1_name}</span>
                                        <span class="fixture-result">
                                            ${m.status === 'completed'
                                                ? (m.is_draw ? 'Draw' : (m.winner_name || ''))
                                                : 'vs'
                                            }
                                        </span>
                                        <span class="fixture-player ${m.winner_id === m.player2_id ? 'winner' : ''}">${m.player2_name}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        return html;
    }

    /**
     * Render new tournament form
     */
    async function renderNewTournamentForm() {
        // Initialize player count handling
        const bracketSizeSelect = document.getElementById('tournament-size');
        const playerCountInput = document.getElementById('tournament-player-count');
        const playerNamesContainer = document.getElementById('tournament-player-names');
        const playersGroup = document.getElementById('tournament-players-group');

        if (!playerCountInput || !playerNamesContainer || !bracketSizeSelect) return;

        // Get existing players for autocomplete
        let existingPlayers = [];
        try {
            const players = await Storage.getPlayers();
            existingPlayers = Object.keys(players) || [];
        } catch (error) {
            console.warn('Could not load players for autocomplete:', error);
        }

        // Update Add Now options based on bracket size
        function updateAddNowOptions() {
            const size = parseInt(bracketSizeSelect.value);
            
            // Standard options up to bracket size
            const options = [
                { val: 0, label: 'Later' },
                { val: 2, label: '2 Players' },
                { val: 4, label: '4 Players' },
                { val: 8, label: '8 Players' },
                { val: 16, label: '16 Players' },
                { val: 32, label: '32 Players' }
            ];

            playerCountInput.innerHTML = options
                .filter(opt => opt.val <= size)
                .map(opt => `<option value="${opt.val}" ${opt.val == size ? 'selected' : ''}>${opt.label}</option>`)
                .join('');
            
            // Set current value to match bracket size by default
            playerCountInput.value = size;

            updatePlayerInputs();
        }

        async function updatePlayerInputs() {
            const count = parseInt(playerCountInput.value);

            // Show/hide player names group
            if (playersGroup) {
                playersGroup.style.display = count > 0 ? 'block' : 'none';
            }

            // Save existing values
            const existingValues = [];
            playerNamesContainer.querySelectorAll('.player-name-input').forEach(input => {
                existingValues.push(input.value);
            });

            // Regenerate inputs
            playerNamesContainer.innerHTML = '';
            for (let i = 0; i < count; i++) {
                const wrapper = document.createElement('div');
                wrapper.style.position = 'relative';

                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = `Player ${i + 1}`;
                input.className = 'player-name-input form-input';
                input.setAttribute('autocomplete', 'off');

                if (i < existingValues.length) {
                    input.value = existingValues[i];
                }

                wrapper.appendChild(input);
                playerNamesContainer.appendChild(wrapper);

                // Setup autocomplete
                setupPlayerAutocomplete(input, existingPlayers, playerNamesContainer);
            }
        }

        playerCountInput.addEventListener('change', updatePlayerInputs);
        bracketSizeSelect.addEventListener('change', updateAddNowOptions);
        
        // Initialize
        updateAddNowOptions();
        await updatePlayerInputs();
    }

    /**
     * Render new league form
     */
    async function renderNewLeagueForm() {
        // Initialize player inputs
        const addPlayerBtn = document.getElementById('add-league-player-btn');
        const playerNamesContainer = document.getElementById('league-player-names');

        if (!addPlayerBtn || !playerNamesContainer) return;

        // Get existing players for autocomplete
        let existingPlayers = [];
        try {
            const players = await Storage.getPlayers();
            existingPlayers = Object.keys(players) || [];
        } catch (error) {
            console.warn('Could not load players for autocomplete:', error);
        }

        // Setup autocomplete for existing inputs
        const setupExistingInputs = () => {
            playerNamesContainer.querySelectorAll('.player-name-input').forEach(input => {
                // Wrap in relative div if not already wrapped
                if (!input.parentElement.classList.contains('league-player-input-row')) {
                    const wrapper = document.createElement('div');
                    wrapper.style.position = 'relative';
                    input.parentElement.insertBefore(wrapper, input);
                    wrapper.appendChild(input);
                }
                input.setAttribute('autocomplete', 'off');
                setupPlayerAutocomplete(input, existingPlayers, playerNamesContainer);
            });
        };

        // Setup autocomplete for initial inputs
        setupExistingInputs();

        addPlayerBtn.addEventListener('click', () => {
            const count = playerNamesContainer.querySelectorAll('.player-name-input').length;
            const row = document.createElement('div');
            row.className = 'league-player-input-row';

            const inputWrapper = document.createElement('div');
            inputWrapper.style.position = 'relative';
            inputWrapper.style.flex = '1';

            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = `Player ${count + 1}`;
            input.className = 'player-name-input form-input';
            input.setAttribute('autocomplete', 'off');

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn btn-small btn-danger remove-player-btn';
            removeBtn.textContent = 'Remove';
            removeBtn.addEventListener('click', () => row.remove());

            inputWrapper.appendChild(input);
            row.appendChild(inputWrapper);
            row.appendChild(removeBtn);
            playerNamesContainer.appendChild(row);

            // Setup autocomplete for new input
            setupPlayerAutocomplete(input, existingPlayers, playerNamesContainer);
        });
    }

    // Public API
    return {
        showToast,
        showLoader,
        hideLoader,
        showModal,
        hideModal,
        showPage,
        renderRecentGames,
        renderStatsWidget,
        renderQuickStats,
        renderNewGameForm,
        renderScoreboard,
        renderDartInputs,
        renderCurrentPlayer,
        renderTurnHistory,
        renderGameHistory,
        renderGameDetail,
        renderLeaderboard,
        renderPlayerProfile,
        updateActiveGameUI,
        flashScoreCard,
        bustShakeAnimation,
        renderSpectatorGame,
        updateWinnersBoard,
        showLiveIndicator,
        getPaginationState: () => paginationState,
        renderStatsPage,
        renderPlayerStatsWidgets,
        openComparisonModal,
        closeComparisonModal,
        runPlayerComparison,
        // Player management
        renderPlayersList,
        // Competition functions
        renderCompetitionsHub,
        renderTournamentsList,
        renderLeaguesList,
        renderTournamentDetail,
        renderLeagueDetail,
        renderNewTournamentForm,
        renderNewLeagueForm,
        renderLeagueStandings,
        renderLeagueFixtures,
        setupTournamentRegistrationUI
    };
})();

// Ensure it's globally available immediately
window.UI = UI;
