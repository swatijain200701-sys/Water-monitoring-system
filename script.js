/**
 * AquaSmart — Redesigned Frontend Dashboard
 * Connects via Socket.IO to the Node.js backend.
 * All DOM references are cached once for performance.
 */

class AquaDashboard {
    constructor() {
        this.socket = io();
        this.chart  = null;

        // Cache all DOM refs once at startup — no repeated querySelector calls
        this.dom = {
            // Connection indicator
            connDot:    document.getElementById('conn-dot'),
            connLabel:  document.getElementById('conn-label'),

            // Status banner
            banner:      document.getElementById('status-banner'),
            bannerIcon:  document.getElementById('banner-icon'),
            bannerTitle: document.getElementById('banner-title'),
            bannerDesc:  document.getElementById('banner-desc'),
            bannerBadge: document.getElementById('banner-badge'),

            // Flow card
            valFlow:  document.getElementById('val-flow'),
            barFlow:  document.getElementById('bar-flow'),
            subFlow:  document.getElementById('sub-flow'),

            // Tank card
            valTank:  document.getElementById('val-tank'),
            barTank:  document.getElementById('bar-tank'),
            subTank:  document.getElementById('sub-tank'),

            // Usage card
            valUsage: document.getElementById('val-usage'),
            barUsage: document.getElementById('bar-usage'),

            // Saved / valve card
            valSaved:   document.getElementById('val-saved'),
            valveState: document.getElementById('valve-state'),
            valveWord:  document.getElementById('valve-word'),

            // Buttons
            btnDemo:  document.getElementById('btn-demo'),
            btnLeak:  document.getElementById('btn-leak'),
            btnHigh:  document.getElementById('btn-high'),
            btnReset: document.getElementById('btn-reset'),
            btnValve: document.getElementById('btn-valve'),
            btnEco:   document.getElementById('btn-eco'),
        };

        this.init();
    }

    init() {
        this.setupChart();
        this.setupButtons();
        this.setupSocket();
    }

    // ─── SOCKET CONNECTION ─────────────────────────────────────
    setupSocket() {
        this.socket.on('connect', () => {
            this.dom.connDot.classList.add('live');
            this.dom.connLabel.textContent = 'Live — Connected';
        });

        this.socket.on('disconnect', () => {
            this.dom.connDot.classList.remove('live');
            this.dom.connLabel.textContent = 'Disconnected';
        });

        this.socket.on('systemUpdate', (state) => {
            this.updateMetrics(state);
            this.updateBanner(state);
            this.updateChart(state.flowRate);
        });

        this.socket.on('resetChart', () => {
            this.chart.data.labels   = Array(20).fill('');
            this.chart.data.datasets[0].data = Array(20).fill(0);
            this.chart.update('none');
        });
    }

    // ─── UPDATE METRIC CARDS ──────────────────────────────────
    updateMetrics(state) {
        // -- Flow Rate --
        const flow = state.flowRate;
        this.dom.valFlow.textContent = flow.toFixed(1);
        // Bar: max ref is 35 L/min
        const flowPct = Math.min(100, (flow / 35) * 100);
        this.dom.barFlow.style.width = `${flowPct}%`;

        if (flow === 0) {
            this.dom.barFlow.className = 'metric-bar';
            this.dom.subFlow.textContent = 'No water flowing right now';
        } else if (flow < 10) {
            this.dom.barFlow.className = 'metric-bar cyan';
            this.dom.subFlow.textContent = `Normal usage — ${flow.toFixed(1)} L/min`;
        } else if (flow < 20) {
            this.dom.barFlow.className = 'metric-bar yellow';
            this.dom.subFlow.textContent = `⚠️ High flow detected — ${flow.toFixed(1)} L/min`;
        } else {
            this.dom.barFlow.className = 'metric-bar red';
            this.dom.subFlow.textContent = `🚨 Danger! Possible leakage at ${flow.toFixed(1)} L/min`;
        }

        // -- Tank Level --
        const tank = state.tankLevel;
        this.dom.valTank.textContent = tank.toFixed(1);
        this.dom.barTank.style.width = `${Math.max(0, Math.min(100, tank))}%`;

        if (tank < 20) {
            this.dom.barTank.className = 'metric-bar red';
            this.dom.subTank.textContent = '🚨 Tank critically low!';
        } else if (tank < 40) {
            this.dom.barTank.className = 'metric-bar yellow';
            this.dom.subTank.textContent = '⚠️ Tank running low — refill soon';
        } else {
            this.dom.barTank.className = 'metric-bar cyan';
            this.dom.subTank.textContent = tank > 80 ? '✅ Tank is full' : `Tank at ${tank.toFixed(0)}%`;
        }

        // -- Daily Usage --
        const usage = state.dailyConsumption;
        this.dom.valUsage.textContent = usage.toFixed(1);
        // 500 L daily limit
        const usagePct = Math.min(100, (usage / 500) * 100);
        this.dom.barUsage.style.width = `${usagePct}%`;

        // -- Water Saved --
        this.dom.valSaved.textContent = state.waterSaved.toFixed(1);

        // -- Valve State --
        const open = state.valveOpen;
        this.dom.valveWord.textContent = open ? 'OPEN' : 'CLOSED';
        this.dom.valveState.className  = open ? 'valve-state' : 'valve-state closed';
        this.dom.valveState.querySelector('i').className = open
            ? 'fa-solid fa-faucet'
            : 'fa-solid fa-faucet-drip';

        // -- Demo button label --
        if (state.isRunning) {
            this.dom.btnDemo.innerHTML = '<i class="fa-solid fa-pause"></i><span>Pause Monitoring</span>';
            this.dom.btnDemo.className = 'ctrl-btn warning';
        } else {
            this.dom.btnDemo.innerHTML = '<i class="fa-solid fa-play"></i><span>Start Monitoring</span>';
            this.dom.btnDemo.className = 'ctrl-btn primary';
        }
    }

