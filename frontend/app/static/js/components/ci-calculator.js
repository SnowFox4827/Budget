// IIFE to keep the module internals private.
(function () {

    function money(n) {
        return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    }

    let lastSeries = null; // keep the last chart series so we can redraw on theme change

    // Compound interest calculator with optional monthly contributions.
    window.compInterest = function () {
        const principalEl = document.getElementById('ci-principal');
        const rateNumEl = document.getElementById('ci-rate-num');
        const yearsEl = document.getElementById('ci-years');
        const monthlyEl = document.getElementById('ci-monthly');
        const compoundEl = document.getElementById('ci-compound');
        const resultEl = document.getElementById('ci-result');

        if (!principalEl || !rateNumEl || !yearsEl || !monthlyEl || !compoundEl || !resultEl) return;

        const principal = parseFloat(principalEl.value);
        const rate = parseFloat(rateNumEl.value);
        const years = parseFloat(yearsEl.value);
        const monthly = parseFloat(monthlyEl.value) || 0;
        const n = parseInt(compoundEl.value, 10);

        if (isNaN(principal) || principal <= 0) {
            resultEl.innerHTML = '<div class="alert-error">Please enter a valid principal amount greater than 0.</div>';
            return;
        }
        if (isNaN(years) || years <= 0) {
            resultEl.innerHTML = '<div class="alert-error">Please enter a valid number of years (1 or more).</div>';
            return;
        }
        if (isNaN(rate) || rate <= 0) {
            resultEl.innerHTML = '<div class="alert-error">Please enter a valid annual interest rate greater than 0%.</div>';
            return;
        }

        const months = Math.round(years * 12);
        let final;
        let interest;
        let yearly = [];

        if (monthly > 0) {
            // Simulate month by month: monthly deposits, monthly compounding.
            const rMonth = rate / 100 / 12;
            let balance = principal;
            const points = [principal];
            for (let m = 1; m <= months; m++) {
                balance = balance * (1 + rMonth) + monthly;
                if (m % 12 === 0) points.push(balance);
            }
            if (points.length === 1 || months % 12 !== 0) {
                // ensure the fractional-year endpoint is captured
                if (months % 12 !== 0) points.push(balance);
            }
            final = balance;
            interest = final - principal - monthly * months;
            // rebuild yearly series aligned by integer years
            yearly = [];
            const nyears = Math.floor(months / 12);
            let b = principal;
            yearly.push(b);
            for (let y = 0; y < Math.max(1, Math.max(Math.ceil(years), nyears)); y++) {
                for (let m = 0; m < 12; m++) {
                    if ((y * 12 + m + 1) <= months) b = b * (1 + rMonth) + monthly;
                }
                yearly.push(b);
            }
        } else {
            // No deposits: use closed-form with the chosen compounding frequency.
            const rn = rate / 100 / n;
            final = principal * Math.pow(1 + rn, n * years);
            interest = final - principal;
            const nyears = Math.max(1, Math.ceil(years));
            yearly = [];
            for (let y = 0; y <= nyears; y++) {
                yearly.push(principal * Math.pow(1 + rn, n * y));
            }
        }

        let depositsLine = '';
        if (monthly > 0) {
            const totalDeposited = principal + monthly * months;
            depositsLine = '<div class="calc-line"><span class="text-soft">Total deposited</span>' + money(totalDeposited) + '</div>';
        }

        resultEl.innerHTML =
            '<div class="calc-line"><span class="text-soft">Final amount</span><strong>' + money(final) + '</strong></div>' +
            depositsLine +
            '<div class="calc-line"><span class="text-soft">Principal</span>' + money(principal) + '</div>' +
            (monthly > 0 ? '<div class="calc-line"><span class="text-soft">Total contributions</span>' + money(monthly * months) + '</div>' : '') +
            '<div class="calc-line"><span class="text-soft">Interest earned</span>' + money(interest) + '</div>';

        lastSeries = yearly;
        renderChart(yearly);
    };

    // Re-render the existing chart with fresh colors when the theme flips.
    document.addEventListener('theme-changed', function () {
        if (lastSeries && lastSeries.length) renderChart(lastSeries);
    });

    // Figure out the year each milestone ($100k, $1M) is first crossed.
    function milestonesFor(series) {
        const result = [];
        const goals = [
            { value: 100000, label: '$100k' },
            { value: 1000000, label: '$1M' }
        ];
        for (const g of goals) {
            for (let i = 0; i < series.length; i++) {
                if (series[i] >= g.value) {
                    result.push({ value: g.value, label: g.label, year: i });
                    break;
                }
            }
        }
        return result;
    }

    // Draw the year-by-year growth curve.
    function renderChart(series) {
        const canvas = document.getElementById('ci-chart');
        if (!canvas || typeof Chart === 'undefined') return;
        if (!series || series.length === 0) return;

        if (window.ciChart instanceof Chart) {
            window.ciChart.destroy();
        }

        const labels = [];
        for (let i = 0; i < series.length; i++) labels.push('Year ' + i);

        // Pull theme colors from CSS variables if present.
        const css = getComputedStyle(document.documentElement);
        const accent = (css.getPropertyValue('--accent') || '#4a90d9').trim();
        const grid = (css.getPropertyValue('--border') || 'rgba(128,128,128,0.15)').trim();
        const tick = (css.getPropertyValue('--text') || '#666').trim();

        window.ciChart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Balance',
                    data: series,
                    borderColor: accent,
                    backgroundColor: accent + '22',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3
                }]
            },
            plugins: [
                // Milestone lines: first $100k and first $1M (horizontal dashed lines + labels).
                {
                    beforeDraw: function (chart) {
                        chart.$milestones = milestonesFor(series);
                    },
                    afterDraw: function (chart) {
                        const ms = chart.$milestones;
                        if (!ms || ms.length === 0) return;
                        const yScale = chart.scales.y;
                        const xScale = chart.scales.x;
                        const chartArea = chart.chartArea;
                        const ctx = chart.ctx;
                        ctx.save();
                        ctx.font = '600 11px sans-serif';
                        ctx.textBaseline = 'bottom';
                        for (const m of ms) {
                            if (m.value > series[series.length - 1]) continue; // milestone never reached in range
                            const y = yScale.getPixelForValue(m.value);
                            if (y < chartArea.top || y > chartArea.bottom) continue;
                            const c = (m.value >= 1000000) ? '#c9a227' : '#2e9e5b';
                            ctx.strokeStyle = c;
                            ctx.setLineDash([6, 5]);
                            ctx.lineWidth = 1.5;
                            ctx.globalAlpha = 0.85;
                            ctx.beginPath();
                            ctx.moveTo(chartArea.left, y);
                            ctx.lineTo(chartArea.right, y);
                            ctx.stroke();
                            ctx.setLineDash([]);
                            ctx.globalAlpha = 1;
                            ctx.fillStyle = c;
                            ctx.textAlign = 'right';
                            ctx.fillText(m.label, chartArea.right - 4, y - 4);
                        }
                        ctx.restore();
                    }
                }
            ],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                return money(ctx.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: grid },
                        ticks: { color: tick }
                    },
                    y: {
                        grid: { color: grid },
                        ticks: {
                            color: tick,
                            callback: function (v) {
                                return '\u00a0\u00a0' + v.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }
})();
