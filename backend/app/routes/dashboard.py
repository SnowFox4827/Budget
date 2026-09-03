from flask import Blueprint, jsonify
from app.db import get_db

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

@dashboard_bp.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    conn = get_db()
    cursor = conn.cursor()
    
    # Include soft-deleted accounts/allocations in the payload so transaction
    # history keeps resolving names, but mark them is_deleted so the frontend
    # can hide them from dropdowns/lists. Balances of deleted accounts are
    # zeroed on delete, so they no longer distort totals.
    accounts = [dict(row) for row in cursor.execute('SELECT * FROM accounts').fetchall()]
    allocations = [dict(row) for row in cursor.execute('''
        SELECT a.*, acc.name as account_name 
        FROM allocations a 
        LEFT JOIN accounts acc ON a.account_id = acc.id
    ''').fetchall()]
    
    # Calculate allocated sum per account; unassigned is automatically remaining balance
    for acc in accounts:
        alloc_sum = cursor.execute('SELECT SUM(amount_available) FROM allocations WHERE account_id = ? AND is_deleted = 0', (acc['id'],)).fetchone()[0] or 0.0
        acc['allocated'] = alloc_sum
        acc['unassigned'] = acc['balance'] - alloc_sum
        acc.setdefault('is_deleted', 0)
    for al in allocations:
        al.setdefault('is_deleted', 0)

    transactions = [dict(row) for row in cursor.execute('''
        SELECT t.*, acc.name as account_name, al.name as allocation_name 
        FROM transactions t
        LEFT JOIN accounts acc ON t.account_id = acc.id
        LEFT JOIN allocations al ON t.allocation_id = al.id
        ORDER BY t.date DESC, t.id DESC
    ''').fetchall()]
    
    conn.close()
    return jsonify({
        'accounts': accounts,
        'allocations': allocations,
        'transactions': transactions
    })
