import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_migrate import Migrate

app = Flask(__name__, static_folder='static')
CORS(app)

DB_HOST = os.environ.get('DB_HOST', '127.0.0.1')
DB_PORT = os.environ.get('DB_PORT', '5433')

app.config["SQLALCHEMY_DATABASE_URI"] = f"postgresql://app_user:password@{DB_HOST}:{DB_PORT}/dropout_predictor?sslmode=disable"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_size": 10,
    "pool_recycle": 3600,
    "pool_pre_ping": True,
    "connect_args": {
        "options": "-c statement_timeout=30000"
    }
}

db = SQLAlchemy(app)

migrate = Migrate(app, db)