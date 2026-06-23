from flask import Blueprint, request, jsonify
from sqlalchemy import select, func
import threading

from config import db, app
from models import CourseFeature, UserDropoutFeature, ComputeTask

classification_bp = Blueprint('classification', __name__, url_prefix='/api/classification')


@classification_bp.route('/sessions', methods=['GET'])
def get_feature_sessions():
    """Возвращает список сессий вычисления признаков (фильтрация по курсу + пагинация)"""
    try:
        course_id = request.args.get('course_id', type=int)
        limit = request.args.get('limit', 50, type=int)
        page = request.args.get('page', 1, type=int)
        offset = (page - 1) * limit

        query = select(
            CourseFeature.cf_id,
            CourseFeature.course_id,
            CourseFeature.calculated_at,
            CourseFeature.feature_version,
            CourseFeature.prediction_cutoff_utc,
            CourseFeature.description,
            func.count(UserDropoutFeature.user_id).label('students_count')
        ).outerjoin(
            UserDropoutFeature, CourseFeature.cf_id == UserDropoutFeature.cf_id
        ).group_by(
            CourseFeature.cf_id, CourseFeature.course_id,
            CourseFeature.calculated_at, CourseFeature.feature_version,
            CourseFeature.prediction_cutoff_utc, CourseFeature.description
        )

        if course_id:
            query = query.where(CourseFeature.course_id == course_id)

        query = query.order_by(CourseFeature.calculated_at.desc()).offset(offset).limit(limit)
        rows = db.session.execute(query).all()

        count_query = select(func.count()).select_from(CourseFeature)
        if course_id:
            count_query = count_query.where(CourseFeature.course_id == course_id)
        total = db.session.execute(count_query).scalar() or 0

        sessions = []
        for row in rows:
            sessions.append({
                'id': row.cf_id,
                'course_id': row.course_id,
                'cutoff_date': row.calculated_at.isoformat() if row.calculated_at else None,
                'algorithm_version': row.feature_version or '1.0',
                'students_count': row.students_count,
                'description': (row.description or '')[:200]
            })

        return jsonify({
            'sessions': sessions,
            'pagination': {'total': total, 'page': page, 'limit': limit}
        }), 200

    except Exception as e:
        app.logger.error(f"Ошибка загрузки сессий: {e}")
        return jsonify({'error': 'Не удалось загрузить сессии'}), 500

@classification_bp.route('/train', methods=['POST'])
def start_training():
    data = request.get_json(silent=True) or {}
    cf_id = data.get('cf_id')
    features = data.get('features', [])
    threshold = data.get('threshold', 80.0)

    if not cf_id:
        return jsonify({'error': 'cf_id обязателен'}), 400

    task = ComputeTask(
        status='pending',
        progress=0.0,
        message='Ожидание запуска...',
        result=None,
        error=None
    )
    db.session.add(task)
    db.session.flush()
    task_id = task.id
    db.session.commit()


    def run_training(task_id, cf_id, features, threshold):
        with app.app_context():
            task_db = db.session.get(ComputeTask, task_id)
            try:
                task_db.status = 'running'
                task_db.progress = 0.1
                task_db.message = 'Загрузка и подготовка данных...'
                db.session.commit()

                from train_models import load_features, compare_models

                X, y, _ = load_features(cf_id, progress_threshold=threshold, engine=db.engine)

                if features:
                    X = X[[f for f in features if f in X.columns]]

                task_db.progress = 0.3
                task_db.message = 'Обучение моделей...'
                db.session.commit()

                results = compare_models(X, y, cf_id=cf_id, threshold=threshold, save_dir='models')

                task_db.status = 'completed'
                task_db.progress = 1.0
                task_db.message = 'Готово'
                task_db.result = results 
                db.session.commit()

            except Exception as e:
                db.session.rollback()
                task_db = db.session.get(ComputeTask, task_id)
                if task_db:
                    task_db.status = 'failed'
                    task_db.error = str(e)
                    task_db.message = 'Ошибка обучения'
                    db.session.commit()

    thread = threading.Thread(target=run_training, args=(task_id, cf_id, features, threshold), daemon=True)
    thread.start()

    return jsonify({'task_id': task_id, 'status': 'pending'}), 202


@classification_bp.route('/train/<int:task_id>/status', methods=['GET'])
def get_training_status(task_id):
    task = db.session.get(ComputeTask, task_id)
    if not task:
        return jsonify({'error': 'Задача не найдена'}), 404
    
    return jsonify({
        'id': task.id,
        'status': task.status,
        'progress': task.progress,
        'message': task.message,
        'results': task.result, 
        'error': task.error
    }), 200


@classification_bp.route('/train/<int:task_id>/cancel', methods=['POST'])
def cancel_training(task_id):
    task = db.session.get(ComputeTask, task_id)
    if not task or task.status not in ['pending', 'running']:
        return jsonify({'error': 'Нельзя отменить завершённую задачу'}), 400
    task.status = 'cancelled'
    task.message = 'Отменено пользователем'
    db.session.commit()
    return jsonify({'status': 'cancelled'}), 200


