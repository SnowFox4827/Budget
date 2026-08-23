import { state, uiState, ICONS } from '../state.js';
import { openModal, closeModal } from '../modals.js';
import { createAccountApi, updateAccountApi, deleteAccountApi } from '../api.js';

export function renderAccounts() {
    const container = document.getElementById('accounts-container');
    if (container) {
        container.innerHTML = state.accounts.map(acc => `
            <div class="card h-100">
                <div class="card-body">
                    <div class="flex space-between align-center mb-2">
                        <h5 class="fw-bold m-0">${acc.name}</h5>
                        <div class="flex gap-2">
                            <button class="btn-link text-primary" onclick="window.showEditAccountNameModal(${acc.id})" title="Edit Account Name">${ICONS.edit}</button>
                            ${acc.is_system ? '' : `<button class="btn-link text-danger" onclick="window.deleteAccount(${acc.id})" title="Delete Account">${ICONS.trash}</button>`}
                        </div>
                    </div>
                    <div class="acc-balance">$${acc.balance.toFixed(2)}</div>
                    <div class="acc-row"><span>Allocated:</span><span class="value">$${acc.allocated.toFixed(2)}</span></div>
                </div>
            </div>
        `).join('') || '<p class="text-muted">No accounts added yet.</p>';
    }

    const tbody = document.getElementById('accounts-list');
    if (tbody) {
        tbody.innerHTML = state.accounts.map(acc => `
            <tr>
                <td class="fw-semibold">${acc.name}</td>
                <td class="text-end fw-bold text-primary">$${acc.balance.toFixed(2)}</td>
                <td class="text-end text-dark">$${acc.allocated.toFixed(2)}</td>
                <td class="text-center">
                    <div class="flex center gap-2">
                        <button class="btn-link text-primary" onclick="window.showEditAccountNameModal(${acc.id})" title="Edit Account Name">${ICONS.edit}</button>
                        ${acc.is_system ? '' : `<button class="btn-link text-danger" onclick="window.deleteAccount(${acc.id})" title="Delete Account">${ICONS.trash}</button>`}
                    </div>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="4" class="empty">No accounts added yet.</td></tr>';
    }

    applyAccountView();
}

export function toggleAccountView(view) {
    uiState.accountView = view;
    applyAccountView();
}

export function applyAccountView() {
    const isGrid = uiState.accountView === 'grid';
    const gridBtn = document.getElementById('acc-view-grid');
    const listBtn = document.getElementById('acc-view-list');
    if (gridBtn) gridBtn.classList.toggle('active', isGrid);
    if (listBtn) listBtn.classList.toggle('active', !isGrid);
    
    const container = document.getElementById('accounts-container');
    const listWrap = document.getElementById('accounts-list-wrap');
    if (container) container.style.display = isGrid ? '' : 'none';
    if (listWrap) listWrap.style.display = isGrid ? 'none' : '';
}

export function showAddAccountModal() {
    const nameEl = document.getElementById('acc-name');
    const balanceEl = document.getElementById('acc-balance');
    if (nameEl) nameEl.value = '';
    if (balanceEl) balanceEl.value = '0.00';
    openModal('accountModal');
}

export function showEditAccountNameModal(id) {
    const acc = state.accounts.find(a => a.id === id);
    if (!acc) return;
    const idEl = document.getElementById('edit-acc-id');
    const nameEl = document.getElementById('edit-acc-name');
    if (idEl) idEl.value = acc.id;
    if (nameEl) nameEl.value = acc.name;
    openModal('editAccountModal');
}

export async function handleAccountSubmit(e, fetchDashboard) {
    e.preventDefault();
    const name = document.getElementById('acc-name').value;

    await createAccountApi({ name });
    closeModal('accountModal');
    fetchDashboard();
}

export async function handleEditAccountNameSubmit(e, fetchDashboard) {
    e.preventDefault();
    const id = document.getElementById('edit-acc-id').value;
    const name = document.getElementById('edit-acc-name').value;
    const acc = state.accounts.find(a => a.id == id);
    if (!acc) return;

    await updateAccountApi(id, { name, balance: acc.balance });
    closeModal('editAccountModal');
    fetchDashboard();
}

export async function deleteAccount(id, fetchDashboard) {
    if (confirm('Delete account? This will also remove associated allocations.')) {
        await deleteAccountApi(id);
        fetchDashboard();
    }
}
