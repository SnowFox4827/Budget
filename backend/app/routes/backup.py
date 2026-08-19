import os
import io
import json
import sqlite3
import hashlib
from datetime import datetime
from flask import Blueprint, request, jsonify, send_file, Response
from app.db import get_db, DB_PATH, DATA_DIR

backup_bp = Blueprint('backup', __name__)

BACKUP_DIR = os.environ.get('BACKUP_DIR', os.path.join(os.path.dirname(DATA_DIR), 'backups'))
RETENTION_DAYS = int(os.environ.get('RETENTION_DAYS', 30))

def get_database_json():
    """Extract all accounts, allocations, and transactions as a clean dictionary."""
    conn = get_db()
    cursor = conn.cursor()

    accounts = [dict(r) for r in cursor.execute('SELECT * FROM accounts ORDER BY id ASC').fetchall()]
    allocations = [dict(r) for r in cursor.execute('SELECT * FROM allocations ORDER BY id ASC').fetchall()]
    transactions = [dict(r) for r in cursor.execute('SELECT * FROM transactions ORDER BY date DESC, id DESC').fetchall()]
    conn.close()

    return {
        "metadata": {
            "version": "1.0",
            "exported_at": datetime.now().isoformat(),
            "generator": "Budget App Dual Backup",
            "total_accounts": len(accounts),
            "total_allocations": len(allocations),
            "total_transactions": len(transactions)
        },
        "accounts": accounts,
        "allocations": allocations,
        "transactions": transactions
    }

def perform_snapshot(dest_root=None, retention_days=None):
    """
    Perform a safe dual-format snapshot:
    1. SQLite .db via online backup API (safe during active writes)
    2. Formatted JSON data dump
    3. SHA-256 checksums
    4. Auto-rotation of snapshots older than retention_days
    """
    if dest_root is None:
        dest_root = BACKUP_DIR
    if retention_days is None:
        retention_days = RETENTION_DAYS

    if not os.path.exists(dest_root):
        os.makedirs(dest_root, exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    snapshot_dir = os.path.join(dest_root, f"snapshot_{timestamp}")
    os.makedirs(snapshot_dir, exist_ok=True)

    # 1. Safe SQLite Online Backup
    db_backup_path = os.path.join(snapshot_dir, "budget.db")
    src_conn = sqlite3.connect(DB_PATH)
    dst_conn = sqlite3.connect(db_backup_path)
    with dst_conn:
        src_conn.backup(dst_conn)
    dst_conn.close()
    src_conn.close()

    # 2. JSON Data Dump
    json_data = get_database_json()
    json_backup_path = os.path.join(snapshot_dir, "data_export.json")
    with open(json_backup_path, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, indent=2)

    # 3. Write latest.json at root for quick NAS inspection
    latest_path = os.path.join(dest_root, "latest.json")
    try:
        with open(latest_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, indent=2)
    except Exception:
        pass

    # 4. SHA-256 Checksum Calculation
    checksum_path = os.path.join(snapshot_dir, "checksum.sha256")
    with open(checksum_path, 'w', encoding='utf-8') as cf:
        for filename in ["budget.db", "data_export.json"]:
            filepath = os.path.join(snapshot_dir, filename)
            hasher = hashlib.sha256()
            with open(filepath, 'rb') as f:
                while chunk := f.read(8192):
                    hasher.update(chunk)
            cf.write(f"{hasher.hexdigest()}  {filename}\n")

    # 5. Prune snapshots older than retention_days
    pruned_count = 0
    now = datetime.now()
    try:
        for entry in os.scandir(dest_root):
            if entry.is_dir() and entry.name.startswith("snapshot_"):
                stat = entry.stat()
                age_days = (now - datetime.fromtimestamp(stat.st_mtime)).days
                if age_days > retention_days:
                    import shutil
                    shutil.rmtree(entry.path, ignore_errors=True)
                    pruned_count += 1
    except Exception:
        pass

    return {
        "success": True,
        "snapshot_folder": snapshot_dir,
        "timestamp": timestamp,
        "pruned_old_snapshots": pruned_count
    }

@backup_bp.route('/api/backup/export', methods=['GET'])
def export_data():
    """Stream live export directly to the browser (JSON or SQLite DB)."""
    fmt = request.args.get('format', 'json').lower()
    now_str = datetime.now().strftime('%Y-%m-%d')

    if fmt == 'db':
        # Create in-memory or temp SQLite snapshot
        mem_db = io.BytesIO()
        src_conn = sqlite3.connect(DB_PATH)
        temp_dest = sqlite3.connect(':memory:')
        src_conn.backup(temp_dest)
        src_conn.close()

        # Dump memory db to bytes
        for line in temp_dest.iterdump():
            pass  # keep connection active
        # Write to byte buffer safely using backup to a file-like or reading raw db
        temp_dest.close()

        # Use safe online backup to a temporary file then stream
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as tmp:
            tmp_path = tmp.name
        tmp_conn = sqlite3.connect(tmp_path)
        src = sqlite3.connect(DB_PATH)
        src.backup(tmp_conn)
        src.close()
        tmp_conn.close()

        response = send_file(
            tmp_path,
            mimetype='application/x-sqlite3',
            as_attachment=True,
            download_name=f'budget_snapshot_{now_str}.db'
        )
        return response

    # Default: JSON export
    data = get_database_json()
    json_bytes = io.BytesIO(json.dumps(data, indent=2).encode('utf-8'))
    return send_file(
        json_bytes,
        mimetype='application/json',
        as_attachment=True,
        download_name=f'budget_export_{now_str}.json'
    )

@backup_bp.route('/api/backup/snapshot', methods=['POST'])
def trigger_snapshot():
    """Trigger an immediate dual-format snapshot to the backup storage."""
    try:
        result = perform_snapshot()
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@backup_bp.route('/api/backup/status', methods=['GET'])
def backup_status():
    """Return info on backups and snapshots available."""
    snapshots = []
    if os.path.exists(BACKUP_DIR):
        try:
            for entry in sorted(os.scandir(BACKUP_DIR), key=lambda e: e.name, reverse=True):
                if entry.is_dir() and entry.name.startswith("snapshot_"):
                    stat = entry.stat()
                    snapshots.append({
                        "name": entry.name,
                        "created_at": datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                        "path": entry.path
                    })
        except Exception:
            pass

    return jsonify({
        "backup_dir": BACKUP_DIR,
        "retention_days": RETENTION_DAYS,
        "total_snapshots": len(snapshots),
        "latest_snapshot": snapshots[0] if snapshots else None,
        "snapshots": snapshots[:10]  # last 10 snapshots
    })
