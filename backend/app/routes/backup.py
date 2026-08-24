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

def restore_from_json_dict(data):
    """Restore database from a JSON dictionary containing accounts, allocations, and transactions."""
    if not isinstance(data, dict):
        raise ValueError("Invalid JSON format: root must be an object.")

    accounts = data.get('accounts', [])
    allocations = data.get('allocations', [])
    transactions = data.get('transactions', [])

    if not isinstance(accounts, list) or not isinstance(allocations, list) or not isinstance(transactions, list):
        raise ValueError("Invalid format: 'accounts', 'allocations', and 'transactions' must be lists.")

    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("PRAGMA foreign_keys = OFF;")
        cursor.execute("DELETE FROM transactions;")
        cursor.execute("DELETE FROM allocations;")
        cursor.execute("DELETE FROM accounts;")

        for acc in accounts:
            cursor.execute(
                'INSERT INTO accounts (id, name, balance, is_system) VALUES (?, ?, ?, ?)',
                (acc.get('id'), acc.get('name'), float(acc.get('balance', 0.0)), int(acc.get('is_system', 0)))
            )

        for al in allocations:
            cursor.execute(
                'INSERT INTO allocations (id, name, amount_available, target_amount, target_date, account_id) VALUES (?, ?, ?, ?, ?, ?)',
                (
                    al.get('id'),
                    al.get('name'),
                    float(al.get('amount_available', 0.0)),
                    float(al.get('target_amount', 0.0)) if al.get('target_amount') is not None else 0.0,
                    al.get('target_date'),
                    al.get('account_id')
                )
            )

        for tx in transactions:
            cursor.execute(
                'INSERT INTO transactions (id, description, amount, date, account_id, allocation_id, type) VALUES (?, ?, ?, ?, ?, ?, ?)',
                (
                    tx.get('id'),
                    tx.get('description', ''),
                    float(tx.get('amount', 0.0)),
                    tx.get('date', datetime.now().strftime('%Y-%m-%d')),
                    tx.get('account_id'),
                    tx.get('allocation_id'),
                    tx.get('type', 'expense')
                )
            )

        # Ensure system account exists
        existing = cursor.execute('SELECT id FROM accounts WHERE is_system = 1').fetchone()
        if not existing:
            cursor.execute('INSERT INTO accounts (name, balance, is_system) VALUES (?, 0.0, 1)', ('Unassigned Dollars',))

        # Reset AUTOINCREMENT sequences to avoid ID collisions after explicit-ID inserts
        for seq_table in ['accounts', 'allocations', 'transactions']:
            row = cursor.execute(f'SELECT COALESCE(MAX(id), 0) + 1 FROM {seq_table}').fetchone()
            max_id = row[0] if row else 1
            cursor.execute(f'UPDATE sqlite_sequence SET seq = ? WHERE name = ?', (max_id, seq_table))

        cursor.execute("PRAGMA foreign_keys = ON;")
        conn.commit()
    finally:
        conn.close()

def restore_from_db_file(source_db_path):
    """Restore SQLite database using safe online backup from source_db_path."""
    # Verify source DB has required tables
    test_conn = sqlite3.connect(source_db_path)
    test_cursor = test_conn.cursor()
    tables = {r[0] for r in test_cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    test_conn.close()

    required = {'accounts', 'allocations', 'transactions'}
    if not required.issubset(tables):
        raise ValueError(f"SQLite file is missing required tables. Found: {tables}")

    src_conn = sqlite3.connect(source_db_path)
    dst_conn = sqlite3.connect(DB_PATH)
    with dst_conn:
        src_conn.backup(dst_conn)
    dst_conn.close()
    src_conn.close()

@backup_bp.route('/api/backup/restore/upload', methods=['POST'])
def restore_upload():
    """Upload a .json or .db backup file and restore the database."""
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No file uploaded."}), 400

    file = request.files['file']
    filename = file.filename or ''

    # First, take an automatic safety snapshot of current state
    try:
        perform_snapshot()
    except Exception:
        pass

    try:
        if filename.endswith('.json'):
            content = file.read().decode('utf-8')
            json_data = json.loads(content)
            restore_from_json_dict(json_data)
            return jsonify({"success": True, "message": "Database restored successfully from JSON file."})

        elif filename.endswith('.db') or filename.endswith('.sqlite') or filename.endswith('.sqlite3'):
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as tmp:
                file.save(tmp.name)
                tmp_path = tmp.name
            try:
                restore_from_db_file(tmp_path)
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
            return jsonify({"success": True, "message": "Database restored successfully from SQLite backup."})

        else:
            return jsonify({"success": False, "error": "Unsupported file format. Please provide a .json or .db file."}), 400

    except Exception as e:
        return jsonify({"success": False, "error": f"Restore failed: {str(e)}"}), 500

@backup_bp.route('/api/backup/restore/snapshot', methods=['POST'])
def restore_snapshot():
    """Restore from a specific snapshot stored on the server."""
    data = request.json or {}
    snapshot_name = data.get('snapshot_name')
    if not snapshot_name:
        return jsonify({"success": False, "error": "snapshot_name is required."}), 400

    # Prevent directory traversal
    safe_name = os.path.basename(snapshot_name)
    snapshot_dir = os.path.join(BACKUP_DIR, safe_name)

    if not os.path.isdir(snapshot_dir):
        return jsonify({"success": False, "error": f"Snapshot directory not found: {safe_name}"}), 404

    # First, take an automatic safety snapshot of current state
    try:
        perform_snapshot()
    except Exception:
        pass

    db_file = os.path.join(snapshot_dir, 'budget.db')
    json_file = os.path.join(snapshot_dir, 'data_export.json')

    try:
        if os.path.exists(db_file):
            restore_from_db_file(db_file)
            return jsonify({"success": True, "message": f"Restored successfully from snapshot '{safe_name}' (SQLite binary)."})
        elif os.path.exists(json_file):
            with open(json_file, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
            restore_from_json_dict(json_data)
            return jsonify({"success": True, "message": f"Restored successfully from snapshot '{safe_name}' (JSON export)."})
        else:
            return jsonify({"success": False, "error": "Snapshot folder does not contain budget.db or data_export.json."}), 400
    except Exception as e:
        return jsonify({"success": False, "error": f"Restore failed: {str(e)}"}), 500
