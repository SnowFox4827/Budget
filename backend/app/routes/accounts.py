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
        if acc and acc['is_system']:
            conn.close()
            return jsonify({'success': False, 'error': 'The Unassigned Dollars account cannot be deleted.'}), 400
        cursor.execute('DELETE FROM accounts WHERE id = ?', (acc_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    elif request.method == 'PUT':
        data = request.json or {}
        name = data.get('name')
        balance = float(data.get('balance', 0.0))
        cursor.execute('UPDATE accounts SET name = ?, balance = ? WHERE id = ?', (name, balance, acc_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
