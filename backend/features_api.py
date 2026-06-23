import threading
from datetime import datetime
from flask import Blueprint, request, jsonify
from sqlalchemy import select, func, text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from config import db, app
from models import Submission, UserStepFeature, UserDropoutFeature, Learner, ComputeTask, CourseFeature

features_bp = Blueprint('features', __name__, url_prefix='/api/features')

def _run_compute_v2(cf_id, course_id, task_id, obs_days=30):
    with app.app_context():
        task = db.session.get(ComputeTask, task_id) 
        if not task: return

        try:
            task.status = 'running'
            task.message = f'🔍 Расчёт окон наблюдений ({obs_days} дн.)...'
            task.progress = 0.1
            db.session.commit()

            # Агрегация по шагам
            step_sql = text("""
                INSERT INTO user_step_feature 
                (cf_id, user_id, step_id, total_attempts, first_try_correct, errors_before_success, 
                 has_post_success_attempts, attempt_sequence)
                WITH UserWindows AS (
                    SELECT s.user_id, MIN(s.submission_time) AS first_sub, 
                           MIN(s.submission_time) + (:obs_days * INTERVAL '1 day') AS obs_end
                    FROM submission s
                    JOIN step st ON s.step_id = st.step_id
                    JOIN lesson l ON st.lesson_id = l.lesson_id
                    JOIN module m ON l.module_id = m.module_id
                    WHERE m.course_id = :course_id
                    GROUP BY s.user_id
                ),
                Ranked AS (
                    SELECT s.user_id, s.step_id, s.submission_time, s.status, s.score,
                           ROW_NUMBER() OVER(PARTITION BY s.user_id, s.step_id ORDER BY s.submission_time) AS rn,
                           CASE WHEN s.status = 'correct' OR COALESCE(s.score, 0) >= 0.9 THEN 1 ELSE 0 END AS is_correct
                    FROM submission s
                    JOIN UserWindows uw ON s.user_id = uw.user_id
                    WHERE s.submission_time <= uw.obs_end
                ),
                StepAgg AS (
                    SELECT r.user_id, r.step_id,
                           COUNT(*) AS total_attempts,
                           BOOL_OR(r.rn = 1 AND r.is_correct = 1) AS first_try_correct,
                           MIN(CASE WHEN r.is_correct = 1 THEN r.rn END) AS first_correct_rn,
                           STRING_AGG(CASE WHEN r.is_correct = 1 THEN 'C' ELSE 'W' END, '' ORDER BY r.submission_time) AS attempt_sequence
                    FROM Ranked r
                    GROUP BY r.user_id, r.step_id
                )
                SELECT :cf_id, user_id, step_id, total_attempts, 
                       first_try_correct::boolean,
                       CASE WHEN first_correct_rn IS NOT NULL THEN first_correct_rn - 1 ELSE NULL END,
                       (total_attempts > COALESCE(first_correct_rn, total_attempts + 1))::boolean,
                       attempt_sequence
                FROM StepAgg
                ON CONFLICT (cf_id, user_id, step_id) DO UPDATE SET
                    total_attempts = EXCLUDED.total_attempts,
                    first_try_correct = EXCLUDED.first_try_correct,
                    errors_before_success = EXCLUDED.errors_before_success,
                    has_post_success_attempts = EXCLUDED.has_post_success_attempts,
                    attempt_sequence = EXCLUDED.attempt_sequence
            """)
            db.session.execute(step_sql, {
                "cf_id": cf_id, "course_id": course_id, "obs_days": obs_days
            })
            db.session.commit()

            task.message = '📊 Агрегация пользовательских метрик...'
            task.progress = 0.6
            db.session.commit()

            # Агрегация по пользователям
            user_sql = text("""
                INSERT INTO user_dropout_feature 
                (cf_id, user_id, first_try_success_rate, avg_attempts_per_step, std_attempts_per_step,
                 pct_steps_with_post_success, avg_errors_before_success, steps_completed, max_step_reached,
                 last_activity_utc, attempts_trend_slope, is_sequence_escalating, global_attempt_pattern)
                WITH UserWindows AS (
                    SELECT s.user_id, MIN(s.submission_time) AS first_sub, 
                           MIN(s.submission_time) + (:obs_days * INTERVAL '1 day') AS obs_end
                    FROM submission s
                    JOIN step st ON s.step_id = st.step_id
                    JOIN lesson l ON st.lesson_id = l.lesson_id
                    JOIN module m ON l.module_id = m.module_id
                    WHERE m.course_id = :course_id
                    GROUP BY s.user_id
                ),
                StepAgg AS (
                    SELECT usf.user_id, usf.step_id, usf.total_attempts, usf.first_try_correct,
                           usf.errors_before_success, usf.has_post_success_attempts
                    FROM user_step_feature usf
                    WHERE usf.cf_id = :cf_id
                ),
                UserLastActivity AS (
                    SELECT s.user_id, MAX(s.submission_time) AS last_activity_utc
                    FROM submission s
                    JOIN UserWindows uw ON s.user_id = uw.user_id
                    WHERE s.submission_time <= uw.obs_end
                    GROUP BY s.user_id
                ),
                UserAgg AS (
                    SELECT sa.user_id,
                           AVG(sa.first_try_correct::int) AS first_try_success_rate,
                           AVG(sa.total_attempts) AS avg_attempts_per_step,
                           COALESCE(STDDEV(sa.total_attempts), 0.0) AS std_attempts_per_step,
                           AVG(sa.has_post_success_attempts::int) AS pct_steps_with_post_success,
                           AVG(sa.errors_before_success) AS avg_errors_before_success,
                           SUM(sa.total_attempts) AS steps_completed,
                           COUNT(sa.step_id) AS max_step_reached,
                           ula.last_activity_utc,
                           (SUM(sa.total_attempts) - COUNT(sa.step_id))::float / NULLIF(COUNT(sa.step_id), 0) AS attempts_trend_slope,
                           (AVG(sa.total_attempts) > 1.5)::boolean AS is_sequence_escalating,
                           jsonb_build_object(
                               'obs_window_days', :obs_days,
                               'total_attempts', SUM(sa.total_attempts),
                               'unique_steps', COUNT(sa.step_id),
                               'first_submission', MAX(uw.first_sub),
                               'retry_intensity', (SUM(sa.total_attempts) - COUNT(sa.step_id))::float / NULLIF(COUNT(sa.step_id), 0)
                           ) AS global_attempt_pattern
                    FROM StepAgg sa
                    JOIN UserWindows uw ON sa.user_id = uw.user_id
                    LEFT JOIN UserLastActivity ula ON sa.user_id = ula.user_id
                    GROUP BY sa.user_id, ula.last_activity_utc
                ),
                Comments AS (
                    SELECT c.user_id, COUNT(*) AS comments_count
                    FROM comment c
                    JOIN UserWindows uw ON c.user_id = uw.user_id
                    WHERE c.time_utc <= uw.obs_end
                    GROUP BY c.user_id
                )
                SELECT :cf_id, ua.user_id, ua.first_try_success_rate, ua.avg_attempts_per_step, 
                       ua.std_attempts_per_step, ua.pct_steps_with_post_success, ua.avg_errors_before_success,
                       ua.steps_completed, ua.max_step_reached, ua.last_activity_utc, 
                       ua.attempts_trend_slope, ua.is_sequence_escalating::boolean,
                       ua.global_attempt_pattern || jsonb_build_object('comments_count', COALESCE(com.comments_count, 0))
                FROM UserAgg ua
                LEFT JOIN Comments com ON ua.user_id = com.user_id
                ON CONFLICT (cf_id, user_id) DO UPDATE SET
                    first_try_success_rate = EXCLUDED.first_try_success_rate,
                    avg_attempts_per_step = EXCLUDED.avg_attempts_per_step,
                    std_attempts_per_step = EXCLUDED.std_attempts_per_step,
                    pct_steps_with_post_success = EXCLUDED.pct_steps_with_post_success,
                    avg_errors_before_success = EXCLUDED.avg_errors_before_success,
                    steps_completed = EXCLUDED.steps_completed,
                    max_step_reached = EXCLUDED.max_step_reached,
                    last_activity_utc = EXCLUDED.last_activity_utc,
                    attempts_trend_slope = EXCLUDED.attempts_trend_slope,
                    is_sequence_escalating = EXCLUDED.is_sequence_escalating,
                    global_attempt_pattern = EXCLUDED.global_attempt_pattern
            """)
            db.session.execute(user_sql, {
                "cf_id": cf_id, "course_id": course_id, "obs_days": obs_days
            })
            db.session.commit()

            processed = db.session.execute(
                select(func.count(UserDropoutFeature.user_id)).where(UserDropoutFeature.cf_id == cf_id)
            ).scalar() or 0

            task.status = 'completed'
            task.progress = 1.0
            task.message = f'✅ Готово: {processed} пользователей (окно: {obs_days} дн.)'
            db.session.commit()

        except Exception as e:
            db.session.rollback()
            if task:
                task.status = 'failed'
                task.error = str(e)
                db.session.commit()

