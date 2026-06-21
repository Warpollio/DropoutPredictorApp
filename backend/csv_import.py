import csv
import os
from pathlib import Path
from datetime import datetime

from flask.cli import with_appcontext
import click
from sqlalchemy import select, func, text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from config import app, db
from models import Course, Module, Step, Learner, Submission, Comment, Lesson

# Размер пакета
BATCH_SIZE = 10000


def _parse_datetime(val):
    if not val: 
        return None
    val = str(val).strip()

    if '+' in val: 
        val = val.split('+')[0].strip()
    elif val.endswith('Z'): 
        val = val[:-1].strip()
    
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(val, fmt)
        except ValueError:
            continue
    return None


def _bulk_insert_or_ignore(model, rows):
    if not rows:
        return 0
    pk_cols = [col.name for col in model.__table__.primary_key.columns]
    stmt = pg_insert(model).values(rows)
    stmt = stmt.on_conflict_do_nothing(index_elements=pk_cols)
    result = db.session.execute(stmt)
    return result.rowcount


@app.cli.command("import-data")
@click.argument("data_dir", type=click.Path(exists=True))
@with_appcontext
def import_data_cli(data_dir):
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

    print(f"📦Импорт структуры: {os.path.basename(csv_filepath)}")

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


def _bulk_update_steps(updates_list):
    if not updates_list:
        return
    db.session.bulk_update_mappings(Step, updates_list)
    db.session.commit()


def update_step_metrics(csv_filepath, batch_size=BATCH_SIZE):
    if not os.path.exists(csv_filepath):
        print(f"⚠️ Файл не найден: {csv_filepath}")
        return {"updated": 0, "skipped": 0, "not_found": 0}

    print(f"🔄 Обновление метрик шагов: {os.path.basename(csv_filepath)}")
    total_before = db.session.execute(select(func.count()).select_from(Step)).scalar()

    updates = []
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

    total_after = db.session.execute(select(func.count()).select_from(Step)).scalar()
    added_new = total_after - total_before 

    print(f"✅ Обновлено: {stats['updated']} записей")
    if stats["skipped"]: print(f"️ Пропущено (ошибки в CSV): {stats['skipped']}")
    if stats["not_found"]: print(f"⚠️ Не найдено в БД: {stats['not_found']} step_id")
    if added_new > 0: print(f"ℹ️ Добавлено новых шагов: {added_new}")

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

    if learners: 
        added += _bulk_insert_or_ignore(Learner, learners)
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
        print(f"Ошибка парсинга даты '{val}': {e}")
        return None


