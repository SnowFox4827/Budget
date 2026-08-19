from datetime import datetime
from flask import Blueprint, request, jsonify
from app.db import get_db

transactions_bp = Blueprint('transactions', __name__)

def revert_transaction_effect(cursor, tx):
    tx_type = tx['type']
    amount = abs(tx['amount'])
    acc_id = tx['account_id']
    alloc_id = tx['allocation_id']

    if tx_type == 'expense':
        cursor.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', (amount, acc_id))
        if alloc_id:
            cursor.execute('UPDATE allocations SET amount_available = amount_available + ? WHERE id = ?', (amount, alloc_id))
    elif tx_type == 'income':
        cursor.execute('UPDATE accounts SET balance = balance - ? WHERE id = ?', (amount, acc_id))
        if alloc_id:
            cursor.execute('UPDATE allocations SET amount_available = amount_available - ? WHERE id = ?', (amount, alloc_id))

@transactions_bp.route('/api/transactions', methods=['POST'])
def add_transaction():
    data = request.json or {}
    description = data.get('description')
    amount = float(data.get('amount', 0.0))
    date = data.get('date') or datetime.now().strftime('%Y-%m-%d')
    account_id = int(data.get('account_id'))
    allocation_id = int(data.get('allocation_id')) if data.get('allocation_id') else None
    trans_type = data.get('type', 'expense')
    cover_from_alloc_id = data.get('cover_from_alloc_id')
    
    conn = get_db()
    cursor = conn.cursor()
    
    if trans_type == 'expense':
        if allocation_id:
            alloc = cursor.execute('SELECT * FROM allocations WHERE id = ?', (allocation_id,)).fetchone()
            if alloc:
                needed = abs(amount)
                avail = alloc['amount_available']
                if avail < needed:
                    shortfall = needed - avail
                    if not cover_from_alloc_id:
                        conn.close()
                        return jsonify({
                            'error': 'OVERSPEND',
                            'message': f'Allocation "{alloc["name"]}" only has ${avail:.2f} available. Shortfall is ${shortfall:.2f}.',
                            'shortfall': shortfall,
                            'allocation_id': allocation_id
                        }), 400
                    else:
                        cursor.execute('UPDATE allocations SET amount_available = 0 WHERE id = ?', (allocation_id,))
                        if cover_from_alloc_id != 'unassigned':
                            cursor.execute('UPDATE allocations SET amount_available = amount_available - ? WHERE id = ?', (shortfall, int(cover_from_alloc_id)))
                else:
                    cursor.execute('UPDATE allocations SET amount_available = amount_available - ? WHERE id = ?', (needed, allocation_id))
        
        cursor.execute('UPDATE accounts SET balance = balance - ? WHERE id = ?', (abs(amount), account_id))

    elif trans_type == 'income':
        cursor.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', (abs(amount), account_id))
        if allocation_id:
            cursor.execute('UPDATE allocations SET amount_available = amount_available + ? WHERE id = ?', (abs(amount), allocation_id))

    cursor.execute('''
        INSERT INTO transactions (description, amount, date, account_id, allocation_id, type)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (description, amount, date, account_id, allocation_id, trans_type))
    
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@transactions_bp.route('/api/transactions/<int:trans_id>', methods=['PUT', 'DELETE'])
def manage_transaction(trans_id):
    conn = get_db()
    cursor = conn.cursor()
    
    old_tx = cursor.execute('SELECT * FROM transactions WHERE id = ?', (trans_id,)).fetchone()
    if not old_tx:
        conn.close()
        return jsonify({'error': 'Transaction not found'}), 404

    if request.method == 'DELETE':
        revert_transaction_effect(cursor, old_tx)
        cursor.execute('DELETE FROM transactions WHERE id = ?', (trans_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})

    elif request.method == 'PUT':
        data = request.json or {}
        description = data.get('description')
        amount = float(data.get('amount', 0.0))
        date = data.get('date')
        account_id = int(data.get('account_id'))
        allocation_id = int(data.get('allocation_id')) if data.get('allocation_id') else None
        trans_type = data.get('type', 'expense')
        cover_from_alloc_id = data.get('cover_from_alloc_id')

        revert_transaction_effect(cursor, old_tx)

        if trans_type == 'expense':
            if allocation_id:
                alloc = cursor.execute('SELECT * FROM allocations WHERE id = ?', (allocation_id,)).fetchone()
                if alloc:
                    needed = abs(amount)
                    avail = alloc['amount_available']
                    if avail < needed:
                        shortfall = needed - avail
                        if not cover_from_alloc_id:
                            conn.rollback()
                            conn.close()
                            return jsonify({
                                'error': 'OVERSPEND',
                                'message': f'Allocation "{alloc["name"]}" only has ${avail:.2f} available. Shortfall is ${shortfall:.2f}.',
                                'shortfall': shortfall,
                                'allocation_id': allocation_id
                            }), 400
                        else:
                            cursor.execute('UPDATE allocations SET amount_available = 0 WHERE id = ?', (allocation_id,))
                            if cover_from_alloc_id != 'unassigned':
                                cursor.execute('UPDATE allocations SET amount_available = amount_available - ? WHERE id = ?', (shortfall, int(cover_from_alloc_id)))
                    else:
                        cursor.execute('UPDATE allocations SET amount_available = amount_available - ? WHERE id = ?', (needed, allocation_id))
            
            cursor.execute('UPDATE accounts SET balance = balance - ? WHERE id = ?', (abs(amount), account_id))

        elif trans_type == 'income':
            cursor.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', (abs(amount), account_id))
            if allocation_id:
                cursor.execute('UPDATE allocations SET amount_available = amount_available + ? WHERE id = ?', (abs(amount), allocation_id))

        cursor.execute('''
            UPDATE transactions 
            SET description = ?, amount = ?, date = ?, account_id = ?, allocation_id = ?, type = ?
            WHERE id = ?
        ''', (description, amount, date, account_id, allocation_id, trans_type, trans_id))

        conn.commit()
        conn.close()
        return jsonify({'success': True})
