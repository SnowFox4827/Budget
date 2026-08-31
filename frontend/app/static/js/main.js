import { state } from './state.js';
import { fetchDashboardData } from './api.js';
import { initTheme, toggleTheme } from './theme.js';
import { openModal, closeModal, switchTab } from './modals.js';
import { renderSummary } from './components/summary.js';
import {
    renderAccounts,
    toggleAccountView,
    setAccountSort,
    showAddAccountModal,
    showEditAccountNameModal,
    handleAccountSubmit,
    handleEditAccountNameSubmit,
    deleteAccount
} from './components/accounts.js';
import {
    renderAllocations,
    setAllocationView,
    setAllocationSort,
    showAddAllocationModal,
    showEditAllocationModal,
    handleAllocationSubmit,
    deleteAllocation
} from './components/allocations.js';
import {
    renderTransactions,
    filterTransactions,
    populateSelectOptions,
    showAddTransactionModal,
    showEditTransactionModal,
    toggleTransType,
    handleTransactionSubmit,
    resolveOverspend,
    deleteTransaction,
    showMoveAllocationModal,
    moveAllocation
} from './components/transactions.js';
import {
    showBackupModal,
    downloadBackup,
    triggerServerSnapshot,
    handleFileRestore,
    handleSnapshotRestore
} from './components/backup.js';
import './components/ci-calculator.js';
import './components/mortgage-calculator.js';

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
window.setAccountSort = setAccountSort;
window.showAddAccountModal = showAddAccountModal;
window.showEditAccountNameModal = showEditAccountNameModal;
window.deleteAccount = (id) => deleteAccount(id, fetchDashboard);

// Allocation handlers
window.setAllocationView = setAllocationView;
window.setAllocationSort = setAllocationSort;
window.showAddAllocationModal = showAddAllocationModal;
window.showEditAllocationModal = showEditAllocationModal;
window.deleteAllocation = (id) => deleteAllocation(id, fetchDashboard);

// Transaction handlers
window.showAddTransactionModal = showAddTransactionModal;
window.showEditTransactionModal = showEditTransactionModal;
window.toggleTransType = toggleTransType;
window.resolveOverspend = () => resolveOverspend(fetchDashboard);
window.deleteTransaction = (id) => deleteTransaction(id, fetchDashboard);
window.showMoveAllocationModal = showMoveAllocationModal;
window.moveAllocation = moveAllocation;

// Backup handlers
window.showBackupModal = showBackupModal;
window.downloadBackup = downloadBackup;
window.triggerServerSnapshot = triggerServerSnapshot;
window.handleFileRestore = handleFileRestore;
window.handleSnapshotRestore = handleSnapshotRestore;

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

    // Allocation account filter
    const allocAccFilter = document.getElementById('alloc-account-filter');
    if (allocAccFilter) {
        allocAccFilter.addEventListener('change', renderAllocations);
    }

    // Initialise the compound interest calculator's rate label
    if (window.updateRate) updateRate();


    // Transaction slicing/filtering
    const sliceInputs = ['slice-date-preset', 'slice-search', 'slice-account', 'slice-allocation', 'slice-type'];
    sliceInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', filterTransactions);
            el.addEventListener('change', filterTransactions);
        }
    });

    fetchDashboard();
});