@classification_bp.route('/predict', methods=['POST'])
def predict_dropout():
    import joblib
    import pandas as pd
    from pathlib import Path
    from sqlalchemy import text
    from train_models import load_features
    
    data = request.get_json(silent=True) or {}
    cf_id = data.get('cf_id')
    model_id = data.get('model_id')
    threshold = data.get('threshold', 80.0)
    limit = data.get('limit', 100)
    include_features = data.get('include_features', False)
    
    if not cf_id or not model_id:
        return jsonify({'error': 'cf_id и model_id обязательны'}), 400
    if model_id not in ['logistic', 'random_forest', 'gradient_boosting']:
        return jsonify({'error': 'Неверный model_id'}), 400
    
    model_path = f'models/cf_{cf_id}_{model_id}_model.pkl'
    if not Path(model_path).exists():
        return jsonify({
            'error': f'Модель не найдена. Сначала обучите её для cf_id={cf_id}',
            'hint': 'POST /api/classification/train'
        }), 404
    
    try:
        # модель
        bundle = joblib.load(model_path)
        model = bundle['model']
        feature_cols = bundle['feature_cols']
        model_threshold = bundle.get('threshold', 80.0)
        
        # фичи
        X, _, meta = load_features(cf_id, progress_threshold=model_threshold, engine=db.engine)
        if X.empty:
            return jsonify({'error': 'Нет данных для прогнозирования'}), 404
        
        # фильтр
        meta['progress_percent'] = pd.to_numeric(meta['progress_percent'], errors='coerce')
        filtered_meta = meta[meta['progress_percent'] <= threshold].copy()
        
        if filtered_meta.empty:
            return jsonify({
                'cf_id': cf_id, 'model_id': model_id, 'threshold': threshold,
                'total_filtered': 0, 'predictions': [],
                'message': 'Все пользователи достигли порога прогресса'
            }), 200
        
        course_row = db.session.execute(
            text("SELECT course_id FROM course_feature WHERE cf_id = :cf_id LIMIT 1"),
            {"cf_id": cf_id}
        ).first()
        if not course_row:
            return jsonify({'error': 'Сессия вычисления не найдена'}), 404
        course_id = course_row.course_id
        

        valid_uids = set(filtered_meta['user_id'])
        X_filtered = X[X['user_id'].isin(valid_uids)].reset_index(drop=True)
        X_model = X_filtered[feature_cols].fillna(0)
        
        probs = model.predict_proba(X_model)[:, 1]
        preds = (probs >= 0.5).astype(int)
        
        result_df = pd.DataFrame({
            'user_id': X_filtered['user_id'].values,
            'dropout_probability': probs,
            'prediction': ['dropout' if p else 'active' for p in preds],
            'confidence': [max(p, 1-p) for p in probs]
        })
        result_df = result_df.merge(
            filtered_meta[['user_id', 'progress_percent', 'steps_completed']],
            on='user_id', how='left'
        )
        
        user_ids = result_df['user_id'].tolist()
        subs_query = text("""
            SELECT s.user_id, MAX(s.submission_time) AS last_course_activity
            FROM submission s
            JOIN step st ON s.step_id = st.step_id
            JOIN lesson l ON st.lesson_id = l.lesson_id
            JOIN module m ON l.module_id = m.module_id
            WHERE m.course_id = :course_id AND s.user_id = ANY(:uids)
            GROUP BY s.user_id
        """)
        subs_df = pd.read_sql(subs_query, db.engine, params={
            "course_id": course_id,
            "uids": user_ids
        })
        result_df = result_df.merge(subs_df, on='user_id', how='left')
        
        result_df['last_course_activity'] = pd.to_datetime(result_df['last_course_activity'], errors='coerce')
        result_df = result_df.sort_values('last_course_activity', ascending=False, na_position='last')
        result_df = result_df.head(limit)
        
        if not result_df.empty:
            names_query = text("""
                SELECT user_id, first_name, last_name FROM learner WHERE user_id = ANY(:uids)
            """)
            names_df = pd.read_sql(names_query, db.engine, params={'uids': result_df['user_id'].tolist()})
            result_df = result_df.merge(names_df, on='user_id', how='left')
        
        predictions_list = []
        for _, row in result_df.iterrows():
            pred_item = {
                'user_id': int(row['user_id']),
                'first_name': row.get('first_name'),
                'last_name': row.get('last_name'),
                'dropout_probability': float(row['dropout_probability']),
                'prediction': row['prediction'],
                'confidence': float(row['confidence']),
                'progress_percent': float(row['progress_percent']) if pd.notna(row.get('progress_percent')) else None,
                'last_activity_utc': row['last_course_activity'].isoformat() if pd.notna(row.get('last_course_activity')) else None,
                'steps_completed': int(row['steps_completed']) if pd.notna(row.get('steps_completed')) else None,
            }
            
            if include_features and hasattr(model, 'feature_importances_'):
                user_row = X_filtered[X_filtered['user_id'] == row['user_id']]
                if not user_row.empty:
                    user_features = user_row[feature_cols].iloc[0]
                    importances = model.feature_importances_
                    top_factors = sorted(
                        zip(feature_cols, user_features.values, importances),
                        key=lambda x: abs(x[2]) if pd.notna(x[1]) else 0, reverse=True
                    )[:3]
                    pred_item['risk_factors'] = [
                        {'feature': f, 'value': float(v) if pd.notna(v) else None, 'importance': float(imp)}
                        for f, v, imp in top_factors
                    ]
            
            predictions_list.append(pred_item)
        
        return jsonify({
            'cf_id': cf_id,
            'model_id': model_id,
            'threshold': threshold,
            'total_filtered': len(filtered_meta),
            'returned_count': len(predictions_list),
            'model_name': bundle['metrics']['model'],
            'predictions': predictions_list
        }), 200
        
    except FileNotFoundError:
        return jsonify({'error': f'Модель не найдена: {model_path}'}), 404
    except KeyError as e:
        app.logger.error(f"KeyError в predict_dropout: отсутствует колонка {e}")
        return jsonify({'error': f'Отсутствует колонка: {e}'}), 500
    except Exception as e:
        app.logger.error(f"Ошибка прогнозирования: {e}")
        return jsonify({'error': str(e)}), 500