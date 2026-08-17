let state = { accounts: [], allocations: [], transactions: [] };
let pendingTxData = null;
let allocationView = 'grid';
let accountView = 'grid';

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('trans-date').value = new Date().toISOString().split('T')[0];
    setAllocationView('grid');
    toggleAccountView('grid');
    fetchDashboard();

    // Event Listeners
    document.getElementById('alloc-account-filter').addEventListener('change', renderAllocations);
    document.getElementById('slice-search').addEventListener('keyup', filterTransactions);
    document.getElementById('slice-account').addEventListener('change', filterTransactions);
    document.getElementById('slice-allocation').addEventListener('change', filterTransactions);
    document.getElementById('slice-type').addEventListener('change', filterTransactions);
    document.getElementById('trans-account-select').addEventListener('change', populateTransAllocSelect);

    // Form Submissions
    document.getElementById('accountForm').addEventListener('submit', handleAccountSubmit);
    document.getElementById('editAccountForm').addEventListener('submit', handleEditAccountNameSubmit);
    document.getElementById('allocationForm').addEventListener('submit', handleAllocationSubmit);
    document.getElementById('transactionForm').addEventListener('submit', handleTransactionSubmit);
    document.getElementById('transferForm').addEventListener('submit', handleTransferSubmit);
});

async function fetchDashboard() {
    const res = await fetch('/api/dashboard');
    state = await res.json();
    renderSummary();
    renderAccounts();
    renderAllocations();
    renderTransactions();
    populateSelectOptions();
}

function renderSummary() {
    let netWorth = state.accounts.reduce((sum, a) => sum + a.balance, 0);
    let allocated = state.accounts.reduce((sum, a) => sum + a.allocated, 0);
    let unassigned = state.accounts.reduce((sum, a) => sum + a.unassigned, 0);

    document.getElementById('sum-networth').textContent = `$${netWorth.toFixed(2)}`;
    document.getElementById('sum-allocated').textContent = `$${allocated.toFixed(2)}`;
    document.getElementById('sum-unassigned').textContent = `$${unassigned.toFixed(2)}`;
}

