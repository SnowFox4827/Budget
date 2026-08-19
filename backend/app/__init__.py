from flask import Flask
from app.db import init_db
from app.routes import dashboard_bp, accounts_bp, allocations_bp, transactions_bp

def create_app():
    """Application factory for Budget backend."""
    app = Flask(__name__)
    
    # Initialize DB tables
    init_db()
    
    # Register blueprints
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(accounts_bp)
    app.register_blueprint(allocations_bp)
    app.register_blueprint(transactions_bp)
    
    return app
