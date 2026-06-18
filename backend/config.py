from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from sqlalchemy import event, Engine

app = Flask(__name__)
CORS(app)



# PostgreSQL
app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql://app_user:password@127.0.0.1:5433/dropout_predictor?sslmode=disable"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Оптимизации 
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_size": 10,           # Кол-во соединений в пуле
    "pool_recycle": 3600,      # Пересоздавать соединения каждые 1 час
    "pool_pre_ping": True,     # Проверять соединение перед использованием
    "connect_args": {
        "options": "-c statement_timeout=30000"  # Таймаут запросов: 30 сек
    }
}

db = SQLAlchemy(app)