from flask import Blueprint, request, jsonify
from sqlalchemy import select, func, insert
from datetime import datetime
from collections import defaultdict
import statistics

from config import db
from models import Submission, UserStepFeature, UserDropoutFeature, Learner

from sqlalchemy.dialects.sqlite import insert as sqlite_insert

features_bp = Blueprint('features', __name__, url_prefix='/api/features')


def _bulk_upsert(model, data_list, chunk_size=50):
    if not data_list:
        return 0
    
    pk_cols = [col.name for col in model.__table__.primary_key.columns]
    total_upserted = 0
    
    # Разбиваем данные на пакеты
    for i in range(0, len(data_list), chunk_size):
        chunk = data_list[i:i + chunk_size]
        
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
        total_upserted += len(chunk)
        
    return total_upserted


# метрики для списка попыток одного шага
def _compute_step_metrics(sub_list):

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
        'calculated_at': datetime.utcnow()
    }

#patams: cutoff_date, user_id
@features_bp.route('/compute', methods=['POST'])
def compute_features():

    data = request.get_json(silent=True) or {}
    cutoff_str = data.get('cutoff_date')
    user_id_filter = data.get('user_id')

    cutoff = datetime.utcnow()
    if cutoff_str:
        try:
            cutoff = datetime.fromisoformat(cutoff_str.replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'error': 'Неверный формат cutoff_date.'}), 400

    try:

        q = select(Submission).where(Submission.submission_time <= cutoff)
        if user_id_filter:
            q = q.where(Submission.user_id == user_id_filter)
        q = q.order_by(Submission.user_id, Submission.step_id, Submission.submission_time)
        
        subs = db.session.execute(q).scalars().all()


        grouped = defaultdict(list)
        for s in subs:
            grouped[(s.user_id, s.step_id)].append(s)

        step_metrics = []
        user_metrics_map = defaultdict(list)

        for key, sub_list in grouped.items():
            metrics = _compute_step_metrics(sub_list)
            if metrics:
                step_metrics.append(metrics)
                user_metrics_map[metrics['user_id']].append(metrics)

        # Сохранение
        if step_metrics:
            _bulk_upsert(UserStepFeature, step_metrics)

        # Агрегация
        user_updates = []
        for uid, feats in user_metrics_map.items():
            n = len(feats) # количество попыток
            first_try_cnt = sum(1 for f in feats if f.get('first_try_correct')) # количество успешных первых попыток
            attempts = [f['total_attempts'] for f in feats] # Список всех total_attempts по шагам
            errors = [f['errors_before_success'] for f in feats if f.get('errors_before_success') is not None]
            post_success_cnt = sum(1 for f in feats if f.get('has_post_success_attempts'))

            user_updates.append({
                'user_id': uid,
                'first_try_success_rate': first_try_cnt / n if n else 0.0,
                'avg_attempts_per_step': sum(attempts) / len(attempts) if attempts else 0.0,
                'std_attempts_per_step': statistics.stdev(attempts) if len(attempts) > 1 else 0.0, # стандартное отклонение
                'pct_steps_with_post_success': post_success_cnt / n if n else 0.0, # % шагов с попытками после успеха
                'avg_errors_before_success': sum(errors) / len(errors) if errors else 0.0, # среднее кол-во ошибок до успеха
                'steps_completed': n,
                'calculated_at': datetime.utcnow(),     
                'prediction_cutoff_utc': cutoff      
            })


        if user_updates:
            _bulk_upsert(UserDropoutFeature, user_updates)

        db.session.commit()

        return jsonify({
            'status': 'success',
            'processed_users': len(user_metrics_map),
            'processed_steps': len(step_metrics),
            'cutoff_date': cutoff.isoformat()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Ошибка вычисления: {str(e)}'}), 500


@features_bp.route('/<int:user_id>', methods=['GET'])
def get_user_features(user_id):
    """Возвращает готовые агрегированные метрики пользователя"""
    feat = db.session.get(UserDropoutFeature, user_id)
    if not feat:
        return jsonify({'error': 'Фичи не найдены. Сначала вызовите POST /compute.'}), 404

    return jsonify({
        'user_id': feat.user_id,
        'metrics': {
            'first_try_success_rate': feat.first_try_success_rate,
            'avg_attempts_per_step': feat.avg_attempts_per_step,
            'std_attempts_per_step': feat.std_attempts_per_step,
            'pct_steps_with_post_success': feat.pct_steps_with_post_success,
            'avg_errors_before_success': feat.avg_errors_before_success,
            'steps_completed': feat.steps_completed
        },
        'metadata': {
            'calculated_at': feat.calculated_at.isoformat() if feat.calculated_at else None,
            'cutoff_date': feat.prediction_cutoff_utc.isoformat() if feat.prediction_cutoff_utc else None
        }
    }), 200

@features_bp.route('/list', methods=['GET'])
def list_user_features():
    """Возвращает список пользователей с метриками и ФИО. Поддерживает пагинацию и сортировку."""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 25, type=int), 100)
        sort_by = request.args.get('sort_by', 'calculated_at')
        order = request.args.get('order', 'desc')

        allowed = ['user_id', 'first_try_success_rate', 'avg_attempts_per_step',
                   'std_attempts_per_step', 'pct_steps_with_post_success',
                   'avg_errors_before_success', 'steps_completed', 'calculated_at']
        if sort_by not in allowed:
            sort_by = 'calculated_at'

        col = getattr(UserDropoutFeature, sort_by)
        if order.lower() == 'desc':
            col = col.desc()

        offset = (page - 1) * per_page

        # JOIN с Learner для получения фамилии и имени
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
            UserDropoutFeature.calculated_at
        ).join(Learner, UserDropoutFeature.user_id == Learner.user_id)\
         .order_by(col).offset(offset).limit(per_page)

        results = db.session.execute(query).all()
        total = db.session.execute(select(func.count(UserDropoutFeature.user_id))).scalar()

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
                'calculated_at': row.calculated_at.isoformat() if row.calculated_at else None
            })

        return jsonify({
            'data': data,
            'total': total,
            'page': page,
            'per_page': per_page
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500