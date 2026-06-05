import csv
from pathlib import Path
from sqlalchemy import insert
from flask.cli import with_appcontext
import click
from config import app, db
from models import Course, Module, Step, Learner, Submission, Comment, Lesson
from sqlalchemy import insert, select, func
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

import os

from datetime import datetime

def _parse_datetime(val):

    if not val: return None
    val = str(val).strip()

    if '+' in val: val = val.split('+')[0].strip()
    elif val.endswith('Z'): val = val[:-1].strip()
    
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(val, fmt)
        except ValueError:
            continue
    return None


# Размер пакета
BATCH_SIZE = 10000

def _bulk_insert_or_ignore(model, rows):
    """Вспомогательная функция для пакетной вставки INSERT OR IGNORE"""
    if not rows:
        return 0
    stmt = insert(model).values(rows).prefix_with("OR IGNORE")
    result = db.session.execute(stmt)
    return result.rowcount

def _bulk_upsert(model, data_list):
    if not data_list:
        return 0
    
    stmt = sqlite_insert(model).values(data_list)
    
    stmt = stmt.on_conflict_do_update(
        index_elements=['submission_id'],
        set_={
            col.name: stmt.excluded[col.name] 
            for col in model.__table__.columns 
            if col.name != 'submission_id'
        }
    )
    
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
    print("🎉 Импорт успешно завершён")


# 1. Импорт структуры (Course -> Module -> Step)
def import_structure(csv_filepath):
    if not os.path.exists(csv_filepath):
        print(f"⚠️ Файл не найден: {csv_filepath}")
        return {"courses": 0, "modules": 0, "lessons": 0, "steps": 0}

    print(f"📦 [1/4] Импорт структуры: {os.path.basename(csv_filepath)}")

    # для статистики
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


            if len(courses) >= BATCH_SIZE:
                _bulk_insert_or_ignore(Course, courses); db.session.commit(); courses.clear()
            if len(modules) >= BATCH_SIZE:
                _bulk_insert_or_ignore(Module, modules); db.session.commit(); modules.clear()
            if len(lessons) >= BATCH_SIZE:
                _bulk_insert_or_ignore(Lesson, lessons); db.session.commit(); lessons.clear()
            if len(steps) >= BATCH_SIZE:
                _bulk_insert_or_ignore(Step, steps); db.session.commit(); steps.clear()

    # остатки
    if courses: _bulk_insert_or_ignore(Course, courses)
    if modules: _bulk_insert_or_ignore(Module, modules)
    if lessons: _bulk_insert_or_ignore(Lesson, lessons)
    if steps: _bulk_insert_or_ignore(Step, steps)
    db.session.commit()

    added_c = db.session.execute(select(func.count()).select_from(Course)).scalar() - c_before
    added_m = db.session.execute(select(func.count()).select_from(Module)).scalar() - m_before
    added_l = db.session.execute(select(func.count()).select_from(Lesson)).scalar() - l_before
    added_s = db.session.execute(select(func.count()).select_from(Step)).scalar() - s_before

    print(f"Добавлено: Курсов={added_c}, Модулей={added_m}, Уроков={added_l}, Шагов={added_s}")
    return {"courses": added_c, "modules": added_m, "lessons": added_l, "steps": added_s}



# difficulty, discrimination

def _bulk_update_steps(updates_list):
    if not updates_list:
        return


    db.session.bulk_update_mappings(Step, updates_list)
    db.session.commit()