function renderAccounts() {
    const container = document.getElementById('accounts-container');
    container.innerHTML = state.accounts.map(acc => `
        <div class="col-md-4">
            <div class="card shadow-sm border-0 h-100">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h5 class="fw-bold mb-0">${acc.name}</h5>
                        <div class="d-flex gap-2">
                            <button class="btn btn-link text-primary btn-sm p-0" onclick="showEditAccountNameModal(${acc.id})" title="Edit Account Name"><i class="bi bi-pencil-square"></i></button>
                            <button class="btn btn-link text-danger btn-sm p-0" onclick="deleteAccount(${acc.id})" title="Delete Account"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>
                    <div class="h4 text-primary fw-bold mb-3">$${acc.balance.toFixed(2)}</div>
                    <div class="d-flex justify-content-between small text-muted mb-1">
                        <span>Allocated:</span>
                        <span class="fw-semibold text-dark">$${acc.allocated.toFixed(2)}</span>
                    </div>
                    <div class="d-flex justify-content-between small text-muted">
                        <span>Unassigned:</span>
                        <span class="fw-semibold ${acc.unassigned < 0 ? 'text-danger' : 'text-success'}">$${acc.unassigned.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('') || '<p class="text-muted">No accounts added yet.</p>';

    const tbody = document.getElementById('accounts-list');
    tbody.innerHTML = state.accounts.map(acc => `
        <tr>
            <td class="fw-semibold">${acc.name}</td>
            <td class="text-end fw-bold text-primary">$${acc.balance.toFixed(2)}</td>
            <td class="text-end text-dark">$${acc.allocated.toFixed(2)}</td>
            <td class="text-end fw-semibold ${acc.unassigned < 0 ? 'text-danger' : 'text-success'}">$${acc.unassigned.toFixed(2)}</td>
            <td class="text-center">
                <div class="d-flex justify-content-center gap-2">
                    <button class="btn btn-link text-primary btn-sm p-0" onclick="showEditAccountNameModal(${acc.id})" title="Edit Account Name"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-link text-danger btn-sm p-0" onclick="deleteAccount(${acc.id})" title="Delete Account"><i class="bi bi-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="5" class="text-center text-muted py-3">No accounts added yet.</td></tr>';
}

function renderAllocations() {
    const filterAccId = document.getElementById('alloc-account-filter').value;
    const filteredAllocations = state.allocations.filter(al => !filterAccId || al.account_id == filterAccId);

    const container = document.getElementById('allocations-container');
    container.innerHTML = filteredAllocations.map(al => {
        let pct = al.target_amount > 0 ? Math.min(100, Math.round((al.amount_available / al.target_amount) * 100)) : 0;
        return `
            <div class="col-md-4">
                <div class="card shadow-sm border-0 h-100">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <h6 class="fw-bold mb-0">${al.name}</h6>
                            <div class="d-flex gap-2">
                                <button class="btn btn-link text-primary btn-sm p-0" onclick="showEditAllocationModal(${al.id})" title="Edit Allocation"><i class="bi bi-pencil-square"></i></button>
                                <button class="btn btn-link text-danger btn-sm p-0" onclick="deleteAllocation(${al.id})" title="Delete Allocation"><i class="bi bi-trash"></i></button>
                            </div>
                        </div>
                        <div class="badge bg-light text-secondary mb-2">${al.account_name || 'Unassigned Acc'}</div>
                        <div class="d-flex justify-content-between align-items-baseline mb-1">
                            <span class="h5 fw-bold text-dark mb-0">$${al.amount_available.toFixed(2)}</span>
                            <span class="small text-muted">Goal: $${al.target_amount.toFixed(2)}</span>
                        </div>
                        <div class="progress mb-2">
                            <div class="progress-bar ${pct >= 100 ? 'bg-success' : 'bg-primary'}" role="progressbar" style="width: ${pct}%"></div>
                        </div>
                        <div class="d-flex justify-content-between extra-small text-muted">
                            <span>${pct}% funded</span>
                            <span>${al.target_date ? 'Target: ' + al.target_date : ''}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('') || '<p class="text-muted">No allocations found for this filter.</p>';

    const tbody = document.getElementById('allocations-list');
    tbody.innerHTML = filteredAllocations.map(al => {
        let pct = al.target_amount > 0 ? Math.min(100, Math.round((al.amount_available / al.target_amount) * 100)) : 0;
        return `
            <tr>
                <td class="fw-semibold">${al.name}</td>
                <td><span class="badge bg-light text-dark">${al.account_name || 'Unassigned Acc'}</span></td>
                <td class="text-end fw-bold text-dark">$${al.amount_available.toFixed(2)}</td>
                <td class="text-end text-muted">$${al.target_amount.toFixed(2)}</td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <div class="progress flex-grow-1" style="height: 8px;">
                            <div class="progress-bar ${pct >= 100 ? 'bg-success' : 'bg-primary'}" role="progressbar" style="width: ${pct}%"></div>
                        </div>
                        <span class="small text-muted">${pct}%</span>
                    </div>
                </td>
                <td class="small">${al.target_date || '-'}</td>
                <td class="text-center">
                    <div class="d-flex justify-content-center gap-2">
                        <button class="btn btn-link text-primary btn-sm p-0" onclick="showEditAllocationModal(${al.id})" title="Edit Allocation"><i class="bi bi-pencil-square"></i></button>
                        <button class="btn btn-link text-danger btn-sm p-0" onclick="deleteAllocation(${al.id})" title="Delete Allocation"><i class="bi bi-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="7" class="text-center text-muted py-3">No allocations found for this filter.</td></tr>';

    applyAllocationView();
}

// --- View toggles ---
function setAllocationView(view) {
    allocView = view;
    document.getElementById('alloc-view-grid').classList.toggle('active', view === 'grid');
    document.getElementById('alloc-view-list').classList.toggle('active', view === 'list');
    applyAllocationView();
}

function applyAllocationView() {
    const grid = allocView === 'grid';
    document.getElementById('allocations-container').style.display = grid ? '' : 'none';
    document.getElementById('allocations-table-wrap').style.display = grid ? 'none' : '';
}

function toggleAccountView(view) {
    accountView = view;
    document.getElementById('acc-view-grid').classList.toggle('active', view === 'grid');
    document.getElementById('acc-view-list').classList.toggle('active', view === 'list');
    document.getElementById('accounts-container').style.display = view === 'grid' ? '' : 'none';
    document.getElementById('accounts-list-wrap').style.display = view === 'grid' ? 'none' : '';
}

function renderTransactions() {
    filterTransactions();
}

function filterTransactions() {
    const q = document.getElementById('slice-search').value.toLowerCase();
    const accId = document.getElementById('slice-account').value;
    const allocId = document.getElementById('slice-allocation').value;
    const type = document.getElementById('slice-type').value;

    const filtered = state.transactions.filter(t => {
        const matchQ = t.description.toLowerCase().includes(q);
        const matchAcc = !accId || t.account_id == accId;
        const matchAlloc = !allocId || t.allocation_id == allocId;
        const matchType = !type || t.type == type;
        return matchQ && matchAcc && matchAlloc && matchType;
    });

    const tbody = document.getElementById('transactions-list');
    tbody.innerHTML = filtered.map(t => `
        <tr>
            <td class="small">${t.date}</td>
            <td class="fw-semibold">${t.description}</td>
            <td><span class="badge bg-light text-dark">${t.account_name}</span></td>
            <td><span class="badge bg-light text-dark">${t.allocation_name || '-'}</span></td>
            <td>
                <span class="badge ${t.type === 'expense' ? 'badge-expense' : t.type === 'income' ? 'badge-income' : 'badge-transfer'}">
                    ${t.type.toUpperCase()}
                </span>
            </td>
            <td class="text-end fw-bold ${t.type === 'expense' ? 'text-danger' : t.type === 'income' ? 'text-success' : 'text-info'}">
                ${t.type === 'expense' ? '-' : t.type === 'income' ? '+' : ''}$${Math.abs(t.amount).toFixed(2)}
            </td>
            <td class="text-center">
                <div class="d-flex justify-content-center gap-2">
                    ${t.type !== 'transfer' ? `<button class="btn btn-link text-primary btn-sm p-0" onclick="showEditTransactionModal(${t.id})" title="Edit Transaction"><i class="bi bi-pencil-square"></i></button>` : ''}
                    <button class="btn btn-link text-danger btn-sm p-0" onclick="deleteTransaction(${t.id})" title="Delete Transaction"><i class="bi bi-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="7" class="text-center text-muted py-3">No matching transactions found.</td></tr>';
}

function populateSelectOptions() {
    const accOptions = state.accounts.map(a => `<option value="${a.id}">${a.name} ($${a.balance.toFixed(2)})</option>`).join('');
    document.getElementById('alloc-account-select').innerHTML = accOptions;
    document.getElementById('trans-account-select').innerHTML = accOptions;
    document.getElementById('transfer-acc-select').innerHTML = accOptions;
    
    document.getElementById('alloc-account-filter').innerHTML = '<option value="">All Accounts</option>' + state.accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

    document.getElementById('slice-account').innerHTML = '<option value="">All Accounts</option>' + accOptions;
    const allocOptions = state.allocations.map(al => `<option value="${al.id}">${al.name}</option>`).join('');
    document.getElementById('slice-allocation').innerHTML = '<option value="">All Allocations</option>' + allocOptions;

    populateTransAllocSelect();
    populateTransferEnvelopes();
}

function populateTransAllocSelect() {
    const accId = document.getElementById('trans-account-select').value;
    const allocs = state.allocations.filter(al => al.account_id == accId);
    document.getElementById('trans-alloc-select').innerHTML = '<option value="">(None / Unassigned)</option>' + allocs.map(al => `<option value="${al.id}">${al.name} ($${al.amount_available.toFixed(2)})</option>`).join('');
}

function populateTransferEnvelopes() {
    const accId = document.getElementById('transfer-acc-select').value;
    const allocs = state.allocations.filter(al => al.account_id == accId);
    const options = `<option value="unassigned_${accId}">Unassigned Pool</option>` + allocs.map(al => `<option value="${al.id}">${al.name} ($${al.amount_available.toFixed(2)})</option>`).join('');
    document.getElementById('transfer-from-select').innerHTML = options;
    document.getElementById('transfer-to-select').innerHTML = options;
}

// Modal Helpers
function showAddAccountModal() { 
    document.getElementById('acc-name').value = '';
    document.getElementById('acc-balance').value = '0.00';
    new bootstrap.Modal(document.getElementById('accountModal')).show(); 
}

function showEditAccountNameModal(id) {
    const acc = state.accounts.find(a => a.id === id);
    if (!acc) return;
    document.getElementById('edit-acc-id').value = acc.id;
    document.getElementById('edit-acc-name').value = acc.name;
    new bootstrap.Modal(document.getElementById('editAccountModal')).show();
}

function showAddAllocationModal() { 
    document.getElementById('alloc-id').value = '';
    document.getElementById('alloc-name').value = '';
    document.getElementById('alloc-target').value = '0.00';
    document.getElementById('alloc-avail').value = '0.00';
    document.getElementById('alloc-date').value = '';
    document.getElementById('allocationModalTitle').textContent = 'New Allocation';
    new bootstrap.Modal(document.getElementById('allocationModal')).show(); 
}

function showEditAllocationModal(id) {
    const al = state.allocations.find(a => a.id === id);
    if (!al) return;
    document.getElementById('alloc-id').value = al.id;
    document.getElementById('alloc-name').value = al.name;
    document.getElementById('alloc-target').value = al.target_amount;
    document.getElementById('alloc-avail').value = al.amount_available;
    document.getElementById('alloc-date').value = al.target_date || '';
    document.getElementById('alloc-account-select').value = al.account_id;
    document.getElementById('allocationModalTitle').textContent = 'Edit Allocation';
    new bootstrap.Modal(document.getElementById('allocationModal')).show();
}

function showAddTransactionModal() { 
    document.getElementById('trans-id').value = '';
    document.getElementById('trans-type').value = 'expense';
    document.getElementById('trans-desc').value = '';
    document.getElementById('trans-amount').value = '';
    document.getElementById('trans-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('transactionModalTitle').textContent = 'Log Transaction';
    new bootstrap.Modal(document.getElementById('transactionModal')).show(); 
}

function showEditTransactionModal(id) {
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
    new bootstrap.Modal(document.getElementById('transactionModal')).show();
}

function showTransferModal() { new bootstrap.Modal(document.getElementById('transferModal')).show(); }

function toggleTransType() {
    const type = document.getElementById('trans-type').value;
    document.getElementById('trans-alloc-wrapper').style.display = 'block';
}

// Submit Handlers
async function handleAccountSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('acc-name').value;
    const balance = document.getElementById('acc-balance').value;

    await fetch('/api/accounts', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, balance })
    });

    bootstrap.Modal.getInstance(document.getElementById('accountModal')).hide();
    fetchDashboard();
}

async function handleEditAccountNameSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-acc-id').value;
    const name = document.getElementById('edit-acc-name').value;
    const acc = state.accounts.find(a => a.id == id);
    if (!acc) return;

    await fetch(`/api/accounts/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, balance: acc.balance })
    });

    bootstrap.Modal.getInstance(document.getElementById('editAccountModal')).hide();
    fetchDashboard();
}

