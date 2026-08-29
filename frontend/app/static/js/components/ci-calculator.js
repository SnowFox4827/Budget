// IIFE to keep the module internals private.
(function () {

    function money(n) {
        return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    }

    // Update the rate label as the slider moves.
    window.updateRate = function () {
        const rateEl = document.getElementById('ci-rate');
        const label = document.getElementById('ci-rate-label');
        if (rateEl && label) {
            label.textContent = rateEl.value + '%';
        }
    };

    // Compute compound interest: A = P * (1 + r/n)^(n*t)
    window.compInterest = function () {
        const principalEl = document.getElementById('ci-principal');
        const rateEl = document.getElementById('ci-rate');
        const yearsEl = document.getElementById('ci-years');
        const compoundEl = document.getElementById('ci-compound');
        const resultEl = document.getElementById('ci-result');

        if (!principalEl || !rateEl || !yearsEl || !compoundEl || !resultEl) return;

        const principal = parseFloat(principalEl.value);
        const rate = parseFloat(rateEl.value);
        const years = parseFloat(yearsEl.value);
        const n = parseInt(compoundEl.value, 10);

        if (isNaN(principal) || principal <= 0) {
            resultEl.innerHTML = '<div class="alert-error">Please enter a valid principal amount greater than 0.</div>';
            return;
        }
        if (isNaN(years) || years <= 0) {
            resultEl.innerHTML = '<div class="alert-error">Please enter a valid number of years (1 or more).</div>';
            return;
        }

        const rn = rate / 100 / n;
        const amount = principal * Math.pow(1 + rn, n * years);

        resultEl.innerHTML =
            '<div class="calc-line"><span class="text-soft">Final amount</span><strong>' + money(amount) + '</strong></div>' +
            '<div class="calc-line"><span class="text-soft">Principal</span>' + money(principal) + '</div>' +
            '<div class="calc-line"><span class="text-soft">Interest earned</span>' + money(amount - principal) + '</div>';

        renderChart(principal, rn, n, years);
    };

    // Draw the year-by-year growth curve.
    function renderChart(principal, rn, n, years) {
        const canvas = document.getElementById('ci-chart');
        if (!canvas || typeof Chart === 'undefined') return;

        const nyears = Math.max(1, Math.ceil(years));
        const labels = [];
        const data = [];
        for (let y = 0; y <= nyears; y++) {
            labels.push('Year ' + y);
            data.push(principal * Math.pow(1 + rn, n * y));
        }

        if (window.ciChart instanceof Chart) {
            window.ciChart.destroy();
        }

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
                    data: data,
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
