from flask import  request, jsonify
from config import app, db
from models import Learner
from csv_import import import_structure, import_learners, import_submissions, import_comments, update_step_metrics
import os
import tempfile

from sqlalchemy import func, select, and_, update
from models import Course, Module, Step, Learner, Submission, Lesson, Comment



# Features_api
from features_api import features_bp
app.register_blueprint(features_bp)
# Classification api
from classification_api import classification_bp
app.register_blueprint(classification_bp)

from flask import send_from_directory, request

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    if path.startswith('api/'):
        return None 
    
    static_folder = app.static_folder
    if static_folder and path != "" and os.path.exists(os.path.join(static_folder, path)):
        return send_from_directory(static_folder, path)
    
    return send_from_directory(static_folder, 'index.html')


@app.route("/hello", methods=["GET"])
def hello_world():
    return jsonify({"hello" : "world"})

@app.route('/api/import', methods=['POST'])
def api_import():
    if 'file' not in request.files:
        return jsonify({"error": "Файл не выбран"}), 400

    file = request.files['file']
    import_type = request.form.get('type')  # structure, learners, submissions, comments

    if file.filename == '' or not import_type:
        return jsonify({"error": "Не указан файл или тип импорта"}), 400

    #временный файл для обработки
    temp_path = os.path.join(tempfile.gettempdir(), file.filename)
    file.save(temp_path)

    try:
        with app.app_context():
            if import_type == 'structure':
                result = import_structure(temp_path)
            elif import_type == 'learners':
                result = import_learners(temp_path)
            elif import_type == 'submissions':
                result = import_submissions(temp_path)
                sync_step_stats()
                calculate_course_progress()
            elif import_type == 'comments':
                result = import_comments(temp_path)
            elif import_type == 'step_metrics':
                result = update_step_metrics(temp_path)
            else:
                return jsonify({"error": "Неизвестный тип импорта"}), 400

        return jsonify({"message": "Импорт успешно завершён", "details": result}), 200

    except Exception as e:

        app.logger.error(f"Ошибка импорта: {e}")
        return jsonify({"error": "Ошибка обработки файла."}), 500

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path) 





@app.route('/api/courses/stats', methods=['GET'])
def get_courses_stats():
    """список курсов с базовой статистикой"""
    print("stats start")
    try:

        modules_count = select(func.count(Module.module_id)).where(
            Module.course_id == Course.course_id
        ).scalar_subquery()
        

        lessons_count = select(func.count(Lesson.lesson_id)).where(
            Lesson.module_id == Module.module_id,
            Module.course_id == Course.course_id
        ).scalar_subquery()
        

        steps_count = select(func.count(Step.step_id)).where(
            Step.lesson_id == Lesson.lesson_id,
            Lesson.module_id == Module.module_id,
            Module.course_id == Course.course_id
        ).scalar_subquery()
        

        submissions_count = select(func.count(Submission.submission_id)).where(
            Submission.step_id == Step.step_id,
            Step.lesson_id == Lesson.lesson_id,
            Lesson.module_id == Module.module_id,
            Module.course_id == Course.course_id
        ).scalar_subquery()
        
        courses = db.session.execute(
            select(
                Course.course_id,
                Course.name,
                modules_count.label('modules_count'),
                lessons_count.label('lessons_count'),
                steps_count.label('steps_count'),
                submissions_count.label('submissions_count')
            ).order_by(Course.name)
        ).all()
        
        learners_count = db.session.execute(
            select(func.count(Learner.user_id))
        ).scalar()
        print("stats finish")
        return jsonify({
            'total_courses': len(courses),
            'total_learners': learners_count,
            'courses': [
                {
                    'id': c.course_id,
                    'name': c.name,
                    'modules': c.modules_count or 0,
                    'lessons': c.lessons_count or 0,
                    'steps': c.steps_count or 0,
                    'submissions': c.submissions_count or 0
                }
                for c in courses
            ]
        }), 200
        
        
    except Exception as e:
        app.logger.error(f"Ошибка получения статистики: {e}")
        return jsonify({'error': 'Не удалось загрузить статистику'}), 500
    
