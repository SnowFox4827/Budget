// IIFE to keep the module internals private.
(function () {

    function money(n) {
        return Number(n).toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: (Math.abs(n) >= 10000) ? 0 : 2
        });
    }

    let lastBalance = null;      // latest computed mortgage balance curve
    let lastSchedule = [];       // latest amortization schedule rows
    let viewMode = 'balance';    // balance | breakdown | amort

    // ---- field helpers -----------------------------------------------------
    const $ = id => document.getElementById(id);
    const val = (id, d) => { const v = parseFloat($(id) && $(id).value); return isNaN(v) ? d : v; };

    // ---- down payment price/percent sync -----------------------------------
    function syncDownPct() {
        const home = val('mort-homeValue', 0);
        const down = val('mort-downPayment', 0);
        if (home > 0) $('mort-downPct').value = (down / home * 100).toFixed(1);
    }
    function syncDownDollar() {
        const home = val('mort-homeValue', 0);
        const pct = val('mort-downPct', 0);
        if (home > 0) $('mort-downPayment').value = Math.round(home * pct / 100);
    }
    ['mort-homeValue', 'mort-downPayment'].forEach(id => {
        document.getElementById(id).addEventListener('input', syncDownPct);
    });
    $('mort-downPct').addEventListener('input', syncDownDollar);

    // ---- calculation --------------------------------------------------------
    window.calcMortgage = function () {
        const home = val('mort-homeValue', 0);
        let down = val('mort-downPayment', 0);
        const termYears = val('mort-term', 30);
        const rate = val('mort-rate', 0);
        const annualTax = val('mort-tax', 0);
        const annualIns = val('mort-insurance', 0);
        const hoaMonthly = val('mort-hoa', 0);

        if (home <= 0) { alert('Please enter a valid home value.'); return; }
        if (down < 0) down = 0;
        const principal = Math.max(home - down, 0);

        const n = 12;                                  // monthly payments
        const r = rate / 100 / n;
        const months = Math.round(termYears * n);

        let pi;                                        // principal + interest only
        if (r === 0) {
            pi = principal / months;
        } else {
            pi = principal * r / (1 - Math.pow(1 + r, -months));
        }
        const taxIns = (annualTax + annualIns) / 12;
        const totalMonthly = pi + taxIns + hoaMonthly;
        const totalInterest = pi * months - principal;
        const totalCost = principal + totalInterest + taxIns * months + hoaMonthly * months;

        // ---- summary (readout, adds-up style like the CI calculator) ------------
        const monthlyTaxIns = (annualTax + annualIns) / 12;
        let out = '';
        out += '<div class="readout-label">Monthly payment</div>';
        out += '<div class="calc-line"><span class="text-soft">Principal &amp; Interest</span>' + money(pi) + '</div>';
        out += '<div class="calc-line"><span class="text-soft">+ Taxes &amp; Insurance</span>' + money(monthlyTaxIns) + '</div>';
        if (hoaMonthly > 0) {
            out += '<div class="calc-line"><span class="text-soft">+ HOA</span>' + money(hoaMonthly) + '</div>';
        }
        out += '<div class="calc-line"><span class="text-soft">Monthly payment</span><strong>' + money(totalMonthly) + '</strong></div>';

        out += '<div class="readout-label">Over the full ' + termYears + '-year loan</div>';
        out += '<div class="calc-line"><span class="text-soft">Loan amount</span>' + money(principal) + '</div>';
        out += '<div class="calc-line"><span class="text-soft">+ Total interest</span>' + money(totalInterest) + '</div>';
        const taxInsTotal = monthlyTaxIns * months;
        out += '<div class="calc-line"><span class="text-soft">+ Taxes &amp; Insurance</span>' + money(taxInsTotal) + '</div>';
        if (hoaMonthly > 0) {
            out += '<div class="calc-line"><span class="text-soft">+ HOA</span>' + money(hoaMonthly * months) + '</div>';
        }
        out += '<div class="calc-line"><span class="text-soft">Total cost</span><strong>' + money(totalCost) + '</strong></div>';

        // ---- salary needed for the 25% housing rule --------------------------
        const takeHome = parseFloat($('mort-takehome').value);
        const target25 = totalMonthly / 0.25; // required monthly take-home for <=25%
        if (!isNaN(takeHome) && takeHome > 0) {
            const ratio = totalMonthly / takeHome;
            const ok = ratio <= 0.25;
            out += '<div class="readout-label">Affordability (25% rule)</div>';
            out += '<div class="calc-line"><span class="text-soft">Monthly payment</span>' + money(totalMonthly) + '</div>';
            out += '<div class="calc-line"><span class="text-soft">Your take-home</span>' + money(takeHome) + '</div>';
            out += '<div class="calc-line"><span class="text-soft">% of take-home</span><strong>' + (ratio * 100).toFixed(1) + '%</strong></div>';
            out += '<div class="calc-line" style="margin-top:6px"><span class="text-soft">' + (ok ? '✓ Within' : 'Over') + ' 25%</span><strong style="color:' + (ok ? 'var(--green, #22c55e)' : 'var(--red, #ef4444)') + '">' + (ok ? 'Affordable' : 'Too much') + '</strong></div>';
            if (!ok) {
                out += '<div class="calc-line"><span class="text-soft">Take-home needed</span><strong>' + money(target25) + '/mo</strong></div>';
            }
        } else {
            out += '<div class="readout-label">Affordability (25% rule)</div>';
            out += '<div class="calc-line"><span class="text-soft">Take-home needed</span><strong>' + money(target25) + '/mo</strong></div>';
            out += '<div class="calc-line"><span class="text-soft">Take-home needed</span>' + money(target25 * 12) + '/yr</div>';
        }
        document.getElementById('mort-readout').innerHTML = out;

        // ---- build amortization schedule + yearly balance curve ---------------
        const table = [];
        let bal = principal;
        const yearlyBal = [principal];
        let ts = 0, iPaid = 0, pPaid = 0;
        for (let m = 1; m <= months; m++) {
            const interest = bal * r;
            const toPrincipal = pi - interest;
            bal = Math.max(bal - toPrincipal, 0);
            ts += pi; iPaid += interest; pPaid += toPrincipal;
            if (m % 12 === 0 || m === months) {
                yearlyBal.push(bal);
            }
            table.push({
                mo: m,
                payment: pi,
                principal: toPrincipal,
                interest: interest,
                balance: bal
            });
        }
        lastBalance = yearlyBal;
        lastSchedule = table;

        // ---- render whatever view is active -------------------------------------
        renderChart(yearlyBal);
        renderAmort(table);
        // The view tabs decide which is shown; if user was on breakdown/amort, keep it.
        if (viewMode === 'breakdown') mortgageView('breakdown');
        else if (viewMode === 'amort') mortgageView('amort');
    };

    // ---- view switching ---------------------------------------------------------
    window.mortgageView = function (mode) {
        viewMode = mode;
        document.querySelectorAll('.mortgage-view-tabs .view-tab').forEach(b =>
            b.classList.toggle('active', b.dataset.view === mode)
        );

        if (lastBalance == null) calcMortgage();

        if (mode === 'breakdown') {
            // Show the container FIRST so the doughnut is not drawn on a hidden canvas.
            $('mort-chart-wrap').style.display = 'block';
            $('mort-amort-wrap').style.display = 'none';
            renderBreakdown();
        } else if (mode === 'amort') {
            $('mort-chart-wrap').style.display = 'none';
            $('mort-amort-wrap').style.display = 'block';
            if (lastSchedule.length) renderAmort(lastSchedule);
        } else { // balance
            $('mort-chart-wrap').style.display = 'block';
            $('mort-amort-wrap').style.display = 'none';
            renderChart(lastBalance);
        }
    };

    // ---- chart helpers ------------------------------------------------------------
    function themeColors() {
        const css = getComputedStyle(document.documentElement);
        return {
            accent: (css.getPropertyValue('--accent') || '#4a90d9').trim(),
            grid: (css.getPropertyValue('--border') || 'rgba(128,128,128,0.15)').trim(),
            tick: (css.getPropertyValue('--text') || '#666').trim(),
            surface: (css.getPropertyValue('--surface') || '#111111').trim()
        };
    }

    function getCanvas() {
        const canvas = document.getElementById('mortChart');
        return canvas ? canvas : null;
    }
    function destroyChart() {
        const canvas = getCanvas();
        if (canvas && window.mortChart instanceof Chart) window.mortChart.destroy();
    }

    // Balance-over-time line chart.
    function renderChart(yearly) {
        const canvas = getCanvas();
        if (!canvas || typeof Chart === 'undefined' || !yearly) return;
        destroyChart();
        const colors = themeColors();
        const labels = yearly.map((_, i) => (i === 0 ? 'Start' : 'Yr ' + i));
        window.mortChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Remaining Balance',
                    data: yearly,
                    borderColor: colors.accent,
                    backgroundColor: colors.accent + '22',
                    fill: true,
                    tension: 0.25,
                    pointRadius: 1.5,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: colors.surface,
                        titleColor: colors.tick,
                        bodyColor: colors.tick,
                        borderColor: colors.grid,
                        borderWidth: 1,
                        callbacks: {
                            label: function (ctx) { return money(ctx.parsed.y); }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: colors.tick, maxTicksLimit: 15 },
                        grid: { color: colors.grid }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: colors.tick,
                            callback: v => money(v)
                        },
                        grid: { color: colors.grid }
                    }
                }
            }
        });
    }

    // Pie breakdown: principal, interest, taxes, insurance, HOA.
    function renderBreakdown() {
        if (lastBalance == null) { calcMortgage(); return; }
        const home = val('mort-homeValue', 0);
        const down = val('mort-downPayment', 0);
        const principal = Math.max(home - down, 0);
        const rate = val('mort-rate', 0);
        const termYears = val('mort-term', 30);
        const annualTax = val('mort-tax', 0);
        const annualIns = val('mort-insurance', 0);
        const hoaMonthly = val('mort-hoa', 0);
        const r = rate / 100 / 12;
        const months = Math.round(termYears * 12);
        const pi = r === 0
            ? principal / months
            : principal * r / (1 - Math.pow(1 + r, -months));
        const totalInterest = pi * months - principal;
        const taxtotal = annualTax * termYears;
        const instotal = annualIns * termYears;
        const hoatotal = hoaMonthly * months;

        const canvas = getCanvas();
        if (!canvas || typeof Chart === 'undefined') return;
        destroyChart();
        const colors = themeColors();
        const palette = [colors.accent, '#e5484d', '#c9a227', '#2e9e5b', '#9b6ee6'];
        window.mortChart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['Principal', 'Interest', 'Property Tax', 'Insurance', 'HOA'],
                datasets: [{
                    data: [principal, totalInterest, taxtotal, instotal, hoatotal],
                    backgroundColor: palette,
                    borderWidth: 2,
                    borderColor: colors.surface
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: colors.tick, boxWidth: 12, padding: 8 }
                    },
                    tooltip: {
                        backgroundColor: colors.surface,
                        titleColor: colors.tick,
                        bodyColor: colors.tick,
                        borderColor: colors.grid,
                        borderWidth: 1,
                        callbacks: {
                            label: ctx => ctx.label + ': ' + money(ctx.parsed)
                        }
                    }
                }
            }
        });
    }

    // Monthly amortization table.
    function renderAmort(table) {
        const wrap = $('mort-amort-table');
        if (!wrap) return;
        const colors = themeColors();
        let head = '<thead><tr>' +
            '<th>Month</th><th>Payment</th><th>Principal</th><th>Interest</th><th>Balance</th>' +
            '</tr></thead>';
        let body = '<tbody>';
        for (const row of table) {
            body += '<tr>' +
                '<td>' + row.mo + '</td>' +
                '<td>' + money(row.payment) + '</td>' +
                '<td>' + money(row.principal) + '</td>' +
                '<td>' + money(row.interest) + '</td>' +
                '<td>' + money(row.balance) + '</td>' +
                '</tr>';
        }
        body += '</tbody>';
        wrap.innerHTML = head + body;
    }

    // Redraw the chart with fresh colors when the theme flips.
    document.addEventListener('theme-changed', function () {
        if (lastBalance == null) return;
        if (viewMode === 'breakdown') renderBreakdown();
        else if (viewMode === 'amort') renderAmort(lastSchedule);
        else renderChart(lastBalance);
    });

    // Default view: run a first calculation so the tab isn't empty.
    if (document.getElementById('mort-homeValue')) calcMortgage();

})();
