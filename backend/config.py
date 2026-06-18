from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from sqlalchemy import event, Engine  # ← Добавили импорты

app = Flask(__name__)
CORS(app)

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///database.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """
    Настраивает SQLite для работы с фоновыми потоками.
    Вызывается автоматически при каждом новом соединении с БД.
    """
    # Проверяем, что это действительно SQLite
    if 'sqlite' in str(dbapi_connection):
        cursor = dbapi_connection.cursor()
        
        # WAL-режим: позволяет читать во время записи (критично для потоков!)
        cursor.execute("PRAGMA journal_mode=WAL")
        
        # Ждать блокировку до 10
        cursor.execute("PRAGMA busy_timeout=10000")
        
        # (NORMAL быстрее FULL, но безопаснее OFF)
        cursor.execute("PRAGMA synchronous=NORMAL")
        
        # Кэш 64 МБ в оперативной памяти
        cursor.execute("PRAGMA cache_size=-64000")
        
        cursor.close()