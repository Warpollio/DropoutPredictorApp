from flask import  request, jsonify
from config import app, db
from models import Learner
from csv_import import import_structure, import_learners, import_submissions, import_comments
import os
import tempfile

from sqlalchemy import func, select, and_
from models import Course, Module, Step, Learner, Submission, Lesson, Comment

#from sqlalchemy import func, cast, Date
from datetime import datetime, timedelta


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

    # Сохраняем во временный файл для обработки
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
            elif import_type == 'comments':
                result = import_comments(temp_path)
            else:
                return jsonify({"error": "Неизвестный тип импорта"}), 400

        return jsonify({"message": "Импорт успешно завершён", "details": result}), 200

    except Exception as e:
        # Логируем ошибку для разработчика
        app.logger.error(f"Ошибка импорта: {e}")
        return jsonify({"error": "Ошибка обработки файла. Проверьте логи сервера."}), 500

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)  # Чистим временный файл





@app.route('/api/courses/stats', methods=['GET'])
def get_courses_stats():
    """Возвращает список курсов с базовой статистикой"""
    try:
        # 1. Модули в курсе (без изменений)
        modules_count = select(func.count(Module.module_id)).where(
            Module.course_id == Course.course_id
        ).scalar_subquery()
        
        # 2. Уроки (НОВОЕ)
        lessons_count = select(func.count(Lesson.lesson_id)).where(
            Lesson.module_id == Module.module_id,
            Module.course_id == Course.course_id
        ).scalar_subquery()
        
        # 3. Шаги (ОБНОВЛЕНО: цепочка теперь идёт через Lesson)
        steps_count = select(func.count(Step.step_id)).where(
            Step.lesson_id == Lesson.lesson_id,
            Lesson.module_id == Module.module_id,
            Module.course_id == Course.course_id
        ).scalar_subquery()
        
        # 4. Попытки (ОБНОВЛЕНО: цепочка теперь идёт через Lesson)
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
        
        return jsonify({
            'total_courses': len(courses),
            'total_learners': learners_count,
            'courses': [
                {
                    'id': c.course_id,
                    'name': c.name,
                    'modules': c.modules_count or 0,
                    'lessons': c.lessons_count or 0,   # ← Добавлено в ответ
                    'steps': c.steps_count or 0,
                    'submissions': c.submissions_count or 0
                }
                for c in courses
            ]
        }), 200
        
    except Exception as e:
        app.logger.error(f"Ошибка получения статистики: {e}")
        return jsonify({'error': 'Не удалось загрузить статистику'}), 500


@app.route('/api/courses/<int:course_id>/details', methods=['GET'])
def get_course_details(course_id):
    """Детальная статистика по конкретному курсу"""
    try:
        course = db.session.get(Course, course_id)
        if not course:
            return jsonify({'error': 'Курс не найден'}), 404
        
        # 1. Модули в курсе
        modules_count = db.session.execute(
            select(func.count(Module.module_id)).where(Module.course_id == course_id)
        ).scalar()
        
        # 2. Уроки в модулях курса (НОВОЕ)
        lessons_count = db.session.execute(
            select(func.count(Lesson.lesson_id))
            .join(Module, Lesson.module_id == Module.module_id)
            .where(Module.course_id == course_id)
        ).scalar()
        
        # 3. Шаги в уроках курса (ОБНОВЛЕНО: цепочка через Lesson)
        steps_count = db.session.execute(
            select(func.count(Step.step_id))
            .join(Lesson, Step.lesson_id == Lesson.lesson_id)
            .join(Module, Lesson.module_id == Module.module_id)
            .where(Module.course_id == course_id)
        ).scalar()
        
        # 4. Уникальные пользователи с попытками в этом курсе (ОБНОВЛЕНО)
        active_learners = db.session.execute(
            select(func.count(Submission.user_id.distinct()))
            .join(Step, Submission.step_id == Step.step_id)
            .join(Lesson, Step.lesson_id == Lesson.lesson_id)
            .join(Module, Lesson.module_id == Module.module_id)
            .where(Module.course_id == course_id)
        ).scalar()
        
        # 5. Общее число попыток в этом курсе (ОБНОВЛЕНО)
        submissions_count = db.session.execute(
            select(func.count(Submission.submission_id))
            .join(Step, Submission.step_id == Step.step_id)
            .join(Lesson, Step.lesson_id == Lesson.lesson_id)
            .join(Module, Lesson.module_id == Module.module_id)
            .where(Module.course_id == course_id)
        ).scalar()
        
        # Общее число пользователей в БД (SA 2.0 стиль)
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
    """
    Возвращает статистику по шагам курса с фильтрами.
    
    Параметры запроса (query params):
    - module_id: фильтр по модулю (опционально)
    - lesson_id: фильтр по уроку (опционально)
    - metrics: список метрик через запятую (submissions, successful, comments)
    """
    try:
        # Проверяем существование курса
        course = db.session.get(Course, course_id)
        if not course:
            return jsonify({'error': 'Курс не найден'}), 404
        
        # Получаем параметры фильтрации
        module_id = request.args.get('module_id', type=int)
        lesson_id = request.args.get('lesson_id', type=int)
        metrics = request.args.get('metrics', 'submissions,successful,comments').split(',')
        
        # Базовый запрос: все шаги курса с позицией
        query = select(
            Step.step_id,
            Step.position.label('step_position'),
            Step.step_type,
            Lesson.lesson_id.label('lesson_id'),
            Lesson.module_id.label('module_id') 
        ).join(Lesson, Step.lesson_id == Lesson.lesson_id)\
         .join(Module, Lesson.module_id == Module.module_id)\
         .where(Module.course_id == course_id)
        
        # Применяем фильтры
        if module_id:
            query = query.where(Lesson.module_id == module_id)
        if lesson_id:
            query = query.where(Step.lesson_id == lesson_id)
        
        #query = query.order_by(Step.position) #   ordering
        #query = query.order_by(Step.step_id) #   ordering
        query = query.order_by(Module.position, Lesson.position, Step.position)
        
        steps = db.session.execute(query).all()
        
        result = []
        for step in steps:
            step_data = {
                'step_id': step.step_id,
                'position': step.step_position,
                'step_type': step.step_type,
                'lesson_id': step.lesson_id,
                'module_id': step.module_id
            }
            
            # Подзапросы для метрик (выполняются только если запрошены)
            if 'submissions' in metrics or 'successful' in metrics:
                # Общее количество попыток на шаг
                sub_query = select(func.count(Submission.submission_id)).where(
                    Submission.step_id == step.step_id
                )
                step_data['submissions'] = db.session.execute(sub_query).scalar() or 0
                
                # Успешные попытки (статус = 'correct' ИЛИ балл >= 0.8)
                if 'successful' in metrics:
                    success_query = select(func.count(Submission.submission_id)).where(
                        and_(
                            Submission.step_id == step.step_id,
                            (Submission.status == 'correct') | (Submission.score >= 0.8)
                        )
                    )
                    step_data['successful'] = db.session.execute(success_query).scalar() or 0
            
            # Комментарии к шагу
            if 'comments' in metrics:
                comment_query = select(func.count(Comment.comment_id)).where(
                    and_(
                        Comment.step_id == step.step_id,
                        Comment.deleted == False
                    )
                )
                step_data['comments'] = db.session.execute(comment_query).scalar() or 0
            
            result.append(step_data)
        
        # Мета-информация для фильтров
        filters_meta = {
            'modules': [
                {'id': m.module_id, 'name': f"Module {m.module_id}", 'position': m.position}
                for m in db.session.execute(
                    select(Module.module_id, Module.position)
                    .where(Module.course_id == course_id)
                    .order_by(Module.position)
                ).all()
            ],
            'lessons': [
                {'id': l.lesson_id, 'name': f"Lesson {l.lesson_id}", 'module_id': l.module_id, 'position': l.position}
                for l in db.session.execute(
                    select(Lesson.lesson_id, Lesson.module_id, Lesson.position)
                    .join(Module, Lesson.module_id == Module.module_id)
                    .where(Module.course_id == course_id)
                    .order_by(Lesson.position)
                ).all()
            ]
        }
        
        return jsonify({
            'course_id': course_id,
            'course_name': course.name,
            'metrics': [m.strip() for m in metrics],
            'filters': filters_meta,
            'data': result
        }), 200
        
    except Exception as e:
        app.logger.error(f"Ошибка статистики шагов: {e}")
        return jsonify({'error': 'Не удалось загрузить статистику'}), 500

