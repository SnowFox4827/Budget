from datetime import datetime
from flask import Blueprint, request, jsonify
from app.db import get_db

allocations_bp = Blueprint('allocations', __name__)

def _unassigned_id(cursor):
    row = cursor.execute('SELECT id FROM accounts WHERE is_system = 1').fetchone()
    return row['id'] if row else None

def _is_system_account(cursor, account_id):
    if account_id is None:
        return False
    row = cursor.execute('SELECT is_system FROM accounts WHERE id = ?', (int(account_id),)).fetchone()
    return bool(row and row['is_system'])

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
    alloc_id = cursor.lastrowid
    # Funding from Unassigned Dollars: assigning money to an envelope reduces
    # Unassigned and raises the owning account's total (if it's a real, non-system account).
    if amount_available > 0:
        u = _unassigned_id(cursor)
        if u is not None and (account_id is None or int(account_id) != u):
            cursor.execute('UPDATE accounts SET balance = balance - ? WHERE id = ?', (amount_available, u))
            cursor.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', (amount_available, int(account_id)))
            # Reflect the assignment from Unassigned in the transaction table so it
            # shows up in the Transactions view: a debit on Unassigned and a credit
            # on the owning account.
            owner_id = int(account_id)
            date_str = datetime.now().strftime('%Y-%m-%d')
            desc = f"New allocation: {name}"
            cursor.execute('''
                INSERT INTO transactions (description, amount, date, account_id, allocation_id, type)
                VALUES (?, ?, ?, ?, ?, 'transfer')
            ''', (desc, -abs(amount_available), date_str, u, alloc_id))
            cursor.execute('''
                INSERT INTO transactions (description, amount, date, account_id, allocation_id, type)
                VALUES (?, ?, ?, ?, ?, 'transfer')
            ''', (desc, abs(amount_available), date_str, owner_id, alloc_id))
        elif u is not None:
            # Funding Unassigned's own envelope keeps Unassigned neutral.
            pass
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@allocations_bp.route('/api/allocations/<int:alloc_id>', methods=['PUT', 'DELETE'])
def manage_allocation(alloc_id):
    conn = get_db()
    cursor = conn.cursor()
    if request.method == 'DELETE':
        # Return remaining funds to Unassigned Dollars and, if the envelope belongs
        # to a real account, remove that funding from the account's total as well.
        cur = cursor.execute('SELECT amount_available, account_id FROM allocations WHERE id = ?', (alloc_id,)).fetchone()
        available = float(cur['amount_available']) if cur else 0.0
        owner = cur['account_id'] if cur else None
        cursor.execute('DELETE FROM allocations WHERE id = ?', (alloc_id,))
        if available > 0:
            u = _unassigned_id(cursor)
            if u is not None:
                cursor.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', (available, u))
            if owner is not None and (u is None or int(owner) != u):
                cursor.execute('UPDATE accounts SET balance = balance - ? WHERE id = ?', (available, int(owner)))
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

        # Reflect changes to assigned money: increasing the envelope pulls funds from
        # Unassigned into the owning account's total; decreasing returns them.
        cur = cursor.execute('SELECT amount_available FROM allocations WHERE id = ?', (alloc_id,)).fetchone()
        old_available = float(cur['amount_available']) if cur else 0.0
        delta = amount_available - old_available

        cursor.execute('''
            UPDATE allocations
            SET name = ?, target_amount = ?, amount_available = ?, target_date = ?, account_id = ?
            WHERE id = ?
        ''', (name, target_amount, amount_available, target_date, account_id, alloc_id))

        if cur is not None and delta != 0:
            u = _unassigned_id(cursor)
            if u is not None and (account_id is None or int(account_id) != u):
                # Money moves between Unassigned and the real account that owns the envelope.
                cursor.execute('UPDATE accounts SET balance = balance - ? WHERE id = ?', (delta, u))
                cursor.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', (delta, int(account_id)))
            elif u is not None:
                # Envelope owned by Unassigned itself stays neutral.
                pass
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

    unassigned_id = _unassigned_id(cursor)

    def _is_unassigned(ref):
        if ref is None:
            return False
        # The frontend sends unassigned_<accountId> to reference the Unassigned Dollars
        # account without colliding with allocation ids.
        return str(ref).startswith('unassigned')

    if _is_unassigned(from_id):
        from_name = "Unassigned Dollars"
        from_account_id = None
        if unassigned_id is not None:
            cursor.execute('UPDATE accounts SET balance = balance - ? WHERE id = ?', (amount, unassigned_id))
    else:
        cursor.execute('UPDATE allocations SET amount_available = amount_available - ? WHERE id = ?', (amount, int(from_id)))
        from_alloc = cursor.execute('SELECT name, account_id FROM allocations WHERE id = ?', (int(from_id),)).fetchone()
        from_name = from_alloc['name'] if from_alloc else "Allocation"
        from_account_id = from_alloc['account_id'] if from_alloc else None

    if _is_unassigned(to_id):
        to_name = "Unassigned Dollars"
        to_account_id = None
        if unassigned_id is not None:
            cursor.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', (amount, unassigned_id))
    else:
        cursor.execute('UPDATE allocations SET amount_available = amount_available + ? WHERE id = ?', (amount, int(to_id)))
        to_alloc = cursor.execute('SELECT name, account_id FROM allocations WHERE id = ?', (int(to_id),)).fetchone()
        to_name = to_alloc['name'] if to_alloc else "Allocation"
        to_account_id = to_alloc['account_id'] if to_alloc else None

    # A transfer between two different accounts (or Unassigned <-> an account)
    # should also move the host account balances so the account totals reflect
    # the reallocation across accounts.
    if from_account_id is not None and to_account_id is not None and from_account_id != to_account_id:
        # source account loses the money, destination account gains it
        cursor.execute('UPDATE accounts SET balance = balance - ? WHERE id = ?', (amount, from_account_id))
        cursor.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', (amount, to_account_id))
    elif from_account_id is not None and to_account_id is None:
        # moving out of an account envelope into Unassigned
        cursor.execute('UPDATE accounts SET balance = balance - ? WHERE id = ?', (amount, from_account_id))
    elif from_account_id is None and to_account_id is not None:
        # moving from Unassigned into an account envelope
        cursor.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', (amount, to_account_id))

    desc = f"Transfer: {from_name} ➔ {to_name}"
    date_str = datetime.now().strftime('%Y-%m-%d')

    # Resolve the account each side is displayed under. When a side is
    # Unassigned Dollars, we display it under the Unassigned account id.
    from_source_id = from_account_id if from_account_id is not None else unassigned_id
    to_target_id = to_account_id if to_account_id is not None else unassigned_id

    if from_source_id is not None and to_target_id is not None and from_source_id == to_target_id:
        # Transfer within the same account: keep a single row so we don't
        # double-count, and use the positive amount on the destination.
        cursor.execute('''
            INSERT INTO transactions (description, amount, date, account_id, allocation_id, type)
            VALUES (?, ?, ?, ?, NULL, 'transfer')
        ''', (desc, amount, date_str, to_target_id))
    elif from_source_id is not None:
        # Debit row on the source account (shown as a deduction).
        cursor.execute('''
            INSERT INTO transactions (description, amount, date, account_id, allocation_id, type)
            VALUES (?, ?, ?, ?, NULL, 'transfer')
        ''', (desc, -abs(amount), date_str, from_source_id))
        # Credit row on the destination account (shown as an addition).
        cursor.execute('''
            INSERT INTO transactions (description, amount, date, account_id, allocation_id, type)
            VALUES (?, ?, ?, ?, NULL, 'transfer')
        ''', (desc, abs(amount), date_str, to_target_id))
    
    conn.commit()
    conn.close()
    return jsonify({'success': True})