@app.route('/api/courses/list', methods=['GET']) 
def get_courses_for_picker():
    """плоский список курсов"""
    try:
        rows = db.session.execute(
            select(Course.course_id, Course.name).order_by(Course.name)
        ).all()
        
        return jsonify({
            'courses': [
                {'id': row.course_id, 'name': row.name}
                for row in rows
            ]
        }), 200
        
    except Exception as e:
        app.logger.error(f"Ошибка получения списка курсов: {e}")
        return jsonify({'error': 'Не удалось загрузить список курсов'}), 500


@app.route('/api/courses/<int:course_id>/details', methods=['GET'])
def get_course_details(course_id):
    try:
        course = db.session.get(Course, course_id)
        if not course:
            return jsonify({'error': 'Курс не найден'}), 404
        

        modules_count = db.session.execute(
            select(func.count(Module.module_id)).where(Module.course_id == course_id)
        ).scalar()
        

        lessons_count = db.session.execute(
            select(func.count(Lesson.lesson_id))
            .join(Module, Lesson.module_id == Module.module_id)
            .where(Module.course_id == course_id)
        ).scalar()
        

        steps_count = db.session.execute(
            select(func.count(Step.step_id))
            .join(Lesson, Step.lesson_id == Lesson.lesson_id)
            .join(Module, Lesson.module_id == Module.module_id)
            .where(Module.course_id == course_id)
        ).scalar()
        

        active_learners = db.session.execute(
            select(func.count(Submission.user_id.distinct()))
            .join(Step, Submission.step_id == Step.step_id)
            .join(Lesson, Step.lesson_id == Lesson.lesson_id)
            .join(Module, Lesson.module_id == Module.module_id)
            .where(Module.course_id == course_id)
        ).scalar()
        

        submissions_count = db.session.execute(
            select(func.count(Submission.submission_id))
            .join(Step, Submission.step_id == Step.step_id)
            .join(Lesson, Step.lesson_id == Lesson.lesson_id)
            .join(Module, Lesson.module_id == Module.module_id)
            .where(Module.course_id == course_id)
        ).scalar()
        

        total_learners = db.session.execute(
            select(func.count(Learner.user_id))
        ).scalar()
        
        return jsonify({
            'course': {
                'id': course.course_id,
                'name': course.name,
                'difficulty': course.difficulty,
                'discrimination': course.discrimination
            },
            'stats': {
                'modules': modules_count or 0,
                'lessons': lessons_count or 0,
                'steps': steps_count or 0,
                'active_learners': active_learners or 0,
                'total_learners': total_learners or 0,
                'submissions': submissions_count or 0
            }
        }), 200
        
    except Exception as e:
        app.logger.error(f"Ошибка получения деталей курса {course_id}: {e}")
        return jsonify({'error': 'Не удалось загрузить детали курса'}), 500

@app.route('/api/courses/<int:course_id>/step-stats', methods=['GET'])
def get_course_step_stats(course_id):
    print("step_stats start")
    try:
        course = db.session.get(Course, course_id)
        if not course:
            return jsonify({'error': 'Курс не найден'}), 404
        
        module_id = request.args.get('module_id', type=int)
        lesson_id = request.args.get('lesson_id', type=int)
        metrics = [m.strip() for m in request.args.get('metrics', 'submissions,successful,comments').split(',')]

        query = select(
            Step.step_id, Step.position, Step.step_type,
            Lesson.lesson_id, Lesson.module_id,
            Step.submissions_count, Step.successful_count, Step.comments_count
        ).join(Lesson, Step.lesson_id == Lesson.lesson_id)\
        .join(Module, Lesson.module_id == Module.module_id)\
        .where(Module.course_id == course_id)\
        .order_by(Module.position, Lesson.position, Step.position)
        
        if module_id:
            query = query.where(Lesson.module_id == module_id)
        if lesson_id:
            query = query.where(Step.lesson_id == lesson_id)
        
        query = query.order_by(Module.position, Lesson.position, Step.position)
            
        rows = db.session.execute(query).all()
        
        data = [{
            'step_id': r.step_id,
            'position': r.position,
            'step_type': r.step_type,
            'lesson_id': r.lesson_id,
            'module_id': r.module_id,
            'submissions': r.submissions_count,
            'successful': r.successful_count,
            'comments': r.comments_count
        } for r in rows]
        
        filters_meta = _get_filters_meta(course_id)
        print("step_stats finish")
        
        return jsonify({
            'course_id': course_id,
            'course_name': course.name,
            'metrics': metrics,
            'filters': filters_meta,
            'data': data
        }), 200

    except Exception as e:
        app.logger.error(f"Ошибка статистики шагов: {e}")
        return jsonify({'error': 'Не удалось загрузить статистику'}), 500


