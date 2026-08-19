from app.routes.dashboard import dashboard_bp
from app.routes.accounts import accounts_bp
from app.routes.allocations import allocations_bp
from app.routes.transactions import transactions_bp
from app.routes.backup import backup_bp

__all__ = ['dashboard_bp', 'accounts_bp', 'allocations_bp', 'transactions_bp', 'backup_bp']