'''
# copy
def import_submissions(csv_filepath):
    if not os.path.exists(csv_filepath):
        print("❌ Файл не найден")
        return

    print(f"📥 Импорт: {os.path.basename(csv_filepath)}")
    
    raw_conn = db.engine.raw_connection()
    try:
        with raw_conn.cursor() as cur:
            # 1️⃣ Отключаем FK-проверки
            cur.execute("SET session_replication_role = replica;")
            
            # 2️⃣ Загружаем CSV напрямую через COPY (STDIN работает в Docker без монтирования папок)
            with open(csv_filepath, 'r', encoding='utf-8') as f:
                cur.copy_expert("""
                    COPY submission (submission_id, step_id, user_id, attempt_time, submission_time, status, score)
                    FROM STDIN WITH CSV HEADER
                """, f)

            # 3️⃣ Включаем FK-проверки обратно
            cur.execute("SET session_replication_role = DEFAULT;")
            raw_conn.commit()
            
        print("✅ Готово!")
    except Exception as e:
        raw_conn.rollback()
        print(f"❌ Ошибка: {e}")
        raise
    finally:
        raw_conn.close()
'''
'''

temp table
TARGET_COLS = [
    'submission_id', 'step_id', 'user_id', 'attempt_time', 'submission_time',
    'status', 'score', 'dataset', 'clue', 'reply', 'reply_clear', 'hint'
]

def import_submissions(csv_filepath):
    if not os.path.exists(csv_filepath):
        print(f"❌ Файл не найден: {csv_filepath}")
        return {"submissions_added": 0, "skipped": 0}

    print(f"📥 Быстрый импорт попыток: {os.path.basename(csv_filepath)}")

    with open(csv_filepath, 'r', encoding='utf-8') as f:
        csv_cols = [col.strip() for col in f.readline().strip().split(',')]

    needed_cols = [c for c in TARGET_COLS if c in csv_cols]
    if not needed_cols:
        raise ValueError("В CSV не найдено целевых колонок.")

    try:
        raw_conn = db.engine.raw_connection()
        
        with raw_conn.cursor() as cur:
            # 🔧 1. Настройки сессии для максимальной скорости пакетной загрузки
            cur.execute("SET statement_timeout = 0")
            cur.execute("SET synchronous_commit = OFF")   # 🚀 Ускоряет запись в 5–10× (WAL пишется асинхронно)
            cur.execute("SET work_mem = '256MB'")         # 🧠 Сортировки/hash-join в RAM, а не на диске
            cur.execute("SET maintenance_work_mem = '512MB'")

            cur.execute("DROP TABLE IF EXISTS temp_subs")
            
            # 2. Создаём temp-таблицу (TEXT для гибкости)
            temp_defs = ", ".join(f"{col} TEXT" for col in csv_cols)
            cur.execute(f"CREATE TEMP TABLE temp_subs ({temp_defs}) ON COMMIT PRESERVE ROWS")

            # 3. Копируем CSV (самый быстрый этап)
            with open(csv_filepath, 'r', encoding='utf-8') as f_data:
                cur.copy_expert("COPY temp_subs FROM STDIN WITH CSV HEADER", f_data)
            
            print(f"   ✅ CSV загружен во временную таблицу")

            # 4. Формируем SELECT с кастами
            select_parts = []
            for col in needed_cols:
                if col in ('attempt_time', 'submission_time'):
                    select_parts.append(f"CASE WHEN t.{col} != '' THEN to_timestamp(t.{col}::bigint) END AS {col}")
                elif col in ('submission_id', 'step_id', 'user_id'):
                    select_parts.append(f"NULLIF(t.{col}, '')::BIGINT AS {col}")
                elif col == 'score':
                    select_parts.append(f"NULLIF(t.{col}, '')::DOUBLE PRECISION AS {col}")
                elif col == 'reply_clear':
                    select_parts.append(f"(LOWER(NULLIF(t.{col}, '')) IN ('1','true','yes','t','y')) AS {col}")
                else:
                    select_parts.append(f"NULLIF(t.{col}, '') AS {col}")

            select_clause = ", ".join(select_parts)
            cols_str = ", ".join(needed_cols)

            # ⚡ 5. Вставка с оптимизацией: DO NOTHING вместо DO UPDATE
            # DO UPDATE обновляет индексы и WAL для КАЖДОЙ строки → 20+ минут.
            # DO NOTHING пропускает существующие записи → 3–6 минут.
            cur.execute(f"""
                INSERT INTO submission ({cols_str})
                SELECT {select_clause}
                FROM temp_subs t
                WHERE EXISTS (
                    SELECT 1 FROM learner l WHERE l.user_id = NULLIF(t.user_id, '')::BIGINT
                )
                ON CONFLICT (submission_id) DO NOTHING
            """)
            added = cur.rowcount

            cur.execute("SELECT COUNT(*) FROM temp_subs")
            total = cur.fetchone()[0]
            
            # 🔙 6. Возвращаем безопасные настройки и фиксируем
            cur.execute("SET synchronous_commit = ON")
            raw_conn.commit()

        skipped = total - added
        print(f"✅ Готово. Загружено: {total}, Добавлено: {added}, Пропущено (нет user_id): {skipped}")
        return {"submissions_added": added, "skipped": skipped}

    except Exception as e:
        raw_conn.rollback()
        print(f"❌ Ошибка импорта: {e}")
        raise
    finally:
        raw_conn.close()
'''