def _get_filters_meta(course_id):
    modules = [
        {'id': m.module_id, 'name': f"Module {m.module_id}", 'position': m.position}
        for m in db.session.execute(
            select(Module.module_id, Module.position).where(Module.course_id == course_id).order_by(Module.position)
        ).all()
    ]
    lessons = [
        {'id': l.lesson_id, 'name': f"Lesson {l.lesson_id}", 'module_id': l.module_id, 'position': l.position}
        for l in db.session.execute(
            select(Lesson.lesson_id, Lesson.module_id, Lesson.position)
            .join(Module, Lesson.module_id == Module.module_id)
            .where(Module.course_id == course_id).order_by(Lesson.position)
        ).all()
    ]
    return {'modules': modules, 'lessons': lessons}


def sync_step_stats():
    print("!sync_start")
    steps = db.session.execute(select(Step.step_id)).scalars().all()
    for sid in steps:
        db.session.execute(
            update(Step).where(Step.step_id == sid).values(
                submissions_count=select(func.count(Submission.submission_id)).where(Submission.step_id == sid).scalar_subquery(),
                successful_count=select(func.count(Submission.submission_id)).where(
                    and_(Submission.step_id == sid, (Submission.status == 'correct') | (Submission.score >= 0.8))
                ).scalar_subquery(),
                comments_count=select(func.count(Comment.comment_id)).where(
                    and_(Comment.step_id == sid, Comment.deleted == False)
                ).scalar_subquery()
            )
        )
    print("!sync_finish")
    db.session.commit()

def calculate_course_progress():
    print("Расчёт прогресса и активности курсов...")
    
    sql = text("""
        INSERT INTO user_course_progress (
            user_id, course_id, progress_percent, is_active, last_activity_utc
        )
        WITH UserCourseStats AS (
            SELECT 
                sub.user_id,
                m.course_id,
                COUNT(DISTINCT sub.step_id) FILTER (WHERE sub.status = 'correct') AS passed_steps,
                MAX(sub.submission_time) AS last_activity_utc,
                MAX(MAX(sub.submission_time)) OVER (PARTITION BY m.course_id) AS course_max_time
            FROM submission sub
            JOIN step s ON sub.step_id = s.step_id
            JOIN lesson l ON s.lesson_id = l.lesson_id
            JOIN module m ON l.module_id = m.module_id
            GROUP BY sub.user_id, m.course_id
        ),
        CourseTotals AS (
            SELECT m.course_id, COUNT(s.step_id) AS total_steps
            FROM step s
            JOIN lesson l ON s.lesson_id = l.lesson_id
            JOIN module m ON l.module_id = m.module_id
            GROUP BY m.course_id
        )
        SELECT 
            ucs.user_id,
            ucs.course_id,
            LEAST(100.0, (ucs.passed_steps::FLOAT / NULLIF(ct.total_steps, 0)) * 100) AS progress_percent,
            (ucs.last_activity_utc >= (ucs.course_max_time - INTERVAL '30 days'))::boolean AS is_active,
            ucs.last_activity_utc
        FROM UserCourseStats ucs
        JOIN CourseTotals ct ON ucs.course_id = ct.course_id
        ON CONFLICT (user_id, course_id) DO UPDATE SET
            progress_percent = EXCLUDED.progress_percent,
            is_active = EXCLUDED.is_active,
            last_activity_utc = EXCLUDED.last_activity_utc
    """)
    
    result = db.session.execute(sql)
    db.session.commit()
    print(f"Прогресс и активность рассчитаны для {result.rowcount} записей")

