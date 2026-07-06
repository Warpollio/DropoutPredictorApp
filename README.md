# Система прогнозирования поведения студентов на основе данных учебной аналитики

### Требования
- Установленный Docker Desktop

### Установка
1. Клонируйте репозиторий:
```bash
git clone -b deploy https://github.com/Warpollio/DropoutPredictorApp.git
cd DropoutPredictorApp
```
2. Запустите приложение
```bash
docker compose up -d --build
```
Первый запуск может занять несколько минут (сборка образов, установка зависимостей, применение миграций БД).

3. Откройте в браузере:
```
http://localhost:5000
```

Система предназначена для работы с данными о курсах, обучающихся и их активности, экспортируемыми из платформы Stepik. Файлы формата .csv можно импортировать во вкладке "Загрузка"

### Скриншоты приложения
<img width="1920" height="1080" alt="Screenshot_4" src="https://github.com/user-attachments/assets/748b68db-fad1-4ab8-81af-9e49ac21f7ec" />

<img width="1920" height="1080" alt="Screenshot_1" src="https://github.com/user-attachments/assets/f0d3346d-e17c-4258-a563-63680b12abcf" />

<img width="1920" height="1080" alt="Screenshot_3" src="https://github.com/user-attachments/assets/6b1171bd-82d5-4c21-b161-05bee474017e" />

<img width="1920" height="1080" alt="Screenshot_6" src="https://github.com/user-attachments/assets/9d24149e-f8f1-4525-83df-6490f26da6c2" />