@features_bp.route('/compute-v2', methods=['POST'])
def start_compute_v2():
    data = request.get_json(silent=True) or {}
    course_id = data.get('course_id')
    if not course_id:
        return jsonify({'error': 'course_id обязателен'}), 400

    obs_days = max(1, min(data.get('obs_days', 30), 365))

    task = ComputeTask(status='pending', message='Ожидание запуска...', progress=0.0)
    db.session.add(task)
    db.session.flush()
    task_id = task.id

    session_record = CourseFeature(
        course_id=course_id, 
        feature_version=f'v2.0-relative-w{obs_days}',
        prediction_cutoff_utc=datetime.utcnow(), 
        description=f'Окно: {obs_days} дн. | Запуск: {datetime.utcnow().isoformat()}'
    )
    db.session.add(session_record)
    db.session.commit() 

    thread = threading.Thread(
        target=_run_compute_v2, 
        args=(session_record.cf_id, course_id, task_id, obs_days), 
        daemon=True
    )
    thread.start()

    return jsonify({
        'task_id': task_id, 
        'cf_id': session_record.cf_id, 
        'status': 'pending', 
        'message': f'Вычисление запущено (окно: {obs_days} дн.)'
    }), 202



@features_bp.route('/compute/<int:task_id>/status', methods=['GET'])
def get_task_status(task_id):
    task = db.session.get(ComputeTask, task_id)
    if not task:
        return jsonify({'error': 'Задача не найдена'}), 404
    return jsonify({
        'id': task.id, 'status': task.status, 'progress': task.progress,
        'message': task.message, 'result': task.result, 'error': task.error
    })

