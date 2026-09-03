import { state, fmtMoney } from '../state.js';

export function renderSummary() {
    const activeAccounts = state.accounts.filter(a => !a.is_deleted);
    const activeAllocations = state.allocations.filter(al => !al.is_deleted);
    const totalCash = activeAccounts.reduce((acc, a) => acc + a.balance, 0);
    const totalAlloc = activeAllocations.reduce((acc, a) => acc + a.amount_available, 0);
    const totalTarget = activeAllocations.reduce((acc, a) => acc + a.target_amount, 0);
    // Unassigned Dollars live in their own protected account.
    const unassignedAcc = activeAccounts.find(a => a.is_system);
    const unallocated = unassignedAcc ? unassignedAcc.balance : (totalCash - totalAlloc);

    const cashEl = document.getElementById('sum-networth');
    const allocEl = document.getElementById('sum-allocated');
    const unassignedEl = document.getElementById('sum-unassigned');

    if (cashEl) cashEl.textContent = `$${fmtMoney(totalCash)}`;
    if (allocEl) allocEl.textContent = `$${fmtMoney(totalAlloc)}`;
    if (unassignedEl) unassignedEl.textContent = `$${fmtMoney(unallocated)}`;
    
    // Status badges
    const statusContainer = document.getElementById('systemStatus');
    if (!statusContainer) return;

    if (unallocated < -0.01) {
        statusContainer.innerHTML = `<span class="badge danger" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">⚠️ Overallocated by $${fmtMoney(Math.abs(unallocated))}</span>`;
    } else if (unallocated > 0.01) {
        statusContainer.innerHTML = `<span class="badge warning" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">⚡ $${fmtMoney(unallocated)} ready to allocate</span>`;
    } else {
        statusContainer.innerHTML = `<span class="badge success" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">✓ All cash fully allocated</span>`;
    }
}
