// IIFE to keep the module internals private.
(function () {

    function money(n) {
        return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    }

    let lastSeries = null; // keep the last chart series so we can redraw on theme change
    let showMilestones = true; // whether milestone lines are drawn

    // Toggle milestone lines on/off, redraw if we have a chart.
    window.toggleMilestones = function () {
        showMilestones = !showMilestones;
        const btn = document.getElementById('ci-milestone-toggle');
        if (btn) btn.textContent = showMilestones ? 'Hide Milestones' : 'Show Milestones';
        if (window.ciChart) renderChart(lastSeries);
    };

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
        // Avoid stacking duplicate listeners across recalcs/theme changes.
        if (canvas._ciMove) canvas.removeEventListener('mousemove', canvas._ciMove);
        if (canvas._ciLeave) canvas.removeEventListener('mouseleave', canvas._ciLeave);
        canvas._ciMove = null;
        canvas._ciLeave = null;

        const labels = [];
        for (let i = 0; i < series.length; i++) labels.push('Year ' + i);

        // Pull theme colors from CSS variables if present.
        const css = getComputedStyle(document.documentElement);
        const accent = (css.getPropertyValue('--accent') || '#4a90d9').trim();
        const grid = (css.getPropertyValue('--border') || 'rgba(128,128,128,0.15)').trim();
        const tick = (css.getPropertyValue('--text') || '#666').trim();

        // Milestones crossed within range.
        const milestones = (showMilestones) ? milestonesFor(series) : [];

        // Hovered milestone (set by annotation enter/leave callbacks) so we can draw a year tooltip.
        let hoveredMs = null;
        const msToAnnotation = {};
        const annotations = {};
        for (const m of milestones) {
            if (m.value > series[series.length - 1]) continue; // skipped, never reached
            const key = m.label;
            const col = (m.value >= 1000000) ? '#c9a227' : '#2e9e5b';
            annotations[key] = {
                type: 'line',
                yMin: m.value,
                yMax: m.value,
                borderColor: col,
                borderWidth: 1.5,
                borderDash: [6, 5],
                borderDashOffset: 0,
                display: true,
                drawTime: 'afterDatasetsDraw',
                label: {
                    display: true,
                    content: m.label,
                    position: 'end',
                    color: col,
                    backgroundColor: 'transparent',
                    font: { weight: '600', size: 11 }
                },
                enter: function () {
                    hoveredMs = msToAnnotation[key];
                    showMilestoneTip();
                },
                leave: function () {
                    hoveredMs = null;
                    hideMilestoneTip();
                }
            };
            msToAnnotation[key] = { label: m.label, year: labels[m.year], value: m.value, col: col };
        }

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
                    },
                    annotation: { annotations: annotations }
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

        // ---- HTML milestone tooltip (follows the cursor) ----
        const tip = document.getElementById('ci-ms-tip');
        const wrap = canvas.closest('.calc-chart');
        // Precompute each milestone line's vertical pixel position for forgiving hover.
        const chartY = window.ciChart.scales.y;
        canvas._ciLines = milestones.map(function (m) {
            return { label: m.label, year: labels[m.year], pixel: chartY.getPixelForValue(m.value) };
        });

        const moveHandler = function (e) {
            const rect = wrap.getBoundingClientRect();
            const tx = e.clientX - rect.left;
            const ty = e.clientY - rect.top;
            if (!canvas._ciLines || canvas._ciLines.length === 0 || !showMilestones) {
                hideMilestoneTip();
                return;
            }
            // Forgiving hit test against each milestone line.
            let best = null;
            let bestD = 1e9;
            for (const ln of canvas._ciLines) {
                const d = Math.abs(ty - ln.pixel);
                if (d <= 16 && d < bestD) {
                    best = ln;
                    bestD = d;
                }
            }
            if (!best) {
                hideMilestoneTip();
                return;
            }
            tip.textContent = best.label + ' \u2192 ~' + best.year;
            tip.style.display = 'block';
            // Position near the cursor, kept inside the chart.
            const tw = tip.offsetWidth;
            const th = tip.offsetHeight;
            let left = tx + 14;
            let top = ty + 14;
            if (left + tw > rect.width - 4) left = tx - tw - 14;
            if (top + th > rect.height - 4) top = ty - th - 14;
            tip.style.left = left + 'px';
            tip.style.top = top + 'px';
        };
        canvas._ciMove = moveHandler;
        canvas.addEventListener('mousemove', moveHandler);
        canvas._ciLeave = function () {
            hideMilestoneTip();
        };
        canvas.addEventListener('mouseleave', canvas._ciLeave);

        function showMilestoneTip() {
            if (!tip || !hoveredMs) return;
            tip.textContent = hoveredMs.label + ' \u2192 ~' + hoveredMs.year;
            tip.style.display = 'block';
        }
        function hideMilestoneTip() {
            if (tip) tip.style.display = 'none';
        }
        if (tip) tip.style.display = 'none';
    }
})();
