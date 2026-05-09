import csv
from pathlib import Path
from sqlalchemy import insert
from flask.cli import with_appcontext
import click
from config import app, db
from models import Course, Module, Step, Learner, Submission, Comment, Lesson
from sqlalchemy import insert, select, func

import os

from datetime import datetime

def _parse_datetime(val):
    """Безопасно парсит даты, убирая таймзону для SQLite"""
    if not val: return None
    val = str(val).strip()
    # Убираем +00:00, +03:00 или Z
    if '+' in val: val = val.split('+')[0].strip()
    elif val.endswith('Z'): val = val[:-1].strip()
    
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(val, fmt)
        except ValueError:
            continue
    return None


# Размер пакета для коммита (оптимально для SQLite)
BATCH_SIZE = 500

def _bulk_insert_or_ignore(model, rows):
    """Вспомогательная функция для пакетной вставки INSERT OR IGNORE"""
    if not rows:
        return 0
    # SQLAlchemy 2.0 + SQLite специфика
    stmt = insert(model).values(rows).prefix_with("OR IGNORE")
    result = db.session.execute(stmt)
    return result.rowcount

@app.cli.command("import-data")
@click.argument("data_dir", type=click.Path(exists=True))
@with_appcontext
def import_data_cli(data_dir):
    """Импорт CSV данных в БД. Пример: flask import-data ./data"""
    data_path = Path(data_dir)
    
    print("📥 Запуск импорта данных...")
    import_structure(data_path / "course-122310-structure-2025-04-05-03-35-29.csv")
    import_learners(data_path / "course-122310-learners-2025-04-05-03-35-23.csv")
    import_submissions(data_path / "course-122310-submissions-full-2025-04-05-02-03-54.csv")
    import_comments(data_path / "course-122310-comments-2025-04-05-03-35-31.csv")
    print("🎉 Импорт успешно завершён!")