#params: start_date, end_date interval('day' | 'week' | 'month')
@app.route('/api/courses/<int:course_id>/enrollment', methods=['GET'])
def get_course_enrollment(course_id):
    try:
        from datetime import datetime, timedelta
        from sqlalchemy import func, select

        course = db.session.get(Course, course_id)
        if not course:
            return jsonify({'error': 'Курс не найден'}), 404

        interval = request.args.get('interval', 'month')
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')

        end_date = datetime.utcnow() if not end_date_str else datetime.strptime(end_date_str, '%Y-%m-%d')

        if not start_date_str:
            first = db.session.execute(
                select(func.min(Learner.date_joined_utc)).where(Learner.date_joined_utc.isnot(None))
            ).scalar()
            start_date = first if first else datetime.utcnow()
        else:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')


        trunc_map = {'day': 'day', 'week': 'week', 'month': 'month'}
        pg_trunc = trunc_map.get(interval, 'month')


        course_users_subq = (
            select(Submission.user_id)
            .join(Step, Submission.step_id == Step.step_id)
            .join(Lesson, Step.lesson_id == Lesson.lesson_id)
            .join(Module, Lesson.module_id == Module.module_id)
            .where(Module.course_id == course_id)
            .distinct()
        ).subquery()


        query = select(
            func.date_trunc(pg_trunc, Learner.date_joined_utc).label('trunc_date'),
            func.count(Learner.user_id).label('count')
        ).where(
            Learner.user_id.in_(select(course_users_subq.c.user_id)),
            Learner.date_joined_utc.isnot(None),
            Learner.date_joined_utc >= start_date,
            Learner.date_joined_utc <= end_date
        ).group_by('trunc_date').order_by('trunc_date')

        rows = db.session.execute(query).all()


        fmt_map = {'day': '%Y-%m-%d', 'week': '%Y-%W', 'month': '%Y-%m'}
        fmt = fmt_map.get(interval, '%Y-%m')
        data_dict = {row.trunc_date.strftime(fmt): row.count for row in rows}

        filled_data = []

        if interval == 'month':
            current = start_date.replace(day=1)
            end_norm = end_date.replace(day=1)
            while current <= end_norm:
                key = current.strftime(fmt)
                filled_data.append({'date': key, 'count': data_dict.get(key, 0)})

                if current.month == 12:
                    current = current.replace(year=current.year + 1, month=1, day=1)
                else:
                    current = current.replace(month=current.month + 1, day=1)

        elif interval == 'week':

            current = start_date - timedelta(days=start_date.weekday())
            while current <= end_date:
                key = current.strftime(fmt)
                display_key = f"{current.strftime('%Y')}-W{current.strftime('%W').zfill(2)}"
                filled_data.append({'date': display_key, 'count': data_dict.get(key, 0)})
                current += timedelta(days=7)

        else:  # day
            current = start_date
            while current <= end_date:
                key = current.strftime(fmt)
                filled_data.append({'date': key, 'count': data_dict.get(key, 0)})
                current += timedelta(days=1)

        return jsonify({
            'course_id': course_id,
            'period': {'interval': interval, 'start': start_date_str, 'end': end_date_str},
            'total_new_learners': sum(d['count'] for d in filled_data),
            'data': filled_data
        }), 200

    except Exception as e:
        app.logger.error(f"Ошибка enrollment: {e}")
        return jsonify({'error': 'Не удалось загрузить статистику'}), 500
    


# cleanup
from sqlalchemy import or_, cast, String
from sqlalchemy import exists, text, delete, false

