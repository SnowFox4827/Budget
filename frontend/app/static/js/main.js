import { state } from './state.js';
import { fetchDashboardData } from './api.js';
import { initTheme, toggleTheme } from './theme.js';
import { openModal, closeModal, switchTab } from './modals.js';
import { renderSummary } from './components/summary.js';
import {
    renderAccounts,
    toggleAccountView,
    showAddAccountModal,
    showEditAccountNameModal,
    handleAccountSubmit,
    handleEditAccountNameSubmit,
    deleteAccount
} from './components/accounts.js';
import {
    renderAllocations,
    setAllocationView,
    populateTransferEnvelopes,
    showAddAllocationModal,
    showEditAllocationModal,
    showTransferModal,
    handleAllocationSubmit,
    handleTransferSubmit,
    deleteAllocation
} from './components/allocations.js';
import {
    renderTransactions,
    filterTransactions,
    populateSelectOptions,
    populateTransAllocSelect,
    showAddTransactionModal,
    showEditTransactionModal,
    toggleTransType,
    handleTransactionSubmit,
    resolveOverspend,
    deleteTransaction
} from './components/transactions.js';

// Global Data Fetch
export async function fetchDashboard() {
    try {
        const data = await fetchDashboardData();
        state.accounts = data.accounts || [];
        state.allocations = data.allocations || [];
        state.transactions = data.transactions || [];

        renderSummary();
        renderAccounts();
        renderAllocations();
        renderTransactions();
        populateSelectOptions();
    } catch (err) {
        console.error('Error fetching dashboard data:', err);
    }
}

// Expose functions to window for direct HTML inline attributes
window.toggleTheme = toggleTheme;
window.switchTab = switchTab;
window.openModal = openModal;
window.closeModal = closeModal;

// Account handlers
window.toggleAccountView = toggleAccountView;
window.showAddAccountModal = showAddAccountModal;
window.showEditAccountNameModal = showEditAccountNameModal;
window.deleteAccount = (id) => deleteAccount(id, fetchDashboard);

// Allocation handlers
window.setAllocationView = setAllocationView;
window.populateTransferEnvelopes = populateTransferEnvelopes;
window.showAddAllocationModal = showAddAllocationModal;
window.showEditAllocationModal = showEditAllocationModal;
window.showTransferModal = showTransferModal;
window.deleteAllocation = (id) => deleteAllocation(id, fetchDashboard);

// Transaction handlers
window.populateTransAllocSelect = populateTransAllocSelect;
window.showAddTransactionModal = showAddTransactionModal;
window.showEditTransactionModal = showEditTransactionModal;
window.toggleTransType = toggleTransType;
window.resolveOverspend = () => resolveOverspend(fetchDashboard);
window.deleteTransaction = (id) => deleteTransaction(id, fetchDashboard);

// Setup form listeners and filters on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    // Forms
    const accountForm = document.getElementById('accountForm');
    if (accountForm) {
        accountForm.addEventListener('submit', (e) => handleAccountSubmit(e, fetchDashboard));
    }

    const editAccountNameForm = document.getElementById('editAccountNameForm');
    if (editAccountNameForm) {
        editAccountNameForm.addEventListener('submit', (e) => handleEditAccountNameSubmit(e, fetchDashboard));
    }

    const allocationForm = document.getElementById('allocationForm');
    if (allocationForm) {
        allocationForm.addEventListener('submit', (e) => handleAllocationSubmit(e, fetchDashboard));
    }

    const transactionForm = document.getElementById('transactionForm');
    if (transactionForm) {
        transactionForm.addEventListener('submit', (e) => handleTransactionSubmit(e, fetchDashboard));
    }

    const transferForm = document.getElementById('transferForm');
    if (transferForm) {
        transferForm.addEventListener('submit', (e) => handleTransferSubmit(e, fetchDashboard));
    }

    // Allocation account filter
    const allocAccFilter = document.getElementById('alloc-account-filter');
    if (allocAccFilter) {
        allocAccFilter.addEventListener('change', renderAllocations);
    }

    // Transaction account select changes allocation options
    const transAccSelect = document.getElementById('trans-account-select');
    if (transAccSelect) {
        transAccSelect.addEventListener('change', populateTransAllocSelect);
    }

    // Transaction slicing/filtering
    const sliceInputs = ['slice-search', 'slice-account', 'slice-allocation', 'slice-type'];
    sliceInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', filterTransactions);
            el.addEventListener('change', filterTransactions);
        }
    });

    fetchDashboard();
});
