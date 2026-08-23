import sqlite3
import os

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
DB_PATH = os.path.join(DATA_DIR, 'budget.db')

# The name of the protected account that holds Unassigned Dollars.
UNASSIGNED_ACCOUNT_NAME = 'Unassigned Dollars'

def get_db():
    """Connect to SQLite database and return connection with Row factory."""
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database tables if they do not exist."""
    conn = get_db()
    cursor = conn.cursor()
    
    # Accounts
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            balance REAL DEFAULT 0.0,
            is_system INTEGER DEFAULT 0
        )
    ''')

    # Ensure the protected "Unassigned Dollars" system account exists (idempotent).
    existing = cursor.execute(
        'SELECT id, is_system FROM accounts WHERE is_system = 1 OR name = ?',
        (UNASSIGNED_ACCOUNT_NAME,)
    ).fetchone()
    if not existing:
        cursor.execute(
            'INSERT INTO accounts (name, balance, is_system) VALUES (?, 0.0, 1)',
            (UNASSIGNED_ACCOUNT_NAME,)
        )
    elif existing['is_system'] != 1:
        # A pre-existing account already carried this name; promote it to the protected system account.
        cursor.execute(
            'UPDATE accounts SET is_system = 1 WHERE id = ?',
            (existing['id'],)
        )
    
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
