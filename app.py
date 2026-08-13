from flask import Flask, render_template, request, jsonify
import sqlite3
import os
from datetime import datetime

app = Flask(__name__, static_folder='static', template_folder='templates')
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
DB_PATH = os.path.join(DATA_DIR, 'budget.db')

def get_db():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Accounts
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            balance REAL DEFAULT 0.0
        )
    ''')
    
    # Allocations
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS allocations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            amount_available REAL DEFAULT 0.0,
            target_amount REAL DEFAULT 0.0,
            target_date TEXT,
            account_id INTEGER,
            FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
        )
    ''')
    
    # Transactions
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            date TEXT NOT NULL,
            account_id INTEGER NOT NULL,
            allocation_id INTEGER,
            type TEXT DEFAULT 'expense', -- 'expense', 'income', 'transfer'
            FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE,
            FOREIGN KEY(allocation_id) REFERENCES allocations(id) ON DELETE SET NULL
        )
    ''')
    
    conn.commit()
    conn.close()

@app.route('/')
def index():
    return render_template('index.html')

# --- API ENDPOINTS ---

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    conn = get_db()
    cursor = conn.cursor()
    
    accounts = [dict(row) for row in cursor.execute('SELECT * FROM accounts').fetchall()]
    allocations = [dict(row) for row in cursor.execute('''
        SELECT a.*, acc.name as account_name 
        FROM allocations a 
        LEFT JOIN accounts acc ON a.account_id = acc.id
    ''').fetchall()]
    
    # Calculate allocated sum per account; unassigned is automatically remaining balance
    for acc in accounts:
        alloc_sum = cursor.execute('SELECT SUM(amount_available) FROM allocations WHERE account_id = ?', (acc['id'],)).fetchone()[0] or 0.0
        acc['allocated'] = alloc_sum
        acc['unassigned'] = acc['balance'] - alloc_sum
        
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

# --- ACCOUNTS CRUD ---
@app.route('/api/accounts', methods=['POST'])
def add_account():
    data = request.json
    name = data.get('name')
    balance = float(data.get('balance', 0.0))
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO accounts (name, balance) VALUES (?, ?)', (name, balance))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/accounts/<int:acc_id>', methods=['PUT', 'DELETE'])
def manage_account(acc_id):
    conn = get_db()
    cursor = conn.cursor()
    if request.method == 'DELETE':
        cursor.execute('DELETE FROM accounts WHERE id = ?', (acc_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    elif request.method == 'PUT':
        data = request.json
        name = data.get('name')
        balance = float(data.get('balance', 0.0))
        cursor.execute('UPDATE accounts SET name = ?, balance = ? WHERE id = ?', (name, balance, acc_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True})

# --- ALLOCATIONS CRUD ---
@app.route('/api/allocations', methods=['POST'])
def add_allocation():
    data = request.json
    name = data.get('name')
    target_amount = float(data.get('target_amount', 0.0))
    amount_available = float(data.get('amount_available', 0.0))
    target_date = data.get('target_date', '')
    account_id = data.get('account_id')
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO allocations (name, amount_available, target_amount, target_date, account_id)
        VALUES (?, ?, ?, ?, ?)
    ''', (name, amount_available, target_amount, target_date, account_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/allocations/<int:alloc_id>', methods=['PUT', 'DELETE'])
def manage_allocation(alloc_id):
    conn = get_db()
    cursor = conn.cursor()
    if request.method == 'DELETE':
        cursor.execute('DELETE FROM allocations WHERE id = ?', (alloc_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    elif request.method == 'PUT':
        data = request.json
        name = data.get('name')
        target_amount = float(data.get('target_amount', 0.0))
        amount_available = float(data.get('amount_available', 0.0))
        target_date = data.get('target_date', '')
        account_id = data.get('account_id')
        cursor.execute('''
            UPDATE allocations 
            SET name = ?, amount_available = ?, target_amount = ?, target_date = ?, account_id = ?
            WHERE id = ?
        ''', (name, amount_available, target_amount, target_date, account_id, alloc_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True})

# --- TRANSACTIONS ---
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

@app.route('/api/transactions', methods=['POST'])
def add_transaction():
    data = request.json
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

@app.route('/api/transactions/<int:trans_id>', methods=['PUT', 'DELETE'])
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
        data = request.json
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

@app.route('/api/transfer-allocation', methods=['POST'])
def transfer_allocation():
    data = request.json
    from_id = data.get('from_allocation_id')
    to_id = data.get('to_allocation_id')
    amount = float(data.get('amount', 0.0))
    account_id = data.get('account_id')
    
    conn = get_db()
    cursor = conn.cursor()
    
    if str(from_id).startswith('unassigned'):
        from_name = "Unassigned Funds"
    else:
        cursor.execute('UPDATE allocations SET amount_available = amount_available - ? WHERE id = ?', (amount, int(from_id)))
        from_alloc = cursor.execute('SELECT name FROM allocations WHERE id = ?', (int(from_id),)).fetchone()
        from_name = from_alloc['name'] if from_alloc else "Allocation"
        
    if str(to_id).startswith('unassigned'):
        to_name = "Unassigned Funds"
    else:
        cursor.execute('UPDATE allocations SET amount_available = amount_available + ? WHERE id = ?', (amount, int(to_id)))
        to_alloc = cursor.execute('SELECT name FROM allocations WHERE id = ?', (int(to_id),)).fetchone()
        to_name = to_alloc['name'] if to_alloc else "Allocation"
        
    desc = f"Transfer: {from_name} ➔ {to_name}"
    date_str = datetime.now().strftime('%Y-%m-%d')
    cursor.execute('''
        INSERT INTO transactions (description, amount, date, account_id, allocation_id, type)
        VALUES (?, ?, ?, ?, NULL, 'transfer')
    ''', (desc, 0.0, date_str, account_id))
    
    conn.commit()
    conn.close()
    return jsonify({'success': True})

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)