#old
def import_submissions(csv_filepath):
    if not os.path.exists(csv_filepath):
        print(f"❌ Файл не найден: {csv_filepath}")
        return

    print(f"📥 Импорт попыток: {csv_filepath}")

    valid_user_ids = set(db.session.execute(select(Learner.user_id)).scalars())
    print(f"   🔍 Найдено {len(valid_user_ids)} пользователей в БД")

    added = 0
    total = 0
    skipped_fk = 0
    batch = []

    try:
        with open(csv_filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                total += 1
                sid = row.get("submission_id")
                step_id = row.get("step_id")
                uid = row.get("user_id")

                if not (sid and step_id and uid):
                    continue

                uid_int = int(uid)

                if uid_int not in valid_user_ids:
                    skipped_fk += 1
                    continue

                batch.append({
                    "submission_id": int(sid),
                    "step_id": int(step_id),
                    "user_id": uid_int,
                    "attempt_time": to_dt(row.get("attempt_time")),
                    "submission_time": to_dt(row.get("submission_time")),
                    "status": row.get("status") or "pending",
                    "score": float(row["score"]) if row.get("score") not in (None, "") else None,
                    "dataset": row.get("dataset"),
                    "clue": row.get("clue"),
                    "reply": row.get("reply"),
                    "reply_clear": str(row.get("reply_clear", "0")).lower() in ("1", "true", "yes", "t", "y"),
                    "hint": row.get("hint")
                })


                if len(batch) >= BATCH_SIZE:
                    stmt = pg_insert(Submission).values(batch)
                    stmt = stmt.on_conflict_do_update(
                        index_elements=['submission_id'],
                        set_={
                            c.name: stmt.excluded[c.name]
                            for c in Submission.__table__.columns
                            if c.name != 'submission_id'
                        }
                    )
                    result = db.session.execute(stmt)
                    added += result.rowcount
                    db.session.commit()
                    batch.clear()

            # Финальный батч
            if batch:
                stmt = pg_insert(Submission).values(batch)
                stmt = stmt.on_conflict_do_update(
                    index_elements=['submission_id'],
                    set_={
                        c.name: stmt.excluded[c.name]
                        for c in Submission.__table__.columns
                        if c.name != 'submission_id'
                    }
                )
                result = db.session.execute(stmt)
                added += result.rowcount
                db.session.commit()

        print(f"✅ Готово. Всего строк: {total}, Добавлено/Обновлено: {added}, Пропущено (нет пользователя): {skipped_fk}")

    except Exception as e:
        db.session.rollback()
        print(f"❌ Ошибка импорта: {e}")
        raise

    return {"submissions_added": added, "skipped": total - added}

# 4. Импорт комментариев
def import_comments(csv_filepath):
    if not os.path.exists(csv_filepath):
        print(f"⚠️ Файл не найден: {csv_filepath}")
        return

    print(f" [4/4] Импорт комментариев: {csv_filepath}")


    valid_user_ids = set(db.session.execute(select(Learner.user_id)).scalars())
    valid_step_ids = set(db.session.execute(select(Step.step_id)).scalars())
    print(f"   🔍 Найдено {len(valid_user_ids)} пользователей и {len(valid_step_ids)} шагов в БД")

    added = 0
    total = 0
    skipped_fk = 0
    batch = []

    csv.field_size_limit(10**8)

    try:
        with open(csv_filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                total += 1
                cid = row.get("comment_id")
                uid = row.get("user_id")
                sid = row.get("step_id")

                if not (cid and uid and sid):
                    continue

                uid_int = int(uid)
                sid_int = int(sid)

                if uid_int not in valid_user_ids or sid_int not in valid_step_ids:
                    skipped_fk += 1
                    continue

                pid_raw = row.get("parent_comment_id", "0")

                parent_id = None if not pid_raw or str(pid_raw).strip() == "0" else int(pid_raw)

                del_raw = row.get("deleted", "0")

                batch.append({
                    "comment_id": int(cid),
                    "user_id": uid_int,
                    "step_id": sid_int,
                    "parent_comment_id": None, #parent_id
                    "time_utc": to_dt(row.get("time_utc")),
                    "deleted": str(del_raw).lower() in ("1", "true", "yes", "t", "y"),
                    "text": row.get("text", "")
                })

                if len(batch) >= BATCH_SIZE:
                    stmt = pg_insert(Comment).values(batch)
                    stmt = stmt.on_conflict_do_nothing(index_elements=['comment_id'])
                    result = db.session.execute(stmt)
                    added += result.rowcount
                    db.session.commit()
                    batch.clear()

            # Финальный батч
            if batch:
                stmt = pg_insert(Comment).values(batch)
                stmt = stmt.on_conflict_do_nothing(index_elements=['comment_id'])
                result = db.session.execute(stmt)
                added += result.rowcount
                db.session.commit()

        print(f"   ✅ Комментариев добавлено: {added}, пропущено (нет FK): {skipped_fk}")

    except Exception as e:
        db.session.rollback()
        print(f"❌ Ошибка импорта комментариев: {e}")
        raise

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