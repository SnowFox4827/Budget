import { state, uiState, ICONS } from '../state.js';
import { openModal, closeModal } from '../modals.js';
import { createAllocationApi, updateAllocationApi, deleteAllocationApi, transferAllocationApi } from '../api.js';

export function renderAllocations() {
    const filterAccId = document.getElementById('alloc-account-filter') ? document.getElementById('alloc-account-filter').value : '';
    const filteredAllocations = state.allocations.filter(al => !filterAccId || al.account_id == filterAccId);

    const container = document.getElementById('allocations-container');
    if (container) {
        container.innerHTML = filteredAllocations.map(al => {
            let pct = al.target_amount > 0 ? Math.min(100, Math.round((al.amount_available / al.target_amount) * 100)) : 0;
            return `
                <div class="card h-100">
                    <div class="card-body">
                        <div class="flex between align-center mb-1">
                            <h6 class="alloc-name">${al.name}</h6>
                            <div class="flex gap-2">
                                <button class="btn-link text-primary" onclick="window.showEditAllocationModal(${al.id})" title="Edit Allocation">${ICONS.edit}</button>
                                <button class="btn-link text-danger" onclick="window.deleteAllocation(${al.id})" title="Delete Allocation">${ICONS.trash}</button>
                            </div>
                        </div>
                        <span class="badge mb-2">${al.account_name || 'Unassigned Acc'}</span>
                        <div class="flex between align-baseline mb-1">
                            <span class="alloc-avail">$${al.amount_available.toFixed(2)}</span>
                            <span class="goal">Goal: $${al.target_amount.toFixed(2)}</span>
                        </div>
                        <div class="progress mb-2">
                            <div class="progress-bar ${pct >= 100 ? 'done' : ''}" style="width: ${pct}%"></div>
                        </div>
                        <div class="flex between extra-small text-muted">
                            <span>${pct}% funded</span>
                            <span>${al.target_date ? 'Target: ' + al.target_date : ''}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('') || '<p class="text-muted">No allocations found for this filter.</p>';
    }

    const tbody = document.getElementById('allocations-list');
    if (tbody) {
        tbody.innerHTML = filteredAllocations.map(al => {
            let pct = al.target_amount > 0 ? Math.min(100, Math.round((al.amount_available / al.target_amount) * 100)) : 0;
            return `
                <tr>
                    <td class="fw-semibold">${al.name}</td>
                    <td><span class="badge">${al.account_name || 'Unassigned Acc'}</span></td>
                    <td class="text-end fw-bold text-dark">$${al.amount_available.toFixed(2)}</td>
                    <td class="text-end text-muted">$${al.target_amount.toFixed(2)}</td>
                    <td>
                        <div class="flex gap-2 align-center">
                            <div class="progress progress-sm progress-inline">
                                <div class="progress-bar ${pct >= 100 ? 'done' : ''}" style="width: ${pct}%"></div>
                            </div>
                            <span class="small text-muted">${pct}%</span>
                        </div>
                    </td>
                    <td class="small">${al.target_date || '-'}</td>
                    <td class="text-center">
                        <div class="flex center gap-2">
                            <button class="btn-link text-primary" onclick="window.showEditAllocationModal(${al.id})" title="Edit Allocation">${ICONS.edit}</button>
                            <button class="btn-link text-danger" onclick="window.deleteAllocation(${al.id})" title="Delete Allocation">${ICONS.trash}</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="7" class="empty">No allocations found for this filter.</td></tr>';
    }

    applyAllocationView();
}

export function setAllocationView(view) {
    uiState.allocationView = view;
    applyAllocationView();
}

export function applyAllocationView() {
    const isGrid = uiState.allocationView === 'grid';
    const gridBtn = document.getElementById('alloc-view-grid');
    const listBtn = document.getElementById('alloc-view-list');
    if (gridBtn) gridBtn.classList.toggle('active', isGrid);
    if (listBtn) listBtn.classList.toggle('active', !isGrid);

    const container = document.getElementById('allocations-container');
    const tableWrap = document.getElementById('allocations-table-wrap');
    if (container) container.style.display = isGrid ? '' : 'none';
    if (tableWrap) tableWrap.style.display = isGrid ? 'none' : '';
}

export function populateTransferEnvelopes() {
    const accSelect = document.getElementById('transfer-acc-select');
    if (!accSelect) return;
    // One of the "envelopes" you can move money to/from is Unassigned Dollars,
    // which is a real, protected account.
    const unassignedAcc = state.accounts.find(a => a.is_system);
    const unassignedValue = unassignedAcc ? `unassigned_${unassignedAcc.id}` : 'unassigned';
    const unassignedOption = unassignedAcc
        ? `<option value="${unassignedValue}">Unassigned Dollars ($${unassignedAcc.balance.toFixed(2)})</option>`
        : '<option value="unassigned">Unassigned Dollars</option>';

    const accId = accSelect.value;
    const allocs = state.allocations.filter(al => al.account_id == accId);
    const options = unassignedOption + allocs.map(al => `<option value="${al.id}">${al.name} ($${al.amount_available.toFixed(2)})</option>`).join('');
    
    const fromSelect = document.getElementById('transfer-from-select');
    const toSelect = document.getElementById('transfer-to-select');
    if (fromSelect) fromSelect.innerHTML = options;
    if (toSelect) toSelect.innerHTML = options;
}

export function showAddAllocationModal() {
    document.getElementById('alloc-id').value = '';
    document.getElementById('alloc-name').value = '';
    document.getElementById('alloc-target').value = '0.00';
    document.getElementById('alloc-avail').value = '0.00';
    document.getElementById('alloc-date').value = '';
    // Default to the first real (non-Unassigned) account so assigned money lands
    // in a user's account by default, not the hidden Unassigned pool.
    const accSel = document.getElementById('alloc-account-select');
    const realAcc = state.accounts.find(a => !a.is_system);
    if (accSel) accSel.value = (realAcc ? realAcc.id : (state.accounts[0] ? state.accounts[0].id : ''));
    document.getElementById('allocationModalTitle').textContent = 'New Allocation';
    openModal('allocationModal');
}

export function showEditAllocationModal(id) {
    const al = state.allocations.find(a => a.id === id);
    if (!al) return;
    document.getElementById('alloc-id').value = al.id;
    document.getElementById('alloc-name').value = al.name;
    document.getElementById('alloc-target').value = al.target_amount;
    document.getElementById('alloc-avail').value = al.amount_available;
    document.getElementById('alloc-date').value = al.target_date || '';
    document.getElementById('alloc-account-select').value = al.account_id;
    document.getElementById('allocationModalTitle').textContent = 'Edit Allocation';
    openModal('allocationModal');
}

export function showTransferModal() {
    openModal('transferModal');
}

export async function handleAllocationSubmit(e, fetchDashboard) {
    e.preventDefault();
    const id = document.getElementById('alloc-id').value;
    const payload = {
        name: document.getElementById('alloc-name').value,
        target_amount: document.getElementById('alloc-target').value,
        amount_available: document.getElementById('alloc-avail').value,
        target_date: document.getElementById('alloc-date').value,
        account_id: document.getElementById('alloc-account-select').value
    };

    if (id) {
        await updateAllocationApi(id, payload);
    } else {
        await createAllocationApi(payload);
    }

    closeModal('allocationModal');
    fetchDashboard();
}

export async function handleTransferSubmit(e, fetchDashboard) {
    e.preventDefault();
    await transferAllocationApi({
        account_id: document.getElementById('transfer-acc-select').value,
        from_allocation_id: document.getElementById('transfer-from-select').value,
        to_allocation_id: document.getElementById('transfer-to-select').value,
        amount: document.getElementById('transfer-amount').value
    });
    closeModal('transferModal');
    fetchDashboard();
}

export async function deleteAllocation(id, fetchDashboard) {
    if (confirm('Delete allocation? Remaining funds will return to Unassigned Dollars.')) {
        await deleteAllocationApi(id);
        fetchDashboard();
    }
}
