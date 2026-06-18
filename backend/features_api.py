import threading
import time
from flask import Blueprint, request, jsonify
from sqlalchemy import select, func
from datetime import datetime
from collections import defaultdict
import statistics

from config import db, app
from models import Submission, UserStepFeature, UserDropoutFeature, Learner, ComputeTask, CourseFeature
from sqlalchemy.dialects.sqlite import insert as sqlite_insert


features_bp = Blueprint('features', __name__, url_prefix='/api/features')


# Вспомогательные функции

def _bulk_upsert(model, data_list, chunk_size=50, max_retries=5):
    """Пакетный UPSERT с повторными попытками при блокировке БД"""
    if not data_list:
        return 0
    
    pk_cols = [col.name for col in model.__table__.primary_key.columns]
    total = 0
    
    for i in range(0, len(data_list), chunk_size):
        chunk = data_list[i:i + chunk_size]
        
        # Retry-логика для каждого чанка
        for attempt in range(max_retries):
            try:
                stmt = sqlite_insert(model).values(chunk)
                stmt = stmt.on_conflict_do_update(
                    index_elements=pk_cols,
                    set_={
                        col.name: stmt.excluded[col.name] 
                        for col in model.__table__.columns 
                        if col.name not in pk_cols
                    }
                )
                db.session.execute(stmt)
                total += len(chunk)
                break  # Успех → выходим из цикла попыток
                
            except Exception as e:
                error_msg = str(e).lower()
                # Если блокировка БД и есть попытки — ждём и пробуем снова
                if ("database is locked" in error_msg or "locked" in error_msg) and attempt < max_retries - 1:
                    db.session.rollback()
                    # Экспоненциальная задержка: 0.05с → 0.1с → 0.2с → 0.4с → 0.8с
                    time.sleep(0.05 * (2 ** attempt))
                    continue
                else:
                    # Если не удалось или ошибка другая — пробрасываем дальше
                    raise
        
        # уступить поток другим запросам
        time.sleep(0.01)
        
    return total


def _compute_step_metrics(sub_list):
    """Вычисляет метрики для одного шага пользователя"""
    total = len(sub_list)
    if total == 0:
        return None

    first_correct_idx = None
    seq = []
    for i, sub in enumerate(sub_list):
        is_correct = sub.status == 'correct' or (sub.score is not None and sub.score >= 0.9)
        seq.append('C' if is_correct else 'W')
        if is_correct and first_correct_idx is None:
            first_correct_idx = i

    return {
        'user_id': sub_list[0].user_id,
        'step_id': sub_list[0].step_id,
        'total_attempts': total,
        'first_try_correct': (first_correct_idx == 0) if first_correct_idx is not None else None,
        'errors_before_success': first_correct_idx,
        'has_post_success_attempts': (first_correct_idx is not None and total > first_correct_idx + 1),
        'attempt_sequence': ','.join(seq),
        #'calculated_at': datetime.utcnow()
    }


def _process_user_metrics(cf_id, user_id, user_submissions, cutoff):
    step_metrics = []
    for (uid, sid), sub_list in user_submissions.items():
        metrics = _compute_step_metrics(sub_list)
        if metrics:
            metrics['cf_id'] = cf_id
            step_metrics.append(metrics)

    if step_metrics:
        _bulk_upsert(UserStepFeature, step_metrics, chunk_size=500)

    n = len(step_metrics)
    if n == 0:
        return

    first_try_cnt = sum(1 for m in step_metrics if m.get('first_try_correct'))
    attempts = [m['total_attempts'] for m in step_metrics]
    errors = [m['errors_before_success'] for m in step_metrics if m.get('errors_before_success') is not None]
    post_success_cnt = sum(1 for m in step_metrics if m.get('has_post_success_attempts'))

    user_feats = [{
        'cf_id': cf_id,  #PK часть 1
        'user_id': user_id,  # PK часть 2
        'first_try_success_rate': first_try_cnt / n,
        'avg_attempts_per_step': sum(attempts) / len(attempts),
        'std_attempts_per_step': statistics.stdev(attempts) if len(attempts) > 1 else 0.0,
        'pct_steps_with_post_success': post_success_cnt / n,
        'avg_errors_before_success': sum(errors) / len(errors) if errors else 0.0,
        'steps_completed': n,
        'prediction_cutoff_utc': cutoff
    }]

    if user_feats:
        _bulk_upsert(UserDropoutFeature, user_feats)