async function handleAllocationSubmit(e) {
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
        await fetch(`/api/allocations/${id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
    } else {
        await fetch('/api/allocations', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
    }

    bootstrap.Modal.getInstance(document.getElementById('allocationModal')).hide();
    fetchDashboard();
}

async function handleTransactionSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('trans-id').value;
    pendingTxData = {
        id: id || null,
        description: document.getElementById('trans-desc').value,
        amount: document.getElementById('trans-amount').value,
        date: document.getElementById('trans-date').value,
        account_id: document.getElementById('trans-account-select').value,
        allocation_id: document.getElementById('trans-alloc-select').value,
        type: document.getElementById('trans-type').value
    };

    const url = id ? `/api/transactions/${id}` : '/api/transactions';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
        method: method,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(pendingTxData)
    });

    const result = await res.json();
    if (!res.ok && result.error === 'OVERSPEND') {
        document.getElementById('overspend-msg').textContent = result.message;
        const accId = pendingTxData.account_id;
        const allocs = state.allocations.filter(al => al.account_id == accId && al.id != pendingTxData.allocation_id);
        
        document.getElementById('overspend-cover-select').innerHTML = 
            `<option value="unassigned">Unassigned Pool</option>` + 
            allocs.map(al => `<option value="${al.id}">${al.name} ($${al.amount_available.toFixed(2)})</option>`).join('');

        bootstrap.Modal.getInstance(document.getElementById('transactionModal')).hide();
        new bootstrap.Modal(document.getElementById('overspendModal')).show();
    } else {
        bootstrap.Modal.getInstance(document.getElementById('transactionModal')).hide();
        fetchDashboard();
    }
}

async function resolveOverspend() {
    const coverSource = document.getElementById('overspend-cover-select').value;
    pendingTxData.cover_from_alloc_id = coverSource;

    const url = pendingTxData.id ? `/api/transactions/${pendingTxData.id}` : '/api/transactions';
    const method = pendingTxData.id ? 'PUT' : 'POST';

    await fetch(url, {
        method: method,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(pendingTxData)
    });

    bootstrap.Modal.getInstance(document.getElementById('overspendModal')).hide();
    fetchDashboard();
}

async function handleTransferSubmit(e) {
    e.preventDefault();
    await fetch('/api/transfer-allocation', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            account_id: document.getElementById('transfer-acc-select').value,
            from_allocation_id: document.getElementById('transfer-from-select').value,
            to_allocation_id: document.getElementById('transfer-to-select').value,
            amount: document.getElementById('transfer-amount').value
        })
    });
    bootstrap.Modal.getInstance(document.getElementById('transferModal')).hide();
    fetchDashboard();
}

async function deleteAccount(id) {
    if(confirm('Delete account? This will also remove associated allocations.')) {
        await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
        fetchDashboard();
    }
}

async function deleteAllocation(id) {
    if(confirm('Delete allocation? Remaining funds will return to Unassigned Dollars.')) {
        await fetch(`/api/allocations/${id}`, { method: 'DELETE' });
        fetchDashboard();
    }
}

async function deleteTransaction(id) {
    if(confirm('Delete transaction log? This will undo its balance effect.')) {
        await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
        fetchDashboard();
    }
}
