export async function fetchDashboardData() {
    const res = await fetch('/api/dashboard');
    if (!res.ok) throw new Error('Failed to fetch dashboard data');
    return res.json();
}

export async function createAccountApi(data) {
    const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
}

export async function updateAccountApi(id, data) {
    const res = await fetch(`/api/accounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
}

export async function deleteAccountApi(id) {
    const res = await fetch(`/api/accounts/${id}`, {
        method: 'DELETE'
    });
    return res.json();
}

export async function createAllocationApi(data) {
    const res = await fetch('/api/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
}

export async function updateAllocationApi(id, data) {
    const res = await fetch(`/api/allocations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
}

export async function deleteAllocationApi(id) {
    const res = await fetch(`/api/allocations/${id}`, {
        method: 'DELETE'
    });
    return res.json();
}

export async function transferAllocationApi(data) {
    const res = await fetch('/api/transfer-allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
}

export async function createTransactionApi(data) {
    const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    const result = await res.json();
    return { ok: res.ok, status: res.status, data: result };
}

export async function updateTransactionApi(id, data) {
    const res = await fetch(`/api/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    const result = await res.json();
    return { ok: res.ok, status: res.status, data: result };
}

export async function deleteTransactionApi(id) {
    const res = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE'
    });
    return res.json();
}

export async function fetchBackupStatusApi() {
    const res = await fetch('/api/backup/status');
    if (!res.ok) throw new Error('Failed to fetch backup status');
    return res.json();
}

export async function triggerSnapshotApi() {
    const res = await fetch('/api/backup/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    return res.json();
}

export async function restoreBackupUploadApi(formData) {
    const res = await fetch('/api/backup/restore/upload', {
        method: 'POST',
        body: formData
    });
    return res.json();
}

export async function restoreSnapshotApi(snapshotName) {
    const res = await fetch('/api/backup/restore/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot_name: snapshotName })
    });
    return res.json();
}
