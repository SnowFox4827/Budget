import { openModal } from '../modals.js';
import { fetchBackupStatusApi, triggerSnapshotApi } from '../api.js';

export async function showBackupModal() {
    openModal('backupModal');
    const timeEl = document.getElementById('backup-last-time');
    const countEl = document.getElementById('backup-total-count');
    if (timeEl) timeEl.textContent = 'Checking snapshots...';
    if (countEl) countEl.textContent = '';

    try {
        const data = await fetchBackupStatusApi();
        if (data.latest_snapshot) {
            timeEl.textContent = `Last snapshot: ${data.latest_snapshot.created_at}`;
            countEl.textContent = `Total snapshots: ${data.total_snapshots} (Retention: ${data.retention_days} days)`;
        } else {
            timeEl.textContent = 'No automated snapshots recorded yet.';
            countEl.textContent = `Retention policy: ${data.retention_days} days`;
        }
    } catch (e) {
        if (timeEl) timeEl.textContent = 'Snapshot storage ready.';
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