    // ─── STATUS BANNER ────────────────────────────────────────
    updateBanner(state) {
        const a = state.alertState;   // { type, title, description }
        const t = a.type;             // 'safe' | 'warning' | 'danger'

        // Banner background
        this.dom.banner.className = `status-banner ${t}`;

        // Icon
        const icons = {
            safe:    '<i class="fa-solid fa-check-circle safe-icon"></i>',
            warning: '<i class="fa-solid fa-triangle-exclamation warning-icon"></i>',
            danger:  '<i class="fa-solid fa-burst danger-icon"></i>',
        };
        this.dom.bannerIcon.innerHTML = icons[t] || icons.safe;

        // Text
        this.dom.bannerTitle.textContent = a.title;
        this.dom.bannerDesc.textContent  = a.description;

        // Badge
        const labels = { safe: 'SAFE', warning: 'WARNING', danger: '🚨 LEAKAGE' };
        this.dom.bannerBadge.textContent  = labels[t] || 'SAFE';
        this.dom.bannerBadge.className    = `banner-badge ${t}`;
    }

    // ─── CHART ────────────────────────────────────────────────
    setupChart() {
        const ctx = document.getElementById('flowChart').getContext('2d');

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array(20).fill(''),
                datasets: [{
                    label: 'Flow Rate (L/min)',
                    data: Array(20).fill(0),
                    borderColor: '#22d3ee',
                    backgroundColor: 'rgba(34,211,238,0.08)',
                    borderWidth: 2.5,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 3,
                    pointBackgroundColor: '#22d3ee',
                    pointHoverRadius: 6,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 500 },   // only on first load
                interaction: { mode: 'index', intersect: false },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 40,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: {
                            color: '#8b949e',
                            callback: (v) => `${v} L/min`,
                        },
                        border: { color: '#30363d' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#8b949e', maxTicksLimit: 6 },
                        border: { color: '#30363d' }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1f2733',
                        borderColor: '#30363d',
                        borderWidth: 1,
                        titleColor: '#e6edf3',
                        bodyColor: '#8b949e',
                        callbacks: {
                            label: (ctx) => ` ${ctx.parsed.y.toFixed(1)} L/min`
                        }
                    }
                }
            }
        });
    }

    updateChart(flowRate) {
        const now = new Date();
        const ts  = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;

        this.chart.data.labels.push(ts);
        this.chart.data.datasets[0].data.push(flowRate);

        // Keep last 20 points (≈ 40 seconds)
        if (this.chart.data.labels.length > 20) {
            this.chart.data.labels.shift();
            this.chart.data.datasets[0].data.shift();
        }

        // 'none' = instant repaint, no animation lag
        this.chart.update('none');
    }

    // ─── CONTROL BUTTONS ──────────────────────────────────────
    setupButtons() {
        this.dom.btnDemo.addEventListener('click', () => {
            if (this.dom.btnDemo.className.includes('warning')) {
                this.socket.emit('stopEngine');
            } else {
                this.socket.emit('startEngine');
            }
        });

        this.dom.btnLeak.addEventListener('click', () => {
            this.socket.emit('setMode', 'leakage');
        });

        this.dom.btnHigh.addEventListener('click', () => {
            this.socket.emit('setMode', 'high');
        });

        this.dom.btnReset.addEventListener('click', () => {
            this.socket.emit('resetSystem');
            // Also reset button to Start state
            this.dom.btnDemo.innerHTML = '<i class="fa-solid fa-play"></i><span>Start Monitoring</span>';
            this.dom.btnDemo.className = 'ctrl-btn primary';
        });

        this.dom.btnValve.addEventListener('click', () => {
            this.socket.emit('toggleValve');
        });

        this.dom.btnEco.addEventListener('click', () => {
            this.socket.emit('setMode', 'eco');
        });
    }
}

// Boot the dashboard when the page is ready
document.addEventListener('DOMContentLoaded', () => {
    window.aqua = new AquaDashboard();
});
