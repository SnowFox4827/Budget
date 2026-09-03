import { openModal } from '../modals.js';
import { fetchBackupStatusApi, triggerSnapshotApi, restoreBackupUploadApi, restoreSnapshotApi } from '../api.js';
import { fetchDashboardData } from '../api.js';

async function refreshDashboardAfterRestore() {
    try {
        const data = await fetchDashboardData();
        const { state } = await import('../state.js');
        state.accounts = (data.accounts || []).map(a => ({ is_deleted: 0, ...a }));
        state.allocations = (data.allocations || []).map(al => ({ is_deleted: 0, ...al }));
        state.transactions = data.transactions || [];
        const { renderSummary } = await import('./summary.js');
        const { renderAccounts } = await import('./accounts.js');
        const { renderAllocations } = await import('./allocations.js');
        const { renderTransactions } = await import('./transactions.js');
        renderSummary();
        renderAccounts();
        renderAllocations();
        renderTransactions();
    } catch (err) {
        console.error('Failed to refresh dashboard after restore:', err);
    }
}

export async function showBackupModal() {
    openModal('backupModal');
    const timeEl = document.getElementById('backup-last-time');
    const countEl = document.getElementById('backup-total-count');
    const listEl = document.getElementById('backup-snapshots-list');
    if (timeEl) timeEl.textContent = 'Checking snapshots...';
    if (countEl) countEl.textContent = '';
    if (listEl) listEl.innerHTML = '<div class="text-muted small">Loading snapshots...</div>';

    try {
        const data = await fetchBackupStatusApi();
        if (data.latest_snapshot) {
            timeEl.textContent = `Last snapshot: ${data.latest_snapshot.created_at}`;
            countEl.textContent = `Total snapshots: ${data.total_snapshots} (Retention: ${data.retention_days} days)`;
        } else {
            timeEl.textContent = 'No automated snapshots recorded yet.';
            countEl.textContent = `Retention policy: ${data.retention_days} days`;
        }

        if (listEl) {
            if (data.snapshots && data.snapshots.length > 0) {
                listEl.innerHTML = data.snapshots.map(s => `
                    <div class="flex gap-2 w-100" style="border: 1px solid var(--border-strong); border-radius: 6px; padding: 6px 8px; font-size: 0.85rem;">
                        <div class="grow">
                            <div class="fw-semibold">${s.name}</div>
                            <div class="text-muted small">${s.created_at || s.name}</div>
                        </div>
                        <button type="button" class="btn btn-outline-danger btn-sm" onclick="handleSnapshotRestore('${s.name}')">Restore</button>
                    </div>
                `).join('');
            } else {
                listEl.innerHTML = '<div class="text-muted small">No snapshots available</div>';
            }
        }
    } catch (e) {
        if (timeEl) timeEl.textContent = 'Snapshot storage ready.';
        if (listEl) listEl.innerHTML = '<div class="text-muted small">No snapshots available</div>';
    }
}

export function downloadBackup(format) {
    const url = `/api/backup/export?format=${encodeURIComponent(format)}`;
    window.location.href = url;
}

export async function triggerServerSnapshot() {
    const btn = document.getElementById('btn-trigger-snapshot');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Creating snapshot...';
    }

    try {
        const res = await triggerSnapshotApi();
        if (res.success) {
            await showBackupModal();
        } else {
            alert(`Snapshot error: ${res.error || 'Failed'}`);
        }
    } catch (err) {
        alert('Network error while requesting snapshot.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}

export async function handleFileRestore() {
    const fileInput = document.getElementById('backup-restore-file');
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
        alert('Please select a backup file first.');
        return;
    }

    const file = fileInput.files[0];
    const allowed = ['.json', '.db', '.sqlite', '.sqlite3'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowed.includes(ext)) {
        alert('Unsupported file type. Please use .json, .db, .sqlite, or .sqlite3.');
        return;
    }

    if (!confirm('This will REPLACE all current data with the contents of the backup file. A safety snapshot of your current data will be taken first. Continue?')) {
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await restoreBackupUploadApi(formData);
        if (res.success) {
            alert(res.message || 'Restore completed successfully.');
            await refreshDashboardAfterRestore();
            await showBackupModal();
        } else {
            alert(`Restore failed: ${res.error || 'Unknown error'}`);
        }
    } catch (err) {
        alert('Network error while restoring.');
    }
}

export async function handleSnapshotRestore(snapshotName) {
    if (!snapshotName) return;
    if (!confirm(`This will REPLACE all current data with the snapshot "${snapshotName}". A safety snapshot of your current data will be taken first. Continue?`)) {
        return;
    }

    try {
        const res = await restoreSnapshotApi(snapshotName);
        if (res.success) {
            alert(res.message || 'Restore completed successfully.');
            await refreshDashboardAfterRestore();
            await showBackupModal();
        } else {
            alert(`Restore failed: ${res.error || 'Unknown error'}`);
        }
    } catch (err) {
        alert('Network error while restoring.');
    }
}
