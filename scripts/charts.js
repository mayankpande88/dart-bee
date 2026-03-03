/**
 * Charts Module
 * Provides chart rendering functionality using Chart.js
 * Themed to match Dart Bee's color scheme
 */

const Charts = (() => {
    // Theme colors — dark-only gold palette
    const COLORS = {
        primary: '#FFD700',
        primaryDark: '#0d1117',
        primaryLight: '#ffe566',
        accentGreen: '#3fb950',
        accentYellow: '#FFD700',
        accentBlue: '#58a6ff',
        accentRed: '#f85149',
        textDark: '#e6edf3',
        textLight: '#8b949e',
        background: '#0d1117',
        white: '#161b22'
    };

    // Same values (single dark mode)
    const DARK_COLORS = {
        primary: '#FFD700',
        primaryDark: '#0d1117',
        primaryLight: '#ffe566',
        accentGreen: '#3fb950',
        accentYellow: '#FFD700',
        accentBlue: '#58a6ff',
        accentRed: '#f85149',
        textDark: '#e6edf3',
        textLight: '#8b949e',
        background: '#0d1117',
        white: '#161b22'
    };

    // Get the right color set for current theme
    function C() {
        return isDarkMode() ? DARK_COLORS : COLORS;
    }

    // Chart color palette for multiple data series (gold-first)
    const CHART_PALETTE = [
        '#FFD700',
        '#3fb950',
        '#58a6ff',
        '#f85149',
        '#ffe566',
        '#a371f7',
        '#ff9f43',
        '#79c0ff'
    ];

    // Store chart instances for cleanup
    const chartInstances = {};

    // Always dark mode
    function isDarkMode() {
        return true;
    }

    /**
     * Get default chart options with consistent styling
     */
    function getDefaultOptions(type) {
        const dark = isDarkMode();
        const c = C();
        const textColor = c.textDark;
        const textMutedColor = c.textLight;
        const gridColor = dark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.05)';

        const baseOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        font: {
                            family: 'Barlow, sans-serif',
                            size: 12
                        },
                        color: textColor
                    }
                },
                tooltip: {
                    backgroundColor: '#161b22',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    titleFont: {
                        family: 'Barlow, sans-serif',
                        size: 13
                    },
                    bodyFont: {
                        family: 'Barlow, sans-serif',
                        size: 12
                    },
                    padding: 10,
                    cornerRadius: 8
                }
            }
        };

        if (type === 'line' || type === 'bar') {
            baseOptions.scales = {
                x: {
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        font: {
                            family: 'Barlow, sans-serif',
                            size: 11
                        },
                        color: textMutedColor
                    }
                },
                y: {
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        font: {
                            family: 'Barlow, sans-serif',
                            size: 11
                        },
                        color: textMutedColor
                    }
                }
            };
        }

        return baseOptions;
    }

    /**
     * Destroy existing chart instance before creating new one
     */
    function destroyChart(chartId) {
        if (chartInstances[chartId]) {
            chartInstances[chartId].destroy();
            delete chartInstances[chartId];
        }
    }

    /**
     * Create Win/Loss Doughnut Chart
     * Shows wins vs losses in a clean doughnut format
     */
    function createWinLossChart(canvasId, wins, losses) {
        destroyChart(canvasId);
        const c = C();

        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');
        const total = wins + losses;

        if (total === 0) {
            ctx.font = '14px Barlow, sans-serif';
            ctx.fillStyle = c.textLight;
            ctx.textAlign = 'center';
            ctx.fillText('No games played yet', canvas.width / 2, canvas.height / 2);
            return null;
        }

        const options = getDefaultOptions('doughnut');
        options.cutout = '65%';
        options.plugins.legend.position = 'bottom';
        options.plugins.tooltip.callbacks = {
            label: function(context) {
                const value = context.raw;
                const percentage = ((value / total) * 100).toFixed(1);
                return `${context.label}: ${value} (${percentage}%)`;
            }
        };

        chartInstances[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Wins', 'Losses'],
                datasets: [{
                    data: [wins, losses],
                    backgroundColor: [c.accentGreen, c.accentRed],
                    borderColor: [c.white, c.white],
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: options
        });

        return chartInstances[canvasId];
    }

    /**
     * Create Performance Over Time Line Chart
     * Shows avg per turn trend over recent games
     */
    function createPerformanceChart(canvasId, recentGames) {
        destroyChart(canvasId);
        const c = C();

        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');

        if (!recentGames || recentGames.length === 0) {
            ctx.font = '14px Barlow, sans-serif';
            ctx.fillStyle = c.textLight;
            ctx.textAlign = 'center';
            ctx.fillText('No game history available', canvas.width / 2, canvas.height / 2);
            return null;
        }

        // Reverse to show chronological order (oldest first)
        const games = [...recentGames].reverse();
        const labels = games.map((g, i) => `Game ${i + 1}`);
        const avgPerTurn = games.map(g => g.avgPerTurn || (g.turns > 0 ? (g.score / g.turns).toFixed(2) : 0));

        const options = getDefaultOptions('line');
        options.plugins.legend.display = false;
        options.scales.y.beginAtZero = true;
        options.scales.y.title = {
            display: true,
            text: 'Avg per Turn',
            font: { family: 'Barlow, sans-serif', size: 11 },
            color: c.textLight
        };

        chartInstances[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Avg per Turn',
                    data: avgPerTurn,
                    borderColor: c.primary,
                    backgroundColor: 'rgba(255, 215, 0, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: c.primary,
                    pointBorderColor: c.white,
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: options
        });

        return chartInstances[canvasId];
    }

    /**
     * Create Score Distribution Bar Chart
     * Shows distribution of turn scores (0-60, 60-100, 100-140, 140-180, 180)
     */
    function createScoreDistributionChart(canvasId, scoreData) {
        destroyChart(canvasId);
        const c = C();

        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');

        if (!scoreData || Object.values(scoreData).every(v => v === 0)) {
            ctx.font = '14px Barlow, sans-serif';
            ctx.fillStyle = c.textLight;
            ctx.textAlign = 'center';
            ctx.fillText('No score data available', canvas.width / 2, canvas.height / 2);
            return null;
        }

        const labels = ['0-19', '20-39', '40-59', '60-99', '100-139', '140-179', '180'];
        const data = [
            scoreData.range0_19 || 0,
            scoreData.range20_39 || 0,
            scoreData.range40_59 || 0,
            scoreData.range60_99 || 0,
            scoreData.range100_139 || 0,
            scoreData.range140_179 || 0,
            scoreData.range180 || 0
        ];

        const options = getDefaultOptions('bar');
        options.plugins.legend.display = false;
        options.scales.y.beginAtZero = true;
        options.scales.y.title = {
            display: true,
            text: 'Turn Count',
            font: { family: 'Barlow, sans-serif', size: 11 },
            color: c.textLight
        };
        options.scales.x.title = {
            display: true,
            text: 'Turn Score Range',
            font: { family: 'Barlow, sans-serif', size: 11 },
            color: c.textLight
        };

        chartInstances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Turns',
                    data: data,
                    backgroundColor: c.primary,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: options
        });

        return chartInstances[canvasId];
    }

    /**
     * Create Head-to-Head Comparison Bar Chart
     */
    function createHeadToHeadChart(canvasId, headToHeadData) {
        destroyChart(canvasId);
        const c = C();

        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');

        if (!headToHeadData || Object.keys(headToHeadData).length === 0) {
            ctx.font = '14px Barlow, sans-serif';
            ctx.fillStyle = c.textLight;
            ctx.textAlign = 'center';
            ctx.fillText('No head-to-head data', canvas.width / 2, canvas.height / 2);
            return null;
        }

        const opponents = Object.keys(headToHeadData).slice(0, 6); // Limit to top 6
        const wins = opponents.map(o => headToHeadData[o].wins);
        const losses = opponents.map(o => headToHeadData[o].losses);

        const options = getDefaultOptions('bar');
        options.plugins.legend.position = 'bottom';
        options.scales.y.beginAtZero = true;
        options.scales.y.stacked = true;
        options.scales.x.stacked = true;
        options.indexAxis = 'y';

        chartInstances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: opponents,
                datasets: [
                    {
                        label: 'Wins',
                        data: wins,
                        backgroundColor: c.accentGreen,
                        borderRadius: 4
                    },
                    {
                        label: 'Losses',
                        data: losses,
                        backgroundColor: c.accentRed,
                        borderRadius: 4
                    }
                ]
            },
            options: options
        });

        return chartInstances[canvasId];
    }

    /**
     * Create Leaderboard Comparison Chart
     * Horizontal bar chart comparing multiple players
     */
    function createLeaderboardChart(canvasId, leaderboardData, metric) {
        destroyChart(canvasId);
        const c = C();

        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');

        if (!leaderboardData || leaderboardData.length === 0) {
            ctx.font = '14px Barlow, sans-serif';
            ctx.fillStyle = c.textLight;
            ctx.textAlign = 'center';
            ctx.fillText('No leaderboard data', canvas.width / 2, canvas.height / 2);
            return null;
        }

        const top5 = leaderboardData.slice(0, 5);
        const labels = top5.map(p => p.name);
        const values = top5.map(p => parseFloat(p.metric) || 0);

        const metricLabels = {
            'wins': 'Total Wins',
            'win-rate': 'Win Rate (%)',
            'avg-turn': 'Avg per Turn',
            '100s': 'Total 100+'
        };

        const options = getDefaultOptions('bar');
        options.indexAxis = 'y';
        options.plugins.legend.display = false;
        options.scales.x.beginAtZero = true;
        options.scales.x.title = {
            display: true,
            text: metricLabels[metric] || 'Value',
            font: { family: 'Barlow, sans-serif', size: 11 },
            color: c.textLight
        };

        // Use gradient colors based on rank
        const dark = isDarkMode();
        const backgroundColors = top5.map((_, i) => {
            const opacity = 1 - (i * 0.15);
            return dark
                ? `rgba(255, 215, 0, ${opacity})`
                : `rgba(255, 215, 0, ${opacity})`;
        });

        chartInstances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: backgroundColors,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: options
        });

        return chartInstances[canvasId];
    }

    /**
     * Create Radar Chart for player stats overview
     */
    function createStatsRadarChart(canvasId, stats) {
        destroyChart(canvasId);
        const c = C();

        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');

        if (!stats) {
            ctx.font = '14px Barlow, sans-serif';
            ctx.fillStyle = c.textLight;
            ctx.textAlign = 'center';
            ctx.fillText('No stats available', canvas.width / 2, canvas.height / 2);
            return null;
        }

        // Normalize stats to 0-100 scale for radar chart
        const normalizeValue = (value, max) => Math.min((value / max) * 100, 100);

        const data = [
            normalizeValue(parseFloat(stats.winRate) || 0, 100),
            normalizeValue(parseFloat(stats.avgPerTurn || stats.avgPerDart) || 0, 60),
            normalizeValue(stats.total100s || 0, 20),
            normalizeValue(stats.maxTurn || 0, 180),
            normalizeValue(parseFloat(stats.checkoutPercentage) || 0, 100)
        ];

        const dark = isDarkMode();
        const gridColor = dark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)';

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: c.primaryDark,
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    callbacks: {
                        label: function(context) {
                            const labels = ['Win Rate', 'Avg/Turn', '100+', 'Max Turn', 'Checkout %'];
                            const rawValues = [
                                `${stats.winRate}%`,
                                stats.avgPerTurn || stats.avgPerDart,
                                stats.total100s,
                                stats.maxTurn,
                                `${stats.checkoutPercentage}%`
                            ];
                            return `${labels[context.dataIndex]}: ${rawValues[context.dataIndex]}`;
                        }
                    }
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        display: false
                    },
                    grid: {
                        color: gridColor
                    },
                    angleLines: {
                        color: gridColor
                    },
                    pointLabels: {
                        font: {
                            family: 'Barlow, sans-serif',
                            size: 11
                        },
                        color: c.textDark
                    }
                }
            }
        };

        chartInstances[canvasId] = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Win Rate', 'Avg/Turn', '100+', 'Max Turn', 'Checkout %'],
                datasets: [{
                    data: data,
                    backgroundColor: 'rgba(255, 215, 0, 0.2)',
                    borderColor: c.primary,
                    borderWidth: 2,
                    pointBackgroundColor: c.primary,
                    pointBorderColor: c.white,
                    pointBorderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: options
        });

        return chartInstances[canvasId];
    }

    /**
     * Destroy all chart instances (cleanup)
     */
    function destroyAllCharts() {
        Object.keys(chartInstances).forEach(id => {
            destroyChart(id);
        });
    }

    // Public API
    return {
        createWinLossChart,
        createPerformanceChart,
        createScoreDistributionChart,
        createHeadToHeadChart,
        createLeaderboardChart,
        createStatsRadarChart,
        destroyChart,
        destroyAllCharts,
        COLORS
    };
})();
