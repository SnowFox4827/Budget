import { state } from '../state.js';

export function renderSummary() {
    const totalCash = state.accounts.reduce((acc, a) => acc + a.balance, 0);
    const totalAlloc = state.allocations.reduce((acc, a) => acc + a.amount_available, 0);
    const totalTarget = state.allocations.reduce((acc, a) => acc + a.target_amount, 0);
    const unallocated = totalCash - totalAlloc;

    const cashEl = document.getElementById('sumTotalCash');
    const allocEl = document.getElementById('sumTotalAllocated');
    const unassignedEl = document.getElementById('sumUnassigned');

    if (cashEl) cashEl.textContent = `$${totalCash.toFixed(2)}`;
    if (allocEl) allocEl.textContent = `$${totalAlloc.toFixed(2)}`;
    if (unassignedEl) unassignedEl.textContent = `$${unallocated.toFixed(2)}`;
    
    // Status badges
    const statusContainer = document.getElementById('systemStatus');
    if (!statusContainer) return;

    if (unallocated < -0.01) {
        statusContainer.innerHTML = `<span class="badge danger" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">⚠️ Overallocated by $${Math.abs(unallocated).toFixed(2)}</span>`;
    } else if (unallocated > 0.01) {
        statusContainer.innerHTML = `<span class="badge warning" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">⚡ $${unallocated.toFixed(2)} ready to allocate</span>`;
    } else {
        statusContainer.innerHTML = `<span class="badge success" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">✓ All cash fully allocated</span>`;
    }
}