def update_step_metrics(csv_filepath, batch_size=BATCH_SIZE):

    if not os.path.exists(csv_filepath):
        print(f"⚠️ Файл не найден: {csv_filepath}")
        return {"updated": 0, "skipped": 0, "not_found": 0}

    print(f"🔄  Обновление метрик шагов: {os.path.basename(csv_filepath)}")


    total_before = db.session.execute(select(func.count()).select_from(Step)).scalar()

    updates = []  # Список словарей для bulk_update_mappings
    stats = {"updated": 0, "skipped": 0, "not_found": 0}
    step_ids_to_update = set()

    with open(csv_filepath, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            sid = row.get("step_id")
            if not sid:
                stats["skipped"] += 1
                continue

            try:
                step_id = int(sid)
                difficulty = float(row.get("difficulty") or 0.5)
                discrimination = float(row.get("discrimination") or 0.5)


                difficulty = max(0.0, min(1.0, difficulty))
                discrimination = max(-1.0, min(1.0, discrimination))

                updates.append({
                    "step_id": step_id,
                    "difficulty": difficulty,
                    "discrimination": discrimination
                })
                step_ids_to_update.add(step_id)

            except (ValueError, TypeError) as e:
                print(f"⚠️ Ошибка парсинга строки (step_id={sid}): {e}")
                stats["skipped"] += 1
                continue


            if len(updates) >= batch_size:
                _bulk_update_steps(updates)
                stats["updated"] += len(updates)
                updates.clear()


    if updates:
        _bulk_update_steps(updates)
        stats["updated"] += len(updates)
        updates.clear()


    if step_ids_to_update:
        existing = db.session.execute(
            select(Step.step_id).where(Step.step_id.in_(step_ids_to_update))
        ).scalars().all()
        stats["not_found"] = len(step_ids_to_update) - len(existing)

    #  статистика
    total_after = db.session.execute(select(func.count()).select_from(Step)).scalar()
    added_new = total_after - total_before 

    print(f"✅ Обновлено: {stats['updated']} записей")
    if stats["skipped"]:
        print(f"⚠️ Пропущено (ошибки в CSV): {stats['skipped']}")
    if stats["not_found"]:
        print(f"⚠️ Не найдено в БД: {stats['not_found']} step_id")
    if added_new > 0:
        print(f"ℹ️  Добавлено новых шагов: {added_new}")

    return stats


# 2. Импорт пользователей

def import_learners(csv_filepath):
    if not os.path.exists(csv_filepath):
        print(f"⚠️ Файл не найден: {csv_filepath}")
        return

    print(f"👥 Импорт пользователей: {csv_filepath}")
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


# 3. Импорт попыток (Submissions)
def to_dt(val):
    if not val or str(val).strip() == "":
        return None
    try:
        return datetime.utcfromtimestamp(float(val))
    except Exception as e:
        print(f"Oшибка парсинга даты '{val}': {e}")
        return None
'''
def import_submissions(csv_filepath):
    if not os.path.exists(csv_filepath):
        print(f"Файл не найден: {csv_filepath}")
        return

    print(f"Импорт попыток: {csv_filepath}")
    subs, added = [], 0
    total = 0
    with open(csv_filepath, "r", encoding="utf-8") as f:
        for i, row in enumerate(csv.DictReader(f)):
            #if i >= 100: break
            total += 1
            sid, step_id, uid = row.get("submission_id"), row.get("step_id"), row.get("user_id")
            if not sid or not step_id or not uid: continue

            rc = row.get("reply_clear", "0")
            subs.append({
                "submission_id": int(sid),
                "step_id": int(step_id),
                "user_id": int(uid),
                "attempt_time": to_dt(row.get("attempt_time")),
                "submission_time": to_dt(row.get("submission_time")),
                "status": row.get("status") or "pending",
                "score": float(row["score"]) if row.get("score") else None,
                "dataset": row.get("dataset") or None,
                "clue": row.get("clue") or None,
                "reply": row.get("reply") or None,
                "reply_clear": str(rc).lower() in ("1", "true", "yes", "t", "y"),
                "hint": row.get("hint") or None
            })

            if len(subs) >= BATCH_SIZE:
                added += _bulk_upsert(Submission, subs)
                db.session.commit()
                subs.clear()

    if subs: added += _bulk_upsert(Submission, subs)
    db.session.commit()
    print(f"Попыток добавлено: {added}")
    return {"submissions_added": added, "skipped": total - added}
'''
from sqlalchemy import text

UPSERT_QUERY = text("""
    INSERT INTO submission (
        submission_id, step_id, user_id, attempt_time, submission_time,
        status, score, dataset, clue, reply, reply_clear, hint
    )
    VALUES (
        :submission_id, :step_id, :user_id, :attempt_time, :submission_time,
        :status, :score, :dataset, :clue, :reply, :reply_clear, :hint
    )
    ON CONFLICT(submission_id) DO UPDATE SET
        step_id=excluded.step_id, user_id=excluded.user_id,
        attempt_time=excluded.attempt_time, submission_time=excluded.submission_time,
        status=excluded.status, score=excluded.score, dataset=excluded.dataset,
        clue=excluded.clue, reply=excluded.reply, reply_clear=excluded.reply_clear, hint=excluded.hint
""")

def import_submissions(csv_filepath):
    if not os.path.exists(csv_filepath):
        print(f"❌ Файл не найден: {csv_filepath}")
        return

    print(f" Импорт попыток: {csv_filepath}")
    added = 0
    total = 0

    # 🔹 3. Временные оптимизации SQLite
    db.session.execute(text("PRAGMA journal_mode=WAL"))
    db.session.execute(text("PRAGMA synchronous=OFF"))
    db.session.execute(text("PRAGMA cache_size=-64000"))  # 64 МБ кэш
    db.session.execute(text("PRAGMA temp_store=MEMORY"))

    try:
        with open(csv_filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            batch = []

            for row in reader:
                total += 1
                sid = row.get("submission_id")
                step_id = row.get("step_id")
                uid = row.get("user_id")

                # Пропускаем строки без ключевых ID
                if not (sid and step_id and uid):
                    continue

                # 🔹 Минимум вызовов функций, безопасный парсинг
                batch.append({
                    "submission_id": int(sid),
                    "step_id": int(step_id),
                    "user_id": int(uid),
                    "attempt_time": to_dt(row.get("attempt_time")),
                    "submission_time": to_dt(row.get("submission_time")),
                    "status": row.get("status") or "pending",
                    # ✅ Исправлен баг с доступом к score
                    "score": float(row["score"]) if row.get("score") not in (None, "") else None,
                    "dataset": row.get("dataset"),
                    "clue": row.get("clue"),
                    "reply": row.get("reply"),
                    "reply_clear": str(row.get("reply_clear", "0")).lower() in ("1", "true", "yes", "t", "y"),
                    "hint": row.get("hint")
                })

                # 🔹 4. Пакетная вставка через executemany (raw SQL)
                if len(batch) >= BATCH_SIZE:
                    result = db.session.execute(UPSERT_QUERY, batch)
                    added += result.rowcount
                    batch.clear()

            # Финальный батч
            if batch:
                result = db.session.execute(UPSERT_QUERY, batch)
                added += result.rowcount

        db.session.commit()
        print(f"✅ Готово. Обработано: {total}, обновлено/добавлено: {added}")

    except Exception as e:
        db.session.rollback()
        print(f"❌ Ошибка импорта: {e}")
        raise
    finally:
        # 🔹 Всегда возвращаем безопасные настройки SQLite
        db.session.execute(text("PRAGMA synchronous=FULL"))
        db.session.execute(text("PRAGMA temp_store=DEFAULT"))
        db.session.commit()

    return {"submissions_added": added, "skipped": total - added}

INSERT_COMMENT_SQL = text("""
    INSERT OR IGNORE INTO comment (
        comment_id, user_id, step_id, parent_comment_id, time_utc, deleted, text
    )
    VALUES (
        :comment_id, :user_id, :step_id, :parent_comment_id, :time_utc, :deleted, :text
    )
""")

# 4. Импорт комментариев
def import_comments(csv_filepath):
    if not os.path.exists(csv_filepath):
        print(f"⚠️ Файл не найден: {csv_filepath}")
        return

    print(f"💬 [4/4] Импорт комментариев: {csv_filepath}")
    added = 0
    total = 0

    # 🔹 Временные оптимизации SQLite
    db.session.execute(text("PRAGMA journal_mode=WAL"))
    db.session.execute(text("PRAGMA synchronous=OFF"))
    db.session.execute(text("PRAGMA cache_size=-64000"))  # 64 МБ кэш
    db.session.execute(text("PRAGMA temp_store=MEMORY"))

    csv.field_size_limit(10**8)

    try:
        with open(csv_filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            batch = []

            for row in reader:
                total += 1
                cid = row.get("comment_id")
                uid = row.get("user_id")
                sid = row.get("step_id")

                # Пропускаем строки без ключевых ID
                if not (cid and uid and sid):
                    continue

                pid_raw = row.get("parent_comment_id", "0")
                parent_id = None if not pid_raw or str(pid_raw).strip() == "0" else int(pid_raw)

                del_raw = row.get("deleted", "0")

                batch.append({
                    "comment_id": int(cid),
                    "user_id": int(uid),
                    "step_id": int(sid),
                    "parent_comment_id": parent_id,
                    "time_utc": to_dt(row.get("time_utc")),
                    "deleted": str(del_raw).lower() in ("1", "true", "yes", "t", "y"),
                    "text": row.get("text", "")
                    #"text": ""
                })

                # 🔹 Пакетная вставка через raw SQL
                if len(batch) >= BATCH_SIZE:
                    result = db.session.execute(INSERT_COMMENT_SQL, batch)
                    added += result.rowcount
                    batch.clear()

            # Финальный батч
            if batch:
                result = db.session.execute(INSERT_COMMENT_SQL, batch)
                added += result.rowcount

        db.session.commit()
        print(f"   ✅ Комментариев добавлено: {added}")

    except Exception as e:
        db.session.rollback()
        print(f"❌ Ошибка импорта комментариев: {e}")
        raise
    finally:
        # 🔹 Всегда возвращаем безопасные настройки SQLite
        db.session.execute(text("PRAGMA synchronous=FULL"))
        db.session.execute(text("PRAGMA temp_store=DEFAULT"))
        db.session.commit()

    return {"comments_added": added, "skipped": total - added}

if __name__ == "__main__":
    with app.app_context():
        data_dir = Path(__file__).resolve().parent.parent / "data"
        print("📥 Запуск standalone импорта...")
        import_structure(data_dir / "course-122310-structure-2025-04-05-03-35-29.csv")
        import_learners(data_dir / "course-122310-learners-2025-04-05-03-35-23.csv")
        import_submissions(data_dir / "course-122310-submissions-full-2025-04-05-02-03-54.csv")
        import_comments(data_dir / "course-122310-comments-2025-04-05-03-35-31.csv")
        print("🎉 Импорт завершён!")