# ==============================================================================
# 1. Импорт структуры (Course -> Module -> Step)
# ==============================================================================
def import_structure(csv_filepath):
    if not os.path.exists(csv_filepath):
        print(f"⚠️ Файл не найден: {csv_filepath}")
        return {"courses": 0, "modules": 0, "lessons": 0, "steps": 0}

    print(f"📦 [1/4] Импорт структуры: {os.path.basename(csv_filepath)}")

    # 1. Считаем записи ДО импорта (для точной статистики)
    c_before = db.session.execute(select(func.count()).select_from(Course)).scalar()
    m_before = db.session.execute(select(func.count()).select_from(Module)).scalar()
    l_before = db.session.execute(select(func.count()).select_from(Lesson)).scalar()
    s_before = db.session.execute(select(func.count()).select_from(Step)).scalar()

    courses, modules, lessons, steps = [], [], [], []

    with open(csv_filepath, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            cid = row.get("course_id")
            mid = row.get("module_id")
            lid = row.get("lesson_id")
            sid = row.get("step_id")

            if cid:
                courses.append({
                    "course_id": int(cid),
                    "name": f"Course {cid}",
                    "difficulty": 0.5,
                    "discrimination": 0.5
                })

            if mid and cid:
                modules.append({
                    "module_id": int(mid),
                    "course_id": int(cid),
                    "position": int(row.get("module_position") or 0),
                    "difficulty": 0.5,
                    "discrimination": 0.5
                })

            if lid and mid:
                lessons.append({
                    "lesson_id": int(lid),
                    "module_id": int(mid),
                    "position": int(row.get("lesson_position") or 0),
                    "begin_date_utc": _parse_datetime(row.get("begin_date_utc")),
                    "end_date_utc": _parse_datetime(row.get("end_date_utc")),
                    "soft_deadline_utc": _parse_datetime(row.get("soft_deadline_utc")),
                    "hard_deadline_utc": _parse_datetime(row.get("hard_deadline_utc")),
                    "grading_policy": row.get("grading_policy")
                })

            # ⚠️ ВАЖНО: Step теперь ссылается на lesson_id, а не module_id
            if sid and lid:
                steps.append({
                    "step_id": int(sid),
                    "lesson_id": int(lid),
                    "position": int(row.get("step_position") or 0),
                    "step_type": row.get("step_type"),
                    "step_cost": float(row.get("step_cost") or 0),
                    "difficulty": 0.5,
                    "discrimination": 0.5
                })

            # Пакетный коммит при достижении лимита
            if len(courses) >= BATCH_SIZE:
                _bulk_insert_or_ignore(Course, courses); db.session.commit(); courses.clear()
            if len(modules) >= BATCH_SIZE:
                _bulk_insert_or_ignore(Module, modules); db.session.commit(); modules.clear()
            if len(lessons) >= BATCH_SIZE:
                _bulk_insert_or_ignore(Lesson, lessons); db.session.commit(); lessons.clear()
            if len(steps) >= BATCH_SIZE:
                _bulk_insert_or_ignore(Step, steps); db.session.commit(); steps.clear()

    # 2. Вставляем остатки
    if courses: _bulk_insert_or_ignore(Course, courses)
    if modules: _bulk_insert_or_ignore(Module, modules)
    if lessons: _bulk_insert_or_ignore(Lesson, lessons)
    if steps: _bulk_insert_or_ignore(Step, steps)
    db.session.commit()

    # 3. Считаем записи ПОСЛЕ импорта → получаем точное число добавленных строк
    added_c = db.session.execute(select(func.count()).select_from(Course)).scalar() - c_before
    added_m = db.session.execute(select(func.count()).select_from(Module)).scalar() - m_before
    added_l = db.session.execute(select(func.count()).select_from(Lesson)).scalar() - l_before
    added_s = db.session.execute(select(func.count()).select_from(Step)).scalar() - s_before

    print(f"   ✅ Добавлено: Курсов={added_c}, Модулей={added_m}, Уроков={added_l}, Шагов={added_s}")
    return {"courses": added_c, "modules": added_m, "lessons": added_l, "steps": added_s}
# ==============================================================================
# 2. Импорт пользователей
# ==============================================================================
def import_learners(csv_filepath):
    if not os.path.exists(csv_filepath):
        print(f"⚠️ Файл не найден: {csv_filepath}")
        return

    print(f"👥 [2/4] Импорт пользователей: {csv_filepath}")
    learners, added = [], 0

    with open(csv_filepath, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            uid = row.get("user_id")
            if not uid: continue

            learners.append({
                "user_id": int(uid),
                "last_name": row.get("last_name", ""),
                "first_name": row.get("first_name", ""),
                "last_login": _parse_datetime(row.get("last_login_utc")),
                "date_joined_utc": _parse_datetime(row.get("date_joined_utc"))
            })

            if len(learners) >= BATCH_SIZE:
                added += _bulk_insert_or_ignore(Learner, learners)
                db.session.commit()
                learners.clear()

    if learners: added += _bulk_insert_or_ignore(Learner, learners)
    db.session.commit()
    print(f"   ✅ Пользователей добавлено: {added}")
    return {"users_added": added}

# ==============================================================================
# 3. Импорт попыток (Submissions)
# ==============================================================================
def import_submissions(csv_filepath):
    if not os.path.exists(csv_filepath):
        print(f"⚠️ Файл не найден: {csv_filepath}")
        return

    print(f"📝 [3/4] Импорт попыток: {csv_filepath}")
    subs, added = [], 0
    total = 0
    with open(csv_filepath, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            total += 1
            sid, step_id, uid = row.get("submission_id"), row.get("step_id"), row.get("user_id")
            if not sid or not step_id or not uid: continue

            rc = row.get("reply_clear", "0")
            subs.append({
                "submission_id": int(sid),
                "step_id": int(step_id),
                "user_id": int(uid),
                "attempt_time": _parse_datetime(row.get("attempt_time")),
                "submission_time": _parse_datetime(row.get("submission_time")),
                "status": row.get("status") or "pending",
                "score": float(row["score"]) if row.get("score") else None,
                "dataset": row.get("dataset") or None,
                "clue": row.get("clue") or None,
                "reply": row.get("reply") or None,
                "reply_clear": str(rc).lower() in ("1", "true", "yes", "t", "y"),
                "hint": row.get("hint") or None
            })

            if len(subs) >= BATCH_SIZE:
                added += _bulk_insert_or_ignore(Submission, subs)
                db.session.commit()
                subs.clear()

    if subs: added += _bulk_insert_or_ignore(Submission, subs)
    db.session.commit()
    print(f"   ✅ Попыток добавлено: {added}")
    return {"submissions_added": added, "skipped": total - added}

# ==============================================================================
# 4. Импорт комментариев
# ==============================================================================
def import_comments(csv_filepath):
    if not os.path.exists(csv_filepath):
        print(f"⚠️ Файл не найден: {csv_filepath}")
        return

    print(f"💬 [4/4] Импорт комментариев: {csv_filepath}")
    comments, added = [], 0
    total = 0
    with open(csv_filepath, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            total += 1
            cid, uid, sid = row.get("comment_id"), row.get("user_id"), row.get("step_id")
            if not cid or not uid or not sid: continue

            pid_raw = row.get("parent_comment_id", "0")
            parent_id = None if not pid_raw or str(pid_raw).strip() == "0" else int(pid_raw)

            del_raw = row.get("deleted", "0")
            comments.append({
                "comment_id": int(cid),
                "user_id": int(uid),
                "step_id": int(sid),
                "parent_comment_id": parent_id,
                "time_utc": _parse_datetime(row.get("time_utc")),
                "deleted": str(del_raw).lower() in ("1", "true", "yes", "t", "y"),
                "text": row.get("text", "")
            })

            if len(comments) >= BATCH_SIZE:
                added += _bulk_insert_or_ignore(Comment, comments)
                db.session.commit()
                comments.clear()

    if comments: added += _bulk_insert_or_ignore(Comment, comments)
    db.session.commit()
    print(f"   ✅ Комментариев добавлено: {added}")
    return {"comments_added": added, "skipped": total - added}

# ==============================================================================
# Запуск как standalone скрипт
# ==============================================================================
if __name__ == "__main__":
    with app.app_context():
        data_dir = Path(__file__).resolve().parent.parent / "data"
        print("📥 Запуск standalone импорта...")
        import_structure(data_dir / "course-122310-structure-2025-04-05-03-35-29.csv")
        import_learners(data_dir / "course-122310-learners-2025-04-05-03-35-23.csv")
        import_submissions(data_dir / "course-122310-submissions-full-2025-04-05-02-03-54.csv")
        import_comments(data_dir / "course-122310-comments-2025-04-05-03-35-31.csv")
        print("🎉 Импорт завершён!")