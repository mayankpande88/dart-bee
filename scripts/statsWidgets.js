/**
 * Stats Widgets Module
 * Provides advanced, customizable stat visualizations
 * Including achievements, progress rings, animated counters, and heatmaps
 */

const StatsWidgets = (() => {
    // Achievement definitions
    const ACHIEVEMENTS = {
        // Games milestones
        firstGame: { id: 'firstGame', name: 'First Steps', icon: '🎯', description: 'Play your first game', check: (s) => s.gamesPlayed >= 1 },
        tenGames: { id: 'tenGames', name: 'Getting Started', icon: '🎮', description: 'Play 10 games', check: (s) => s.gamesPlayed >= 10 },
        fiftyGames: { id: 'fiftyGames', name: 'Regular Player', icon: '🏃', description: 'Play 50 games', check: (s) => s.gamesPlayed >= 50 },
        hundredGames: { id: 'hundredGames', name: 'Centurion', icon: '💯', description: 'Play 100 games', check: (s) => s.gamesPlayed >= 100 },

        // Win milestones
        firstWin: { id: 'firstWin', name: 'Victory!', icon: '🏆', description: 'Win your first game', check: (s) => s.gamesWon >= 1 },
        tenWins: { id: 'tenWins', name: 'Winner', icon: '⭐', description: 'Win 10 games', check: (s) => s.gamesWon >= 10 },
        fiftyWins: { id: 'fiftyWins', name: 'Champion', icon: '👑', description: 'Win 50 games', check: (s) => s.gamesWon >= 50 },

        // Win rate achievements
        winStreak: { id: 'winStreak', name: 'Hot Streak', icon: '🔥', description: 'Achieve 60%+ win rate', check: (s) => parseFloat(s.winRate) >= 60 },
        dominant: { id: 'dominant', name: 'Dominant', icon: '💪', description: 'Achieve 75%+ win rate', check: (s) => parseFloat(s.winRate) >= 75 },

        // 100+ achievements
        first100: { id: 'first100', name: 'Century!', icon: '🎯', description: 'Score your first 100+', check: (s) => s.total100s >= 1 },
        five100s: { id: 'five100s', name: 'Sharpshooter', icon: '🎪', description: 'Score 5 100+ turns', check: (s) => s.total100s >= 5 },
        twenty100s: { id: 'twenty100s', name: 'Century Master', icon: '🌟', description: 'Score 20 100+ turns', check: (s) => s.total100s >= 20 },

        // High score achievements
        bigTurn: { id: 'bigTurn', name: 'Big Scorer', icon: '📈', description: 'Score 140+ in a turn', check: (s) => s.maxTurn >= 140 },
        highAvg: { id: 'highAvg', name: 'Consistent', icon: '📊', description: 'Average 40+ per dart', check: (s) => parseFloat(s.avgPerDart) >= 40 },
        eliteAvg: { id: 'eliteAvg', name: 'Elite', icon: '🎖️', description: 'Average 50+ per dart', check: (s) => parseFloat(s.avgPerDart) >= 50 },

        // Checkout achievements
        firstCheckout: { id: 'firstCheckout', name: 'Closer', icon: '✅', description: 'Complete a checkout', check: (s) => s.checkoutSuccesses >= 1 },
        clutchCheckout: { id: 'clutchCheckout', name: 'Clutch', icon: '🎯', description: '50%+ checkout rate', check: (s) => parseFloat(s.checkoutPercentage) >= 50 }
    };

    // Default widget preferences
    const DEFAULT_PREFERENCES = {
        showAchievements: true,
        showProgressRings: true,
        showAnimatedCounters: true,
        showHeatmap: true,
        showStreaks: true,
        widgetOrder: ['achievements', 'progressRings', 'streaks', 'heatmap'],
        goals: {
            targetWinRate: 50,
            target100s: 10,
            targetGames: 50,
            targetAvgPerDart: 40
        }
    };

    /**
     * Get user preferences from localStorage
     */
    function getPreferences() {
        try {
            const saved = localStorage.getItem('dartbee_stats_preferences');
            if (saved) {
                return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.error('Error loading preferences:', e);
        }
        return { ...DEFAULT_PREFERENCES };
    }

    /**
     * Save user preferences to localStorage
     */
    function savePreferences(prefs) {
        try {
            localStorage.setItem('dartbee_stats_preferences', JSON.stringify(prefs));
        } catch (e) {
            console.error('Error saving preferences:', e);
        }
    }

    /**
     * Calculate unlocked achievements for a player
     */
    function calculateAchievements(stats) {
        const unlocked = [];
        const locked = [];

        Object.values(ACHIEVEMENTS).forEach(achievement => {
            if (achievement.check(stats)) {
                unlocked.push(achievement);
            } else {
                locked.push(achievement);
            }
        });

        return { unlocked, locked, total: Object.keys(ACHIEVEMENTS).length };
    }

    /**
     * Render achievement badges HTML
     */
    function renderAchievementBadges(stats, showAll = false) {
        const { unlocked, locked, total } = calculateAchievements(stats);

        let html = `
            <div class="achievements-header">
                <span class="achievements-count">${unlocked.length}/${total} Unlocked</span>
                <button class="toggle-achievements-btn" onclick="StatsWidgets.toggleAchievementsView(this)">
                    ${showAll ? 'Show Unlocked Only' : 'Show All'}
                </button>
            </div>
            <div class="achievements-grid">
        `;

        // Render unlocked achievements
        unlocked.forEach(a => {
            html += `
                <div class="achievement-badge unlocked" title="${a.description}">
                    <span class="achievement-icon">${a.icon}</span>
                    <span class="achievement-name">${a.name}</span>
                </div>
            `;
        });

        // Render locked achievements if showAll
        if (showAll) {
            locked.forEach(a => {
                html += `
                    <div class="achievement-badge locked" title="${a.description} (Locked)">
                        <span class="achievement-icon">🔒</span>
                        <span class="achievement-name">${a.name}</span>
                    </div>
                `;
            });
        }

        html += '</div>';
        return html;
    }

    /**
     * Toggle achievements view between unlocked only and all
     */
    function toggleAchievementsView(button) {
        const container = button.closest('.achievements-container');
        const isShowingAll = button.textContent.includes('Show Unlocked');
        container.dataset.showAll = isShowingAll ? 'false' : 'true';

        // Re-render (will need stats context)
        const event = new CustomEvent('refreshAchievements', { detail: { showAll: !isShowingAll } });
        document.dispatchEvent(event);
    }

    /**
     * Create an animated counter element
     */
    function createAnimatedCounter(targetValue, duration = 1500, prefix = '', suffix = '') {
        const counterId = 'counter-' + Math.random().toString(36).substr(2, 9);

        // Return HTML and setup function
        return {
            html: `<span class="animated-counter" id="${counterId}" data-target="${targetValue}">${prefix}0${suffix}</span>`,
            animate: () => {
                const element = document.getElementById(counterId);
                if (!element) return;

                const target = parseFloat(targetValue) || 0;
                const isDecimal = targetValue.toString().includes('.');
                const startTime = performance.now();

                function update(currentTime) {
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / duration, 1);

                    // Easing function (ease-out cubic)
                    const eased = 1 - Math.pow(1 - progress, 3);
                    const current = target * eased;

                    element.textContent = prefix + (isDecimal ? current.toFixed(2) : Math.floor(current)) + suffix;

                    if (progress < 1) {
                        requestAnimationFrame(update);
                    } else {
                        element.textContent = prefix + targetValue + suffix;
                        element.classList.add('counter-complete');
                    }
                }

                requestAnimationFrame(update);
            }
        };
    }

    /**
     * Render a progress ring SVG
     */
    function renderProgressRing(value, max, label, color = '#FFD700', size = 100) {
        const percentage = Math.min((value / max) * 100, 100);
        const radius = (size - 10) / 2;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percentage / 100) * circumference;

        return `
            <div class="progress-ring-container" style="width: ${size}px; height: ${size}px;">
                <svg class="progress-ring" width="${size}" height="${size}">
                    <circle
                        class="progress-ring-bg"
                        stroke="var(--color-ring-bg, #e5e7eb)"
                        stroke-width="8"
                        fill="transparent"
                        r="${radius}"
                        cx="${size / 2}"
                        cy="${size / 2}"
                    />
                    <circle
                        class="progress-ring-progress"
                        stroke="${color}"
                        stroke-width="8"
                        fill="transparent"
                        r="${radius}"
                        cx="${size / 2}"
                        cy="${size / 2}"
                        stroke-dasharray="${circumference}"
                        stroke-dashoffset="${offset}"
                        stroke-linecap="round"
                        style="--target-offset: ${offset};"
                    />
                </svg>
                <div class="progress-ring-content">
                    <span class="progress-ring-value">${percentage.toFixed(0)}%</span>
                    <span class="progress-ring-label">${label}</span>
                </div>
            </div>
        `;
    }

    /**
     * Render progress rings section with customizable goals
     */
    function renderProgressRings(stats, goals) {
        const rings = [
            {
                label: 'Win Rate Goal',
                value: parseFloat(stats.winRate) || 0,
                max: goals.targetWinRate,
                color: '#3fb950'
            },
            {
                label: '100s Goal',
                value: stats.total100s || 0,
                max: goals.target100s,
                color: '#FFD700'
            },
            {
                label: 'Games Goal',
                value: stats.gamesPlayed || 0,
                max: goals.targetGames,
                color: '#58a6ff'
            },
            {
                label: 'Avg/Turn Goal',
                value: parseFloat(stats.avgPerTurn || stats.avgPerDart) || 0,
                max: goals.targetAvgPerDart,
                color: '#FFD700'
            }
        ];

        let html = '<div class="progress-rings-grid">';
        rings.forEach(ring => {
            const percentage = (ring.value / ring.max) * 100;
            html += renderProgressRing(ring.value, ring.max, ring.label, ring.color, 110);
        });
        html += '</div>';

        return html;
    }

    /**
     * Generate activity heatmap data
     */
    async function getActivityData(playerName, days = 90) {
        try {
            const games = await Storage.getPlayerGames(playerName, 500);
            const activityMap = {};

            // Initialize last N days
            const today = new Date();
            for (let i = 0; i < days; i++) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const key = date.toISOString().split('T')[0];
                activityMap[key] = 0;
            }

            // Count games per day
            games.forEach(game => {
                const date = new Date(game.created_at).toISOString().split('T')[0];
                if (activityMap.hasOwnProperty(date)) {
                    activityMap[date]++;
                }
            });

            return activityMap;
        } catch (e) {
            console.error('Error getting activity data:', e);
            return {};
        }
    }

    /**
     * Compute summary stats from heatmap activity data
     */
    function computeHeatmapSummary(activityData) {
        const values = Object.values(activityData);
        const totalGames = values.reduce((sum, v) => sum + v, 0);

        // Most active day of week
        const dayTotals = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
        Object.entries(activityData).forEach(([dateStr, count]) => {
            const dow = new Date(dateStr + 'T12:00:00').getDay();
            dayTotals[dow] += count;
        });
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const maxDayIdx = dayTotals.indexOf(Math.max(...dayTotals));
        const mostActiveDay = dayTotals[maxDayIdx] > 0 ? dayNames[maxDayIdx] : '—';

        // Current playing streak (consecutive days with games, ending today or yesterday)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let streak = 0;
        let checkDate = new Date(today);
        // Allow streak to start from yesterday if no games today
        const todayStr = checkDate.toISOString().split('T')[0];
        if (!activityData[todayStr] || activityData[todayStr] === 0) {
            checkDate.setDate(checkDate.getDate() - 1);
        }
        while (true) {
            const key = checkDate.toISOString().split('T')[0];
            if (activityData[key] && activityData[key] > 0) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }

        // Avg games per week
        const numWeeks = Math.max(Math.ceil(Object.keys(activityData).length / 7), 1);
        const avgPerWeek = (totalGames / numWeeks).toFixed(1);

        return { totalGames, mostActiveDay, streak, avgPerWeek };
    }

    /**
     * Render activity heatmap calendar (GitHub-style with summary, month labels, gold theme)
     */
    function renderActivityHeatmap(activityData, weeks = 12) {
        const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Calculate max for color scaling
        const maxGames = Math.max(...Object.values(activityData), 1);

        // Compute summary stats
        const summary = computeHeatmapSummary(activityData);

        // Build week columns and track month boundaries for labels
        const weekColumns = [];
        for (let w = weeks - 1; w >= 0; w--) {
            const weekDays = [];
            for (let d = 0; d < 7; d++) {
                const date = new Date(today);
                date.setDate(date.getDate() - (w * 7 + (6 - d)));
                weekDays.push(date);
            }
            weekColumns.push(weekDays);
        }

        // Month labels: find first week that starts each month
        const monthLabels = [];
        let lastMonth = -1;
        const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        weekColumns.forEach((weekDays, idx) => {
            const firstDay = weekDays[0]; // Sunday of this week
            const m = firstDay.getMonth();
            if (m !== lastMonth) {
                monthLabels.push({ idx, label: shortMonths[m] });
                lastMonth = m;
            }
        });

        // Summary stats row
        let html = `
            <div class="heatmap-container">
                <div class="heatmap-summary">
                    <div class="heatmap-stat-card">
                        <span class="heatmap-stat-value">${summary.totalGames}</span>
                        <span class="heatmap-stat-label">Games Played</span>
                    </div>
                    <div class="heatmap-stat-card">
                        <span class="heatmap-stat-value">${summary.mostActiveDay}</span>
                        <span class="heatmap-stat-label">Most Active Day</span>
                    </div>
                    <div class="heatmap-stat-card">
                        <span class="heatmap-stat-value">${summary.streak} <span class="heatmap-stat-unit">d</span></span>
                        <span class="heatmap-stat-label">Current Streak</span>
                    </div>
                    <div class="heatmap-stat-card">
                        <span class="heatmap-stat-value">${summary.avgPerWeek}</span>
                        <span class="heatmap-stat-label">Avg / Week</span>
                    </div>
                </div>
        `;

        // Month labels row
        html += '<div class="heatmap-month-row">';
        html += '<div class="heatmap-label-spacer"></div>'; // space for day labels column
        let labelIdx = 0;
        for (let w = 0; w < weeks; w++) {
            if (labelIdx < monthLabels.length && monthLabels[labelIdx].idx === w) {
                // Calculate span: number of weeks until next label
                const nextIdx = labelIdx + 1 < monthLabels.length ? monthLabels[labelIdx + 1].idx : weeks;
                const span = nextIdx - w;
                html += `<span class="heatmap-month-label" style="width: ${span * 15}px;">${monthLabels[labelIdx].label}</span>`;
                w += span - 1; // skip ahead
                labelIdx++;
            }
        }
        html += '</div>';

        // Heatmap grid with day labels
        html += `
                <div class="heatmap-body">
                    <div class="heatmap-labels">
                        ${dayLabels.map(d => `<span class="heatmap-day-label">${d}</span>`).join('')}
                    </div>
                    <div class="heatmap-grid">
        `;

        // Format date for tooltip: "Mon, Feb 3"
        function formatTooltipDate(date) {
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
        }

        // Generate cells
        weekColumns.forEach(weekDays => {
            html += '<div class="heatmap-week">';
            weekDays.forEach(date => {
                const dateStr = date.toISOString().split('T')[0];
                const isFuture = date > today;
                const count = activityData[dateStr] || 0;
                const intensity = count > 0 ? Math.min(Math.ceil((count / maxGames) * 4), 4) : 0;
                const tooltip = formatTooltipDate(date) + ': ' + count + ' game' + (count !== 1 ? 's' : '');

                if (isFuture) {
                    html += `<div class="heatmap-cell heatmap-future"></div>`;
                } else {
                    html += `
                        <div class="heatmap-cell intensity-${intensity}"
                             title="${tooltip}"
                             data-date="${dateStr}"
                             data-count="${count}">
                        </div>
                    `;
                }
            });
            html += '</div>';
        });

        html += `
                    </div>
                </div>
                <div class="heatmap-footer">
                    <div class="heatmap-detail" id="heatmap-detail"></div>
                    <div class="heatmap-legend">
                        <span>Less</span>
                        <div class="heatmap-cell intensity-0"></div>
                        <div class="heatmap-cell intensity-1"></div>
                        <div class="heatmap-cell intensity-2"></div>
                        <div class="heatmap-cell intensity-3"></div>
                        <div class="heatmap-cell intensity-4"></div>
                        <span>More</span>
                    </div>
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Initialize heatmap cell click interactions
     */
    function initHeatmapInteractions() {
        const container = document.querySelector('.heatmap-grid');
        if (!container) return;

        container.addEventListener('click', (e) => {
            const cell = e.target.closest('.heatmap-cell');
            if (!cell || cell.classList.contains('heatmap-future')) return;

            const dateStr = cell.dataset.date;
            const count = parseInt(cell.dataset.count, 10) || 0;
            const detail = document.getElementById('heatmap-detail');

            // Remove previous selection
            container.querySelectorAll('.heatmap-cell.selected').forEach(c => c.classList.remove('selected'));

            if (count > 0) {
                cell.classList.add('selected');
                // Format date nicely
                const d = new Date(dateStr + 'T12:00:00');
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const formatted = `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
                if (detail) {
                    detail.innerHTML = `<span class="heatmap-detail-date">${formatted}</span> — <strong>${count}</strong> game${count !== 1 ? 's' : ''} played`;
                    detail.classList.add('visible');
                }
            } else {
                if (detail) {
                    detail.classList.remove('visible');
                    detail.innerHTML = '';
                }
            }
        });
    }

    /**
     * Calculate streak data
     */
    function calculateStreaks(recentGames) {
        if (!recentGames || recentGames.length === 0) {
            return { currentWinStreak: 0, longestWinStreak: 0, currentLossStreak: 0 };
        }

        let currentWinStreak = 0;
        let longestWinStreak = 0;
        let currentLossStreak = 0;
        let tempWinStreak = 0;

        // Games should be in chronological order (newest first)
        const games = [...recentGames];

        // Calculate current streak
        for (const game of games) {
            if (game.won) {
                if (currentLossStreak === 0) {
                    currentWinStreak++;
                }
                break;
            } else {
                currentLossStreak++;
            }
        }

        // Continue counting current win streak
        if (currentWinStreak > 0) {
            for (let i = 1; i < games.length; i++) {
                if (games[i].won) {
                    currentWinStreak++;
                } else {
                    break;
                }
            }
        }

        // Calculate longest win streak
        games.forEach(game => {
            if (game.won) {
                tempWinStreak++;
                longestWinStreak = Math.max(longestWinStreak, tempWinStreak);
            } else {
                tempWinStreak = 0;
            }
        });

        return { currentWinStreak, longestWinStreak, currentLossStreak };
    }

    /**
     * Render streak indicators
     */
    function renderStreaks(streakData) {
        const { currentWinStreak, longestWinStreak, currentLossStreak } = streakData;

        let streakStatus = '';
        let streakIcon = '';
        let streakClass = '';

        if (currentWinStreak >= 3) {
            streakStatus = `🔥 ${currentWinStreak} Win Streak!`;
            streakIcon = '🔥';
            streakClass = 'streak-hot';
        } else if (currentWinStreak > 0) {
            streakStatus = `${currentWinStreak} Win${currentWinStreak > 1 ? 's' : ''} in a row`;
            streakIcon = '✅';
            streakClass = 'streak-good';
        } else if (currentLossStreak >= 3) {
            streakStatus = `${currentLossStreak} game cold streak`;
            streakIcon = '❄️';
            streakClass = 'streak-cold';
        } else if (currentLossStreak > 0) {
            streakStatus = `${currentLossStreak} loss${currentLossStreak > 1 ? 'es' : ''}`;
            streakIcon = '📉';
            streakClass = 'streak-down';
        } else {
            streakStatus = 'No active streak';
            streakIcon = '➖';
            streakClass = 'streak-neutral';
        }

        return `
            <div class="streaks-container">
                <div class="streak-card ${streakClass}">
                    <div class="streak-icon">${streakIcon}</div>
                    <div class="streak-info">
                        <div class="streak-status">${streakStatus}</div>
                        <div class="streak-detail">Best: ${longestWinStreak} wins in a row</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render settings panel for customization
     */
    function renderSettingsPanel(currentPrefs) {
        return `
            <div class="stats-settings-panel" id="stats-settings-panel">
                <div class="settings-header">
                    <h4>Customize Dashboard</h4>
                    <button class="close-settings-btn" onclick="StatsWidgets.closeSettings()">×</button>
                </div>
                <div class="settings-body">
                    <div class="setting-group">
                        <h5>Display Options</h5>
                        <label class="setting-toggle">
                            <input type="checkbox" id="pref-achievements" ${currentPrefs.showAchievements ? 'checked' : ''}>
                            <span>Show Achievements</span>
                        </label>
                        <label class="setting-toggle">
                            <input type="checkbox" id="pref-progressRings" ${currentPrefs.showProgressRings ? 'checked' : ''}>
                            <span>Show Progress Rings</span>
                        </label>
                        <label class="setting-toggle">
                            <input type="checkbox" id="pref-streaks" ${currentPrefs.showStreaks ? 'checked' : ''}>
                            <span>Show Streaks</span>
                        </label>
                        <label class="setting-toggle">
                            <input type="checkbox" id="pref-heatmap" ${currentPrefs.showHeatmap ? 'checked' : ''}>
                            <span>Show Activity Heatmap</span>
                        </label>
                    </div>
                    <div class="setting-group">
                        <h5>Personal Goals</h5>
                        <label class="setting-input">
                            <span>Target Win Rate (%)</span>
                            <input type="number" id="goal-winRate" value="${currentPrefs.goals.targetWinRate}" min="1" max="100">
                        </label>
                        <label class="setting-input">
                             <span>Target 100+ Turns</span>
                            <input type="number" id="goal-100s" value="${currentPrefs.goals.target100s}" min="1" max="1000">
                        </label>
                        <label class="setting-input">
                            <span>Target Games</span>
                            <input type="number" id="goal-games" value="${currentPrefs.goals.targetGames}" min="1" max="10000">
                        </label>
                        <label class="setting-input">
                            <span>Target Avg/Turn</span>
                            <input type="number" id="goal-avgDart" value="${currentPrefs.goals.targetAvgPerDart}" min="1" max="60">
                        </label>
                    </div>
                    <button class="btn btn-primary save-settings-btn" onclick="StatsWidgets.saveSettingsFromPanel()">
                        Save Preferences
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Open settings panel
     */
    function openSettings() {
        const existing = document.getElementById('stats-settings-panel');
        if (existing) {
            existing.classList.add('visible');
            return;
        }

        const prefs = getPreferences();
        const panel = document.createElement('div');
        panel.innerHTML = renderSettingsPanel(prefs);
        document.body.appendChild(panel.firstElementChild);

        setTimeout(() => {
            document.getElementById('stats-settings-panel').classList.add('visible');
        }, 10);
    }

    /**
     * Close settings panel
     */
    function closeSettings() {
        const panel = document.getElementById('stats-settings-panel');
        if (panel) {
            panel.classList.remove('visible');
            setTimeout(() => panel.remove(), 300);
        }
    }

    /**
     * Save settings from panel
     */
    function saveSettingsFromPanel() {
        const prefs = {
            showAchievements: document.getElementById('pref-achievements')?.checked ?? true,
            showProgressRings: document.getElementById('pref-progressRings')?.checked ?? true,
            showStreaks: document.getElementById('pref-streaks')?.checked ?? true,
            showHeatmap: document.getElementById('pref-heatmap')?.checked ?? true,
            showAnimatedCounters: true,
            widgetOrder: ['achievements', 'progressRings', 'streaks', 'heatmap'],
            goals: {
                targetWinRate: parseInt(document.getElementById('goal-winRate')?.value) || 50,
                target100s: parseInt(document.getElementById('goal-100s')?.value) || 10,
                targetGames: parseInt(document.getElementById('goal-games')?.value) || 50,
                targetAvgPerDart: parseInt(document.getElementById('goal-avgDart')?.value) || 40
            }
        };

        savePreferences(prefs);
        closeSettings();

        // Trigger refresh
        const event = new CustomEvent('statsPreferencesChanged', { detail: prefs });
        document.dispatchEvent(event);

        // Show toast notification
        if (typeof UI !== 'undefined' && UI.showToast) {
            UI.showToast('Preferences saved!', 'success');
        }
    }

    /**
     * Render player comparison view
     */
    function renderPlayerComparison(stats1, stats2, name1, name2) {
        const comparisons = [
            { label: 'Games Played', key: 'gamesPlayed', format: v => v },
            { label: 'Wins', key: 'gamesWon', format: v => v },
            { label: 'Win Rate', key: 'winRate', format: v => v + '%' },
            { label: 'Avg/Turn', key: 'avgPerTurn', format: v => v || stats1.avgPerDart || stats2.avgPerDart },
            { label: 'Total 100+', key: 'total100s', format: v => v },
            { label: 'Max Turn', key: 'maxTurn', format: v => v },
            { label: 'Checkout %', key: 'checkoutPercentage', format: v => v + '%' }
        ];

        let html = `
            <div class="comparison-container">
                <div class="comparison-header">
                    <div class="comparison-player player-1">${name1}</div>
                    <div class="comparison-vs">VS</div>
                    <div class="comparison-player player-2">${name2}</div>
                </div>
                <div class="comparison-stats">
        `;

        comparisons.forEach(comp => {
            const val1 = parseFloat(stats1[comp.key]) || 0;
            const val2 = parseFloat(stats2[comp.key]) || 0;
            const winner = val1 > val2 ? 1 : (val2 > val1 ? 2 : 0);

            html += `
                <div class="comparison-row">
                    <div class="comparison-value ${winner === 1 ? 'winner' : ''}">${comp.format(stats1[comp.key])}</div>
                    <div class="comparison-label">${comp.label}</div>
                    <div class="comparison-value ${winner === 2 ? 'winner' : ''}">${comp.format(stats2[comp.key])}</div>
                </div>
            `;
        });

        html += '</div></div>';
        return html;
    }

    /**
     * Create comparison chart (radar overlay)
     */
    function createComparisonRadarChart(canvasId, stats1, stats2, name1, name2) {
        Charts.destroyChart(canvasId);

        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');

        const normalizeValue = (value, max) => Math.min((value / max) * 100, 100);

        const data1 = [
            normalizeValue(parseFloat(stats1.winRate) || 0, 100),
            normalizeValue(parseFloat(stats1.avgPerTurn || stats1.avgPerDart) || 0, 60),
            normalizeValue(stats1.total100s || 0, 20),
            normalizeValue(stats1.maxTurn || 0, 180),
            normalizeValue(parseFloat(stats1.checkoutPercentage) || 0, 100)
        ];

        const data2 = [
            normalizeValue(parseFloat(stats2.winRate) || 0, 100),
            normalizeValue(parseFloat(stats2.avgPerTurn || stats2.avgPerDart) || 0, 60),
            normalizeValue(stats2.total100s || 0, 20),
            normalizeValue(stats2.maxTurn || 0, 180),
            normalizeValue(parseFloat(stats2.checkoutPercentage) || 0, 100)
        ];

        const gridColor = 'rgba(255, 255, 255, 0.12)';
        const textColor = '#e6edf3';
        const purple = '#FFD700';
        const green = '#3fb950';

        const chart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Win Rate', 'Avg/Turn', '100+', 'Max Turn', 'Checkout %'],
                datasets: [
                    {
                        label: name1,
                        data: data1,
                        backgroundColor: 'rgba(255, 215, 0, 0.2)',
                        borderColor: purple,
                        borderWidth: 2,
                        pointBackgroundColor: purple
                    },
                    {
                        label: name2,
                        data: data2,
                        backgroundColor: 'rgba(63, 185, 80, 0.2)',
                        borderColor: green,
                        borderWidth: 2,
                        pointBackgroundColor: green
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: textColor
                        }
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { display: false },
                        grid: {
                            color: gridColor
                        },
                        angleLines: {
                            color: gridColor
                        },
                        pointLabels: {
                            color: textColor
                        }
                    }
                }
            }
        });

        return chart;
    }

    // Public API
    return {
        ACHIEVEMENTS,
        getPreferences,
        savePreferences,
        calculateAchievements,
        renderAchievementBadges,
        toggleAchievementsView,
        createAnimatedCounter,
        renderProgressRing,
        renderProgressRings,
        getActivityData,
        computeHeatmapSummary,
        renderActivityHeatmap,
        initHeatmapInteractions,
        calculateStreaks,
        renderStreaks,
        renderSettingsPanel,
        openSettings,
        closeSettings,
        saveSettingsFromPanel,
        renderPlayerComparison,
        createComparisonRadarChart
    };
})();