@features_bp.route('/<int:user_id>', methods=['GET'])
def get_user_features(user_id):
    feat = db.session.execute(
        select(UserDropoutFeature)
        .where(UserDropoutFeature.user_id == user_id)
        .order_by(UserDropoutFeature.cf_id.desc())
        .limit(1)
    ).scalar_one_or_none()

    if not feat:
        return jsonify({'error': 'Сначало выполните вычисление'}), 404

    return jsonify({
        'user_id': feat.user_id, 'cf_id': feat.cf_id,
        'metrics': {k: getattr(feat, k) for k in ['first_try_success_rate', 'avg_attempts_per_step', 'std_attempts_per_step', 'pct_steps_with_post_success', 'avg_errors_before_success', 'steps_completed']},
        'metadata': {'cutoff_date': feat.prediction_cutoff_utc.isoformat() if feat.prediction_cutoff_utc else None}
    }), 200

@features_bp.route('/list', methods=['GET'])
def list_user_features():
    try:
        page = max(1, request.args.get('page', 1, type=int))
        per_page = max(1, min(request.args.get('per_page', 25, type=int), 100))
        sort_by = request.args.get('sort_by', 'calculated_at')
        order = request.args.get('order', 'desc').lower()

        cf_id_param = request.args.get('cf_id', type=int)
        course_id_param = request.args.get('course_id', type=int)


        target_cf_id = cf_id_param
        if target_cf_id is None:
            stmt = select(func.max(CourseFeature.cf_id))
            if course_id_param:
                stmt = stmt.where(CourseFeature.course_id == course_id_param)
            target_cf_id = db.session.execute(stmt).scalar()

        if target_cf_id is None:
            return jsonify({'data': [], 'total': 0, 'page': page, 'per_page': per_page}), 200


        sort_map = {
            'user_id': UserDropoutFeature.user_id,
            'first_try_success_rate': UserDropoutFeature.first_try_success_rate,
            'avg_attempts_per_step': UserDropoutFeature.avg_attempts_per_step,
            'std_attempts_per_step': UserDropoutFeature.std_attempts_per_step,
            'pct_steps_with_post_success': UserDropoutFeature.pct_steps_with_post_success,
            'avg_errors_before_success': UserDropoutFeature.avg_errors_before_success,
            'steps_completed': UserDropoutFeature.steps_completed,
            'cutoff_date': CourseFeature.prediction_cutoff_utc,
            'calculated_at': CourseFeature.prediction_cutoff_utc,
            'prediction_cutoff_utc': CourseFeature.prediction_cutoff_utc
        }
        
        sort_col = sort_map.get(sort_by, CourseFeature.prediction_cutoff_utc)
        sort_col = sort_col.desc() if order == 'desc' else sort_col.asc()

        offset = (page - 1) * per_page


        query = (
            select(
                UserDropoutFeature.user_id, Learner.last_name, Learner.first_name,
                UserDropoutFeature.first_try_success_rate, UserDropoutFeature.avg_attempts_per_step,
                UserDropoutFeature.std_attempts_per_step, UserDropoutFeature.pct_steps_with_post_success,
                UserDropoutFeature.avg_errors_before_success, UserDropoutFeature.steps_completed,
                CourseFeature.prediction_cutoff_utc.label('calculated_at')
            )
            .join(Learner, UserDropoutFeature.user_id == Learner.user_id, isouter=True)
            .join(CourseFeature, UserDropoutFeature.cf_id == CourseFeature.cf_id)
            .where(UserDropoutFeature.cf_id == target_cf_id)
            .order_by(sort_col)
            .offset(offset)
            .limit(per_page)
        )

        results = db.session.execute(query).all()
        
        total = db.session.execute(
            select(func.count()).where(UserDropoutFeature.cf_id == target_cf_id)
        ).scalar() or 0

        data = [{
            'user_id': r.user_id,
            'last_name': r.last_name or '',
            'first_name': r.first_name or '',
            'first_try_success_rate': r.first_try_success_rate,
            'avg_attempts_per_step': r.avg_attempts_per_step,
            'std_attempts_per_step': r.std_attempts_per_step,
            'pct_steps_with_post_success': r.pct_steps_with_post_success,
            'avg_errors_before_success': r.avg_errors_before_success,
            'steps_completed': r.steps_completed,
            'calculated_at': r.calculated_at.isoformat() if r.calculated_at else None,
            'cf_id': target_cf_id
        } for r in results]

        return jsonify({
            'data': data,
            'total': total,
            'page': page,
            'per_page': per_page,
            'cf_id': target_cf_id
        }), 200

    except Exception as e:
        app.logger.error(f"Ошибка /list: {e}")
        return jsonify({'error': 'Не удалось загрузить список ', 'details': str(e)}), 500