@app.route('/api/courses/<int:course_id>/enrollment', methods=['GET'])
def get_course_enrollment(course_id):
    """
    Статистика регистрации студентов по датам (SQLite).
    
    Формат даты в БД: 'YYYY-MM-DD HH:MM:SS.ffffff'
    
    Query params:
    - start_date: YYYY-MM-DD (опционально)
    - end_date: YYYY-MM-DD (опционально)
    - interval: 'day' | 'week' | 'month' (по умолчанию 'month')
    """
    try:
        # Проверяем существование курса
        course = db.session.get(Course, course_id)
        if not course:
            return jsonify({'error': 'Курс не найден'}), 404
        
        #Получаем параметры запроса
        interval = request.args.get('interval', 'month')  # day | week | month
        start_date = request.args.get('start_date')       # 'YYYY-MM-DD' или None
        end_date = request.args.get('end_date')           # 'YYYY-MM-DD' или None
        
        # Формат для группировки (SQLite strftime)
        if interval == 'week':
            date_format = '%Y-%W'    # '2024-12' (год-неделя)
        elif interval == 'month':
            date_format = '%Y-%m'    # '2024-01'
        else:  # day
            date_format = '%Y-%m-%d' # '2024-01-15'
        
        query = select(
            func.strftime(date_format, Learner.date_joined_utc).label('date'),
            func.count(Learner.user_id).label('count')
        ).where(
            Learner.date_joined_utc.isnot(None)  # исключаем NULL
        )
        
        # Фильтры по датам
        if start_date:
            # strftime('%Y-%m-%d', ...) извлекает дату из '2024-01-15 10:30:00'
            query = query.where(
                func.strftime('%Y-%m-%d', Learner.date_joined_utc) >= start_date
            )
        if end_date:
            query = query.where(
                func.strftime('%Y-%m-%d', Learner.date_joined_utc) <= end_date
            )
        
        query = query.group_by('date').order_by('date')
        
        rows = db.session.execute(query).all()
        
        #Формируем ответ
        # data = [{'date': row.date, 'count': row.count} for row in rows]
        data = []
        for row in rows:
            date_str = row.date  # '2024-12' для недель
            # Если интервал недель и строка похожа на 'YYYY-NN'
            if interval == 'week' and len(date_str) == 7 and date_str[4] == '-':
                year, week = date_str.split('-')
                date_str = f"{year}-W{week}"  # '2024-W12'
            
            data.append({'date': date_str, 'count': row.count})
        
        return jsonify({
            'course_id': course_id,
            'period': {
                'interval': interval,
                'start': start_date,
                'end': end_date
            },
            'total_new_learners': sum(d['count'] for d in data),
            'data': data
        }), 200
        
    except Exception as e:
        app.logger.error(f"Ошибка enrollment: {e}")
        return jsonify({'error': 'Не удалось загрузить статистику'}), 500



if __name__ == "__main__":
    with app.app_context():
        db.create_all()

    app.run(debug=True)