import time
import math
from sqlalchemy import text

def run_compute_task(task_id, params):
    with app.app_context():
        task = db.session.get(ComputeTask, task_id)
        try:
            task.status = 'running'
            task.message = 'Инициализация сессии...'
            db.session.commit()

            cutoff = datetime.utcnow()
            if params.get('cutoff_date'):
                cutoff = datetime.fromisoformat(params['cutoff_date'].replace('Z', '+00:00'))

            course_id = params.get('course_id')
            if not course_id:
                raise ValueError("course_id обязателен")

            # Создаём сессию вычисления
            session_record = CourseFeature(
                course_id=course_id, feature_version='v1.0',
                prediction_cutoff_utc=cutoff, description='SQL Window Functions (v2)'
            )
            db.session.add(session_record)
            db.session.flush()
            cf_id = session_record.cf_id

            # Оценка объёма
            total_users = db.session.execute(
                select(func.count(func.distinct(Submission.user_id))).where(Submission.submission_time <= cutoff)
            ).scalar() or 1

            task.message = f'Найдено {total_users} пользователей. Запуск SQL-агрегации...'
            task.progress = 0.1
            db.session.commit()

            step_agg_sql = text("""
                INSERT INTO user_step_feature
                (cf_id, user_id, step_id, total_attempts, first_try_correct,
                errors_before_success, has_post_success_attempts, attempt_sequence)
                WITH Ranked AS (
                    SELECT
                        user_id, step_id, status, score,
                        ROW_NUMBER() OVER(PARTITION BY user_id, step_id ORDER BY submission_time) as rn,
                        CASE WHEN status = 'correct' OR score >= 0.9 THEN 1 ELSE 0 END as is_correct
                    FROM submission
                    WHERE submission_time <= :cutoff
                ),
                StepAgg AS (
                    SELECT
                        user_id, step_id,
                        COUNT(*) as total_attempts,
                        MAX(CASE WHEN rn = 1 AND is_correct = 1 THEN 1 ELSE 0 END) as first_try_correct,
                        MIN(CASE WHEN is_correct = 1 THEN rn END) as first_correct_rn,
                        GROUP_CONCAT(CASE WHEN is_correct = 1 THEN 'C' ELSE 'W' END) as attempt_sequence
                    FROM Ranked
                    GROUP BY user_id, step_id
                )
                SELECT
                    :cf_id, user_id, step_id, total_attempts, first_try_correct,
                    CASE WHEN first_correct_rn IS NOT NULL THEN first_correct_rn - 1 ELSE NULL END,
                    CASE WHEN first_correct_rn IS NOT NULL AND total_attempts > first_correct_rn THEN 1 ELSE 0 END,
                    attempt_sequence
                FROM StepAgg
            """)

            db.session.execute(step_agg_sql, {"cutoff": cutoff, "cf_id": cf_id})
            db.session.commit()

            task.message = 'Агрегация шагов завершена. Вычисление пользовательских метрик...'
            task.progress = 0.7
            db.session.commit()

            # АГРЕГАЦИЯ ПОЛЬЗОВАТЕЛЬ-УРОВНЯ (быстрый SELECT по уже посчитанным шагам)
            user_agg_sql = text("""
                SELECT
                    user_id,
                    COUNT(*) as steps_completed,
                    AVG(total_attempts) as avg_attempts,
                    AVG(total_attempts * total_attempts) as avg_sq_attempts,
                    SUM(CASE WHEN first_try_correct = 1 THEN 1 ELSE 0 END) as first_try_cnt,
                    SUM(CASE WHEN has_post_success_attempts = 1 THEN 1 ELSE 0 END) as post_success_cnt,
                    AVG(errors_before_success) as avg_errors
                FROM user_step_feature
                WHERE cf_id = :cf_id
                GROUP BY user_id
            """)

            user_rows = db.session.execute(user_agg_sql, {"cf_id": cf_id}).fetchall()

            user_feats = []
            for row in user_rows:
                n = row.steps_completed
                if n == 0: continue

                avg_att = row.avg_attempts or 0.0
                # Стандартное отклонение = sqrt(среднее_квадратов - квадрат_среднего)
                variance = (row.avg_sq_attempts or 0.0) - (avg_att * avg_att)
                stddev = math.sqrt(max(0, variance))

                user_feats.append({
                    'cf_id': cf_id,
                    'user_id': row.user_id,
                    'first_try_success_rate': (row.first_try_cnt or 0) / n,
                    'avg_attempts_per_step': avg_att,
                    'std_attempts_per_step': stddev,
                    'pct_steps_with_post_success': (row.post_success_cnt or 0) / n,
                    'avg_errors_before_success': row.avg_errors or 0.0,
                    'steps_completed': n,
                    'prediction_cutoff_utc': cutoff
                })

            # Вставка пользовательских фич (быстрый пакетный INSERT)
            if user_feats:
                for i in range(0, len(user_feats), 1000):
                    chunk = user_feats[i:i+1000]
                    db.session.execute(sqlite_insert(UserDropoutFeature).values(chunk))
                db.session.commit()

            task.status = 'completed'
            task.progress = 1.0
            task.message = 'Готово'
            task.result = {'cf_id': cf_id, 'processed_users': len(user_feats)}
            db.session.commit()

        except Exception as e:
            db.session.rollback()
            task.status = 'failed'
            task.error = str(e)
            db.session.commit()


