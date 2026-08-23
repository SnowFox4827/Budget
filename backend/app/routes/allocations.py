from datetime import datetime
from flask import Blueprint, request, jsonify
from app.db import get_db

allocations_bp = Blueprint('allocations', __name__)

@allocations_bp.route('/api/allocations', methods=['POST'])
def add_allocation():
    data = request.json or {}
    name = data.get('name')
    target_amount = float(data.get('target_amount', 0.0))
    amount_available = float(data.get('amount_available', 0.0))
    target_date = data.get('target_date', '')
    account_id = data.get('account_id')
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO allocations (name, target_amount, amount_available, target_date, account_id)
        VALUES (?, ?, ?, ?, ?)
    ''', (name, target_amount, amount_available, target_date, account_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@allocations_bp.route('/api/allocations/<int:alloc_id>', methods=['PUT', 'DELETE'])
def manage_allocation(alloc_id):
    conn = get_db()
    cursor = conn.cursor()
    if request.method == 'DELETE':
        cursor.execute('DELETE FROM allocations WHERE id = ?', (alloc_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    elif request.method == 'PUT':
        data = request.json or {}
        name = data.get('name')
        target_amount = float(data.get('target_amount', 0.0))
        amount_available = float(data.get('amount_available', 0.0))
        target_date = data.get('target_date', '')
        account_id = data.get('account_id')
        cursor.execute('''
            UPDATE allocations 
            SET name = ?, target_amount = ?, amount_available = ?, target_date = ?, account_id = ?
            WHERE id = ?
        ''', (name, target_amount, amount_available, target_date, account_id, alloc_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True})

@allocations_bp.route('/api/transfer-allocation', methods=['POST'])
def transfer_allocation():
    data = request.json or {}
    from_id = data.get('from_allocation_id')
    to_id = data.get('to_allocation_id')
    amount = float(data.get('amount', 0.0))
    account_id = data.get('account_id')
    
    conn = get_db()
    cursor = conn.cursor()

    unassigned_acc = cursor.execute('SELECT id FROM accounts WHERE is_system = 1').fetchone()
    unassigned_id = unassigned_acc['id'] if unassigned_acc else None

    def _is_unassigned(ref):
        if ref is None:
            return False
        # The frontend sends unassigned_<accountId> to reference the Unassigned Dollars
        # account without colliding with allocation ids.
        return str(ref).startswith('unassigned')

    if _is_unassigned(from_id):
        from_name = "Unassigned Dollars"
        if unassigned_id is not None:
            cursor.execute('UPDATE accounts SET balance = balance - ? WHERE id = ?', (amount, unassigned_id))
    else:
        cursor.execute('UPDATE allocations SET amount_available = amount_available - ? WHERE id = ?', (amount, int(from_id)))
        from_alloc = cursor.execute('SELECT name FROM allocations WHERE id = ?', (int(from_id),)).fetchone()
        from_name = from_alloc['name'] if from_alloc else "Allocation"

    if _is_unassigned(to_id):
        to_name = "Unassigned Dollars"
        if unassigned_id is not None:
            cursor.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', (amount, unassigned_id))
    else:
        cursor.execute('UPDATE allocations SET amount_available = amount_available + ? WHERE id = ?', (amount, int(to_id)))
        to_alloc = cursor.execute('SELECT name FROM allocations WHERE id = ?', (int(to_id),)).fetchone()
        to_name = to_alloc['name'] if to_alloc else "Allocation"

    desc = f"Transfer: {from_name} ➔ {to_name}"
    date_str = datetime.now().strftime('%Y-%m-%d')
    cursor.execute('''
        INSERT INTO transactions (description, amount, date, account_id, allocation_id, type)
        VALUES (?, ?, ?, ?, NULL, 'transfer')
    ''', (desc, amount, date_str, account_id))
    
    conn.commit()
    conn.close()
    return jsonify({'success': True})