@app.route('/api/cleanup/inactive-users', methods=['POST'])
def cleanup_inactive_users():
    data = request.get_json(silent=True) or {}
    min_steps = data.get('min_steps', 0)
    course_id = data.get('course_id')

    if not course_id or not isinstance(min_steps, int) or min_steps < 0:
        return jsonify({'error': 'Некорректные параметры'}), 400

    try:
        with app.app_context():

            inactive_users_subq = (
                select(Submission.user_id)
                .join(Step, Submission.step_id == Step.step_id)
                .join(Lesson, Step.lesson_id == Lesson.lesson_id)
                .join(Module, Lesson.module_id == Module.module_id)
                .where(Module.course_id == course_id)
                .group_by(Submission.user_id)
                .having(func.count(func.distinct(Submission.step_id)) < min_steps)
            ).subquery()

            course_steps_subq = (
                select(Step.step_id)
                .join(Lesson, Step.lesson_id == Lesson.lesson_id)
                .join(Module, Lesson.module_id == Module.module_id)
                .where(Module.course_id == course_id)
            ).subquery()

            users_affected = db.session.execute(
                select(func.count()).select_from(inactive_users_subq)
            ).scalar() or 0

            subs_deleted = db.session.execute(
                select(func.count(Submission.submission_id)).where(
                    Submission.user_id.in_(select(inactive_users_subq.c.user_id)),
                    Submission.step_id.in_(select(course_steps_subq.c.step_id))
                )
            ).scalar() or 0

            if subs_deleted > 0:
                db.session.execute(
                    delete(Submission).where(
                        Submission.user_id.in_(select(inactive_users_subq.c.user_id)),
                        Submission.step_id.in_(select(course_steps_subq.c.step_id))
                    )
                )

            db.session.commit()

            return jsonify({
                'deleted_users': users_affected,   
                'deleted_submissions': subs_deleted
            }), 200

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Ошибка очистки: {e}")
        return jsonify({'error': 'Ошибка при очистке данных'}), 500
    
@app.route('/api/cleanup/teachers', methods=['POST'])
def cleanup_teachers():
    data = request.get_json(silent=True) or {}
    query = data.get('query', '').strip()
    course_id = data.get('course_id')

    if not query or not course_id:
        return jsonify({'error': 'Не указаны query или course_id'}), 400

    try:
        with app.app_context():

            try:
                uid_val = int(query)
                id_match = Learner.user_id == uid_val
            except ValueError:
                id_match = false() 

            name_match = func.lower(
                func.concat(Learner.last_name, ' ', Learner.first_name)
            ) == query.lower()

            user_ids_subq = select(Learner.user_id).where(
                or_(id_match, name_match)
            ).subquery()

            course_steps_subq = (
                select(Step.step_id)
                .join(Lesson, Step.lesson_id == Lesson.lesson_id)
                .join(Module, Lesson.module_id == Module.module_id)
                .where(Module.course_id == course_id)
                .subquery()
            )

            count_stmt = select(func.count()).select_from(Submission).where(
                Submission.user_id.in_(select(user_ids_subq.c.user_id)),
                Submission.step_id.in_(select(course_steps_subq.c.step_id))
            )
            subs_deleted = db.session.execute(count_stmt).scalar() or 0

            if subs_deleted > 0:
                delete_stmt = delete(Submission).where(
                    Submission.user_id.in_(select(user_ids_subq.c.user_id)),
                    Submission.step_id.in_(select(course_steps_subq.c.step_id))
                )
                db.session.execute(delete_stmt)
                db.session.commit()

            return jsonify({
                'deleted_users': 0,             
                'deleted_submissions': subs_deleted
            }), 200

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Ошибка очистки: {e}")
        return jsonify({'error': 'Ошибка при очистке данных'}), 500
    


from flask.cli import with_appcontext
import click


@app.cli.command("sync-stats")
@with_appcontext
def sync_stats_command():
    click.echo("Запуск синхронизации статистики...")
    sync_step_stats()

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)
