from flask import Blueprint, request, jsonify
from app.db import get_db

accounts_bp = Blueprint('accounts', __name__)

@accounts_bp.route('/api/accounts', methods=['POST'])
def add_account():
    data = request.json or {}
    name = data.get('name')
    balance = float(data.get('balance', 0.0))
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO accounts (name, balance) VALUES (?, ?)', (name, balance))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@accounts_bp.route('/api/accounts/<int:acc_id>', methods=['PUT', 'DELETE'])
def manage_account(acc_id):
    conn = get_db()
    cursor = conn.cursor()
    if request.method == 'DELETE':
        acc = cursor.execute('SELECT is_system FROM accounts WHERE id = ?', (acc_id,)).fetchone()
        if not acc:
            conn.close()
            return jsonify({'success': False, 'error': 'Account not found.'}), 404
        if acc['is_system']:
            conn.close()
            return jsonify({'success': False, 'error': 'The Unassigned Dollars account cannot be deleted.'}), 400
        # Soft delete: keep the account row (and any transaction rows that point
        # to it) so history is preserved. The account is hidden from dropdowns
        # and balances by the is_deleted flag; allocations it owned are soft-
        # deleted too, and the account's full balance is returned to Unassigned
        # Dollars so no money silently disappears from the totals.
        acc_row = cursor.execute('SELECT balance FROM accounts WHERE id = ?', (acc_id,)).fetchone()
        acc_balance = float(acc_row['balance']) if acc_row and acc_row['balance'] else 0.0
        u = cursor.execute('SELECT id FROM accounts WHERE is_system = 1').fetchone()
        unassigned_id = u['id'] if u else None
        if acc_balance != 0 and unassigned_id is not None:
            cursor.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', (acc_balance, unassigned_id))
        # The allocation amounts are part of the account balance we just moved;
        # soft-delete them and zero their funding so they don't double-count.
        cursor.execute('UPDATE allocations SET amount_available = 0, is_deleted = 1 WHERE account_id = ?', (acc_id,))
        cursor.execute('UPDATE accounts SET balance = 0, is_deleted = 1 WHERE id = ?', (acc_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    elif request.method == 'PUT':
        data = request.json or {}
        name = data.get('name')
        balance = float(data.get('balance', 0.0))
        acc = cursor.execute('SELECT name, is_system FROM accounts WHERE id = ?', (acc_id,)).fetchone()
        if acc and acc['is_system'] and name != acc['name']:
            conn.close()
            return jsonify({'success': False, 'error': 'The Unassigned Dollars account name cannot be changed.'}), 400
        cursor.execute('UPDATE accounts SET name = ?, balance = ? WHERE id = ?', (name, balance, acc_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