def _safe_update_progress(task, progress, message, max_retries=3):
    """
    Пытается обновить прогресс задачи, игнорируя временные блокировки БД.
    Прогресс — это UX, а не критичные данные, поэтому ошибки не ломают процесс.
    """
    for attempt in range(max_retries):
        try:
            task.progress = progress
            task.message = message
            db.session.commit()
            return True
        except Exception as e:
            error_msg = str(e).lower()
            # Если это блокировка БД и есть попытки — ждём и пробуем снова
            if ("database is locked" in error_msg or "locked" in error_msg) and attempt < max_retries - 1:
                db.session.rollback()
                time.sleep(0.1 * (attempt + 1))  # Экспоненциальная задержка: 0.1с, 0.2с, 0.3с
                continue
            else:
                # Если не удалось или ошибка другая — логируем, но не останавливаем процесс
                app.logger.warning(f"⚠️ Не удалось обновить прогресс задачи {task.id}: {e}")
                db.session.rollback()
                return False
    return False


# Эндпоинты

@features_bp.route('/compute', methods=['POST'])
def start_compute():
    data = request.get_json(silent=True) or {}
    
    task = ComputeTask(status='pending', message='Ожидание запуска...')
    db.session.add(task)
    db.session.flush()        # Генерирует task.id, но не фиксирует транзакцию
    task_id = task.id         # Сохраняем ID до коммита
    db.session.commit()       # Фиксируем в БД

    # Передаём уже сохранённый task_id, а не обращаемся к expired-объекту
    thread = threading.Thread(target=run_compute_task, args=(task_id, data), daemon=True)
    thread.start()

    return jsonify({'task_id': task_id, 'status': 'pending'}), 202


@features_bp.route('/compute/<int:task_id>/status', methods=['GET'])
def get_task_status(task_id):
    """Возвращает статус и прогресс задачи (свежие данные из БД)"""
    

    task = db.session.execute(
        select(ComputeTask).where(ComputeTask.id == task_id)
    ).scalar_one_or_none()
    
    
    if not task:
        return jsonify({'error': 'Задача не найдена'}), 404
        
    return jsonify({
        'id': task.id,
        'status': task.status,
        'progress': task.progress,
        'message': task.message,
        'result': task.result,
        'error': task.error
    })

@features_bp.route('/<int:user_id>', methods=['GET'])
def get_user_features(user_id):
    # Ищем самую свежую сессию для пользователя
    feat = db.session.execute(
        select(UserDropoutFeature)
        .where(UserDropoutFeature.user_id == user_id)
        .order_by(UserDropoutFeature.cf_id.desc())  # или calculated_at, если есть
        .limit(1)
    ).scalar_one_or_none()

    if not feat:
        return jsonify({'error': 'Фичи не найдены. Сначала вызовите POST /compute.'}), 404

    return jsonify({
        'user_id': feat.user_id,
        'cf_id': feat.cf_id,
        'metrics': {
            'first_try_success_rate': feat.first_try_success_rate,
            'avg_attempts_per_step': feat.avg_attempts_per_step,
            'std_attempts_per_step': feat.std_attempts_per_step,
            'pct_steps_with_post_success': feat.pct_steps_with_post_success,
            'avg_errors_before_success': feat.avg_errors_before_success,
            'steps_completed': feat.steps_completed
        },
        'metadata': {
            'cutoff_date': feat.prediction_cutoff_utc.isoformat() if feat.prediction_cutoff_utc else None
        }
    }), 200


