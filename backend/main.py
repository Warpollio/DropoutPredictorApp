from flask import  request, jsonify
from config import app, db
from models import Learner
from csv_import import import_structure, import_learners, import_submissions, import_comments
import os
import tempfile

from sqlalchemy import func, select
from models import Course, Module, Step, Learner, Submission, Lesson


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

if __name__ == "__main__":
    with app.app_context():
        db.create_all()

    app.run(debug=True)