#!/usr/bin/env python3
"""
Budget App - Dual Format Automated Backup Runner
Creates:
  1. SQLite binary snapshot (safe online backup)
  2. Structured JSON dump
  3. SHA-256 integrity checksums
  4. latest.json pointer
Prunes snapshots exceeding retention threshold.
"""
import os
import sys
import time
import json
import sqlite3
import hashlib
import shutil
from datetime import datetime

DB_PATH = os.environ.get('DB_PATH', '/app/data/budget.db')
BACKUP_DIR = os.environ.get('BACKUP_DIR', '/backups')
RETENTION_DAYS = int(os.environ.get('RETENTION_DAYS', 30))

def run_backup():
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting backup process...")

    if not os.path.exists(DB_PATH):
        print(f"Warning: Database file not found at {DB_PATH}. Skipping.")
        return False

    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    snapshot_dir = os.path.join(BACKUP_DIR, f"snapshot_{timestamp}")
    os.makedirs(snapshot_dir, exist_ok=True)

    # 1. Safe SQLite Online Backup
    db_backup_file = os.path.join(snapshot_dir, "budget.db")
    try:
        src = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
        dst = sqlite3.connect(db_backup_file)
        with dst:
            src.backup(dst)
        dst.close()
        src.close()
        print(f"  ✓ SQLite binary snapshot created: {db_backup_file}")
    except Exception as e:
        print(f"  ✗ SQLite backup error: {e}")
        return False

    # 2. Extract JSON export
    try:
        conn = sqlite3.connect(db_backup_file)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        accounts = [dict(r) for r in cursor.execute('SELECT * FROM accounts ORDER BY id ASC').fetchall()]
        allocations = [dict(r) for r in cursor.execute('SELECT * FROM allocations ORDER BY id ASC').fetchall()]
        transactions = [dict(r) for r in cursor.execute('SELECT * FROM transactions ORDER BY date DESC, id DESC').fetchall()]
        conn.close()

        json_data = {
            "metadata": {
                "version": "1.0",
                "exported_at": datetime.now().isoformat(),
                "generator": "Budget Automated Sidecar",
                "total_accounts": len(accounts),
                "total_allocations": len(allocations),
                "total_transactions": len(transactions)
            },
            "accounts": accounts,
            "allocations": allocations,
            "transactions": transactions
        }

        json_backup_file = os.path.join(snapshot_dir, "data_export.json")
        with open(json_backup_file, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, indent=2)
        print(f"  ✓ JSON data export created: {json_backup_file}")

        # Update latest.json
        latest_file = os.path.join(BACKUP_DIR, "latest.json")
        with open(latest_file, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, indent=2)
    except Exception as e:
        print(f"  ✗ JSON export error: {e}")

    # 3. Compute Checksums
    try:
        checksum_file = os.path.join(snapshot_dir, "checksum.sha256")
        with open(checksum_file, 'w', encoding='utf-8') as cf:
            for fname in ["budget.db", "data_export.json"]:
                fpath = os.path.join(snapshot_dir, fname)
                if os.path.exists(fpath):
                    hasher = hashlib.sha256()
                    with open(fpath, 'rb') as f:
                        while chunk := f.read(8192):
                            hasher.update(chunk)
                    cf.write(f"{hasher.hexdigest()}  {fname}\n")
        print(f"  ✓ SHA-256 checksums recorded.")
    except Exception as e:
        print(f"  ✗ Checksum calculation error: {e}")

    # 4. Retention Pruning
    now = datetime.now()
    pruned = 0
    try:
        for entry in os.scandir(BACKUP_DIR):
            if entry.is_dir() and entry.name.startswith("snapshot_"):
                mtime = datetime.fromtimestamp(entry.stat().st_mtime)
                if (now - mtime).days > RETENTION_DAYS:
                    shutil.rmtree(entry.path, ignore_errors=True)
                    pruned += 1
        if pruned > 0:
            print(f"  ✓ Pruned {pruned} old snapshot(s) (> {RETENTION_DAYS} days).")
    except Exception as e:
        print(f"  ✗ Pruning error: {e}")

    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Backup finished successfully.")
    return True

def daemon_loop():
    """Run backup periodically according to interval (default: every 24 hours / 86400s)."""
    interval_hours = float(os.environ.get('BACKUP_INTERVAL_HOURS', '24'))
    interval_sec = interval_hours * 3600
    print(f"Starting Budget Backup Sidecar Daemon (interval: every {interval_hours} hours, retention: {RETENTION_DAYS} days)...")
    
    # Run once at startup
    run_backup()
    
    while True:
        try:
            time.sleep(interval_sec)
            run_backup()
        except (KeyboardInterrupt, SystemExit):
            print("Backup daemon stopped.")
            break

if __name__ == '__main__':
    if '--once' in sys.argv or os.environ.get('RUN_ONCE') == '1':
        success = run_backup()
        sys.exit(0 if success else 1)
    else:
        daemon_loop()