@features_bp.route('/list', methods=['GET'])
def list_user_features():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 25, type=int), 100)
        sort_by = request.args.get('sort_by', 'calculated_at')
        order = request.args.get('order', 'desc')

        # Параметры фильтрации сессии
        cf_id_param = request.args.get('cf_id', type=int)
        course_id_param = request.args.get('course_id', type=int)

        #Определяем целевую cf_id по приоритету
        target_cf_id = cf_id_param
        if target_cf_id is None:
            if course_id_param is not None:
                # Последняя сессия для выбранного курса
                target_cf_id = db.session.execute(
                    select(func.max(CourseFeature.cf_id)).where(CourseFeature.course_id == course_id_param)
                ).scalar()
            else:
                # Самая последняя сессия вообще (любой курс)
                target_cf_id = db.session.execute(
                    select(func.max(CourseFeature.cf_id))
                ).scalar()

        # Если фичи ещё не вычислялись
        if target_cf_id is None:
            return jsonify({'data': [], 'total': 0, 'page': page, 'per_page': per_page}), 200

        # 2Настройка сортировки
        allowed = ['user_id', 'first_try_success_rate', 'avg_attempts_per_step',
                   'std_attempts_per_step', 'pct_steps_with_post_success',
                   'avg_errors_before_success', 'steps_completed', 'calculated_at']
        if sort_by not in allowed:
            sort_by = 'calculated_at'

        sort_col = CourseFeature.calculated_at if sort_by == 'calculated_at' else getattr(UserDropoutFeature, sort_by)
        if order.lower() == 'desc':
            sort_col = sort_col.desc()

        offset = (page - 1) * per_page

        # Основной запрос (строго по target_cf_id)
        query = select(
            UserDropoutFeature.user_id,
            Learner.last_name,
            Learner.first_name,
            UserDropoutFeature.first_try_success_rate,
            UserDropoutFeature.avg_attempts_per_step,
            UserDropoutFeature.std_attempts_per_step,
            UserDropoutFeature.pct_steps_with_post_success,
            UserDropoutFeature.avg_errors_before_success,
            UserDropoutFeature.steps_completed,
            CourseFeature.calculated_at.label('calculated_at')
        ).where(UserDropoutFeature.cf_id == target_cf_id)\
         .join(CourseFeature, UserDropoutFeature.cf_id == CourseFeature.cf_id)\
         .join(Learner, UserDropoutFeature.user_id == Learner.user_id)\
         .order_by(sort_col).offset(offset).limit(per_page)

        results = db.session.execute(query).all()

        # Подсчёт общего количества
        total = db.session.execute(
            select(func.count(UserDropoutFeature.user_id))
            .where(UserDropoutFeature.cf_id == target_cf_id)
        ).scalar() or 0

        # Формирование ответа
        data = []
        for row in results:
            data.append({
                'user_id': row.user_id,
                'last_name': row.last_name,
                'first_name': row.first_name,
                'first_try_success_rate': row.first_try_success_rate,
                'avg_attempts_per_step': row.avg_attempts_per_step,
                'std_attempts_per_step': row.std_attempts_per_step,
                'pct_steps_with_post_success': row.pct_steps_with_post_success,
                'avg_errors_before_success': row.avg_errors_before_success,
                'steps_completed': row.steps_completed,
                'calculated_at': row.calculated_at.isoformat() if row.calculated_at else None,
                'cf_id': target_cf_id  # ← Полезно для фронтенда
            })

        return jsonify({
            'data': data, 
            'total': total, 
            'page': page, 
            'per_page': per_page,
            'cf_id': target_cf_id  # ← Возвращаем, какую сессию показали
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500