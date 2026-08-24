import { state, uiState, ICONS, fmtMoney } from '../state.js';
import { openModal, closeModal } from '../modals.js';
import { createTransactionApi, updateTransactionApi, deleteTransactionApi, transferAllocationApi } from '../api.js';


export function renderTransactions() {
    filterTransactions();
}

export function filterTransactions() {
    const presetEl = document.getElementById('slice-date-preset');
    const qEl = document.getElementById('slice-search');
    const accEl = document.getElementById('slice-account');
    const allocEl = document.getElementById('slice-allocation');
    const typeEl = document.getElementById('slice-type');

    const preset = presetEl ? presetEl.value : '';
    const q = qEl ? qEl.value.toLowerCase().trim() : '';
    const accId = accEl ? accEl.value : '';
    const allocId = allocEl ? allocEl.value : '';
    const type = typeEl ? typeEl.value : '';

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    let dateFrom = '';
    let dateTo = '';

    if (preset === 'today') {
        const todayStr = fmt(now);
        dateFrom = todayStr;
        dateTo = todayStr;
    } else if (preset === 'this-month') {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        dateFrom = fmt(firstDay);
        dateTo = fmt(lastDay);
    } else if (preset === 'last-month') {
        const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
        dateFrom = fmt(firstDay);
        dateTo = fmt(lastDay);
    } else if (preset === 'this-year') {
        const firstDay = new Date(now.getFullYear(), 0, 1);
        const lastDay = new Date(now.getFullYear(), 11, 31);
        dateFrom = fmt(firstDay);
        dateTo = fmt(lastDay);
    }

    const filtered = state.transactions.filter(t => {
        const matchQ = (t.description || '').toLowerCase().includes(q);
        const matchAcc = !accId || t.account_id == accId;
        const matchAlloc = !allocId || t.allocation_id == allocId;
        const matchType = !type || t.type == type;
        const matchDateFrom = !dateFrom || (t.date && t.date >= dateFrom);
        const matchDateTo = !dateTo || (t.date && t.date <= dateTo);
        return matchQ && matchAcc && matchAlloc && matchType && matchDateFrom && matchDateTo;
    });

    // Sort newest first (descending date, descending id)
    filtered.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (dateB !== dateA) {
            return dateB.localeCompare(dateA);
        }
        return (b.id || 0) - (a.id || 0);
    });

    const tbody = document.getElementById('transactions-list');
    if (tbody) {
        tbody.innerHTML = filtered.map(t => `
            <tr>
                <td class="small">${t.date || '-'}</td>
                <td class="fw-semibold">${t.description || ''}</td>
                <td><span class="badge">${t.account_name || 'Account'}</span></td>
                <td><span class="badge">${t.allocation_name || '-'}</span></td>
                <td>
                    <span class="badge ${t.type === 'expense' ? 'badge-expense' : t.type === 'income' ? 'badge-income' : 'badge-transfer'}">
                        ${(t.type || '').toUpperCase()}
                    </span>
                </td>
                <td class="text-end fw-bold ${t.type === 'expense' || (t.type === 'transfer' && t.amount < 0) ? 'text-danger' : t.type === 'income' || (t.type === 'transfer' && t.amount > 0) ? 'text-success' : 'text-info'}">
                    ${t.type === 'expense' ? '-' : t.type === 'income' || (t.type === 'transfer' && t.amount > 0) ? '+' : t.type === 'transfer' ? '-' : ''}$${fmtMoney(Math.abs(t.amount || 0))}
                </td>
                <td class="text-center">
                    <div class="flex center gap-2">
                        ${t.type !== 'transfer' ? `<button class="btn-link text-primary" onclick="window.showEditTransactionModal(${t.id})" title="Edit Transaction">${ICONS.edit}</button>` : ''}
                        <button class="btn-link text-danger" onclick="window.deleteTransaction(${t.id})" title="Delete Transaction">${ICONS.trash}</button>
                    </div>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="7" class="empty">No matching transactions found.</td></tr>';
    }
}

export function populateSelectOptions() {
    const accOptions = state.accounts.map(a => `<option value="${a.id}">${a.name} ($${fmtMoney(a.balance)})</option>`).join('');
    
    // New Allocation must land in a real account, never the protected Unassigned pool.
    const allocRealOptions = state.accounts.filter(a => !a.is_system).map(a => `<option value="${a.id}">${a.name} ($${fmtMoney(a.balance)})</option>`).join('');

    const allocAccSelect = document.getElementById('alloc-account-select');
    const transAccSelect = document.getElementById('trans-account-select');
    const transAccTransfer = document.getElementById('transfer-acc-select');
    const allocFilter = document.getElementById('alloc-account-filter');
    const sliceAcc = document.getElementById('slice-account');
    const sliceAlloc = document.getElementById('slice-allocation');

    if (allocAccSelect) allocAccSelect.innerHTML = allocRealOptions;
    if (transAccSelect) transAccSelect.innerHTML = accOptions;
    if (transAccTransfer) transAccTransfer.innerHTML = accOptions;
    // Exclude the protected Unassigned (system) account from the allocations
    // slicer/filter so it isn't shown as a filterable amount.
    const realAccOptions = state.accounts.filter(a => !a.is_system).map(a => `<option value="${a.id}">${a.name} ($${fmtMoney(a.balance)})</option>`).join('');
    if (allocFilter) allocFilter.innerHTML = '<option value="">All Accounts</option>' + state.accounts.filter(a => !a.is_system).map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    if (sliceAcc) sliceAcc.innerHTML = '<option value="">All Accounts</option>' + realAccOptions;

    const allocOptions = state.allocations.map(al => `<option value="${al.id}">${al.name}</option>`).join('');
    if (sliceAlloc) sliceAlloc.innerHTML = '<option value="">All Allocations</option>' + allocOptions;

    populateTransAllocSelect();
}

export function populateTransAllocSelect() {
    const transAccSelect = document.getElementById('trans-account-select');
    if (!transAccSelect) return;
    const accId = transAccSelect.value;
    const allocs = state.allocations.filter(al => al.account_id == accId);
    const transAllocSelect = document.getElementById('trans-alloc-select');
    if (transAllocSelect) {
        transAllocSelect.innerHTML = '<option value="">(None / Unassigned)</option>' + allocs.map(al => `<option value="${al.id}">${al.name} ($${fmtMoney(al.amount_available)})</option>`).join('');
    }
}

export function showAddTransactionModal() {
    document.getElementById('trans-id').value = '';
    document.getElementById('trans-type').value = 'expense';
    document.getElementById('trans-desc').value = '';
    document.getElementById('trans-amount').value = '';
    document.getElementById('trans-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('transactionModalTitle').textContent = 'Log Transaction';
    toggleTransType();
    openModal('transactionModal');
}

export function showEditTransactionModal(id) {
    const t = state.transactions.find(tx => tx.id === id);
    if (!t) return;
    document.getElementById('trans-id').value = t.id;
    document.getElementById('trans-type').value = t.type;
    document.getElementById('trans-desc').value = t.description;
    document.getElementById('trans-amount').value = Math.abs(t.amount);
    document.getElementById('trans-date').value = t.date;
    document.getElementById('trans-account-select').value = t.account_id;

    populateTransAllocSelect();
    document.getElementById('trans-alloc-select').value = t.allocation_id || '';

    document.getElementById('transactionModalTitle').textContent = 'Edit Transaction';
    toggleTransType();
    openModal('transactionModal');
}

export function toggleTransType() {
    const type = document.getElementById('trans-type').value;
    const accWrapper = document.getElementById('trans-acc-wrapper');
    const allocWrapper = document.getElementById('trans-alloc-wrapper');
    const descGroup = document.getElementById('trans-desc-group');
    const dateGroup = document.getElementById('trans-date-group');
    const fromGroup = document.getElementById('trans-from-group');
    const toGroup = document.getElementById('trans-to-group');
    const show = (el, on) => { if (el) el.style.display = on ? 'block' : 'none'; };

    // Fields hidden for a given type must NOT carry `required`, or the browser
    // blocks the whole form with "An invalid form control is not focusable".
    // Each field's `required` flag is set to match whether it is currently visible.
    const setRequired = (id, isVisible) => {
        const el = document.getElementById(id);
        if (el) el.required = isVisible;
    };

    if (type === 'transfer') {
        show(accWrapper, false);
        show(allocWrapper, false);
        show(descGroup, false);
        show(dateGroup, false);
        show(fromGroup, true);
        show(toGroup, true);

        setRequired('trans-account-select', false);
        setRequired('trans-desc', false);
        setRequired('trans-date', false);
        setRequired('trans-from-select', true);
        setRequired('trans-to-select', true);
        populateTransactionTransferEnvelopes();
    } else {
        const isIncome = type === 'income';
        show(accWrapper, !isIncome);
        show(allocWrapper, !isIncome);
        show(descGroup, !isIncome);
        show(dateGroup, true);
        show(fromGroup, false);
        show(toGroup, false);

        setRequired('trans-account-select', !isIncome);
        setRequired('trans-desc', !isIncome);
        setRequired('trans-date', true);
    }
}

// Build cross-account From/To options for the transaction modal's Transfer type.
export function populateTransactionTransfers() {
    const fromSelect = document.getElementById('trans-from-select');
    const toSelect = document.getElementById('trans-to-select');
    if (!fromSelect || !toSelect) return;
    const unassignedAcc = state.accounts.find(a => a.is_system);
    const unassignedValue = unassignedAcc ? `unassigned_${unassignedAcc.id}` : 'unassigned';
    const unassignedOption = `<option value="${unassignedValue}">Unassigned Dollars ($${fmtMoney(unassignedAcc ? unassignedAcc.balance : 0)})</option>`;
    let grouped = unassignedOption;
    state.accounts.filter(a => !a.is_system).forEach(acc => {
        const allocs = state.allocations.filter(al => al.account_id == acc.id);
        grouped += `<optgroup label="${acc.name}">` + allocs.map(al => `<option value="${al.id}">${al.name} ($${fmtMoney(al.amount_available)})</option>`).join('') + '</optgroup>';
    });
    fromSelect.innerHTML = grouped;
    toSelect.innerHTML = grouped;
}

export function populateTransactionTransferEnvelopes() {
    populateTransactionTransfers();
}

export async function handleTransactionSubmit(e, fetchDashboard) {
    e.preventDefault();
    const id = document.getElementById('trans-id').value;
    const type = document.getElementById('trans-type').value;

    // Transfer is handled by the dedicated transfer endpoint, which moves money
    // across accounts/envelopes AND records a transfer transaction row.
    if (type === 'transfer') {
        const fromVal = document.getElementById('trans-from-select').value;
        const toVal = document.getElementById('trans-to-select').value;
        const destAlloc = !(toVal || '').toString().startsWith('unassigned')
            ? state.allocations.find(a => a.id == toVal)
            : null;
        const destAccountId = destAlloc ? destAlloc.account_id : '';
        const result = await transferAllocationApi({
            from_allocation_id: fromVal,
            to_allocation_id: toVal,
            amount: document.getElementById('trans-amount').value,
            account_id: destAccountId
        });
        if (result && result.success) {
            closeModal('transactionModal');
            fetchDashboard();
        }
        return;
    }

    const isIncome = type === 'income';
    const unassignedAcc = state.accounts.find(a => a.is_system);
    uiState.pendingTxData = {
        id: id || null,
        description: document.getElementById('trans-desc').value,
        amount: document.getElementById('trans-amount').value,
        date: document.getElementById('trans-date').value,
        account_id: isIncome ? (unassignedAcc ? unassignedAcc.id : document.getElementById('trans-account-select').value) : document.getElementById('trans-account-select').value,
        allocation_id: isIncome ? '' : document.getElementById('trans-alloc-select').value,
        type
    };

    let result;
    if (id) {
        result = await updateTransactionApi(id, uiState.pendingTxData);
    } else {
        result = await createTransactionApi(uiState.pendingTxData);
    }

    if (!result.ok && result.data && result.data.error === 'OVERSPEND') {
        const msgEl = document.getElementById('overspend-msg');
        if (msgEl) msgEl.textContent = result.data.message;
        const accId = uiState.pendingTxData.account_id;
        const allocs = state.allocations.filter(al => al.account_id == accId && al.id != uiState.pendingTxData.allocation_id);

        const coverSelect = document.getElementById('overspend-cover-select');
        if (coverSelect) {
            coverSelect.innerHTML =
                `<option value="unassigned">Unassigned Pool</option>` +
                allocs.map(al => `<option value="${al.id}">${al.name} ($${fmtMoney(al.amount_available)})</option>`).join('');
        }

        closeModal('transactionModal');
        openModal('overspendModal');
    } else {
        closeModal('transactionModal');
        fetchDashboard();
    }
}

export async function resolveOverspend(fetchDashboard) {
    const coverSource = document.getElementById('overspend-cover-select').value;
    if (coverSource) {
        uiState.pendingTxData.cover_from_alloc_id = coverSource;
    }

    if (uiState.pendingTxData.id) {
        await updateTransactionApi(uiState.pendingTxData.id, uiState.pendingTxData);
    } else {
        await createTransactionApi(uiState.pendingTxData);
    }

    closeModal('overspendModal');
    fetchDashboard();
}

export async function deleteTransaction(id, fetchDashboard) {
    if (confirm('Delete transaction log? This will undo its balance effect.')) {
        await deleteTransactionApi(id);
        fetchDashboard();
    }
}
