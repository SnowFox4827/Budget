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
    };
})();
