import { useState, useEffect } from 'react';
import { Box, Typography, Container, CircularProgress, Alert, Paper } from '@mui/material';
import { 
  CourseSessionSelector, 
  MetricsSelector, 
  ModelTrainingPanel, 
  ModelComparisonTable 
} from '../components/classification';

const MOCK_COURSES = [
  { id: 1, name: 'Введение в Data Science', modules: 8, steps: 142 },
  { id: 2, name: 'Машинное обучение с нуля', modules: 12, steps: 203 },
  { id: 3, name: 'Анализ образовательных данных', modules: 6, steps: 89 },
];

const MOCK_SESSIONS = [
  { 
    id: 101, 
    course_id: 1, 
    cutoff_date: '2024-01-15T23:59:59', 
    algorithm_version: '1.2',
    students_count: 342,
    steps_count: 142 
  },
  { 
    id: 102, 
    course_id: 1, 
    cutoff_date: '2024-02-01T23:59:59', 
    algorithm_version: '1.2',
    students_count: 389,
    steps_count: 142 
  },
  { 
    id: 201, 
    course_id: 2, 
    cutoff_date: '2024-01-20T23:59:59', 
    algorithm_version: '1.3',
    students_count: 521,
    steps_count: 203 
  },
];

export default function ClassificationPage() {
  const [courses] = useState(MOCK_COURSES);
  const [sessions, setSessions] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainingStatus, setTrainingStatus] = useState('idle');
  const [trainingMessage, setTrainingMessage] = useState('');
  
  const [showResults, setShowResults] = useState(false);
  const [appliedModel, setAppliedModel] = useState(null);

  // Загрузка сессий при выборе курса
  useEffect(() => {
    if (selectedCourse) {
      const courseSessions = MOCK_SESSIONS.filter(s => s.course_id === selectedCourse);
      setSessions(courseSessions);
      setSelectedSession(courseSessions[0]?.id || null);
      setShowResults(false);
      setAppliedModel(null);
    } else {
      setSessions([]);
      setSelectedSession(null);
    }
  }, [selectedCourse]);

  // Обработчики для MetricsSelector
  const handleToggleMetric = (metricId) => {
    setSelectedMetrics(prev => 
      prev.includes(metricId) 
        ? prev.filter(id => id !== metricId) 
        : [...prev, metricId]
    );
  };

  const handleSelectAllMetrics = () => {
    const allIds = ['first_try_success_rate', 'steps_completed', 'avg_attempts_per_step', 
                    'std_attempts_per_step', 'avg_errors_before_success', 'pct_steps_with_post_success'];
    setSelectedMetrics(prev => prev.length === allIds.length ? [] : allIds);
  };

  const handleClearAllMetrics = () => setSelectedMetrics([]);

  // Имитация обучения моделей
  const handleStartTraining = () => {
    setIsTraining(true);
    setShowResults(false);
    setTrainingStatus('preprocessing');
    setTrainingProgress(0);
    setTrainingMessage('Подготовка данных...');

    // Симуляция этапов обучения
    const stages = [
      { progress: 0.2, status: 'preprocessing', message: 'Балансировка классов...' },
      { progress: 0.4, status: 'training', message: 'Обучение логистической регрессии...' },
      { progress: 0.6, status: 'training', message: 'Обучение Random Forest...' },
      { progress: 0.8, status: 'training', message: 'Обучение градиентного бустинга...' },
      { progress: 0.95, status: 'evaluating', message: 'Расчёт метрик качества...' },
      { progress: 1.0, status: 'complete', message: 'Готово!' },
    ];

    let currentStage = 0;
    const interval = setInterval(() => {
      if (currentStage >= stages.length) {
        clearInterval(interval);
        setIsTraining(false);
        setShowResults(true);
        return;
      }
      const stage = stages[currentStage];
      setTrainingProgress(stage.progress);
      setTrainingStatus(stage.status);
      setTrainingMessage(stage.message);
      currentStage++;
    }, 800);
  };

  const handleStopTraining = () => {
    setIsTraining(false);
    setTrainingStatus('cancelled');
    setTrainingMessage('Обучение остановлено пользователем');
  };

  const handleApplyModel = (modelId) => {
    setAppliedModel(modelId);
    //
    console.log('Applied model:', modelId);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper' }}>
        {/* Заголовок страницы */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" color="text.primary" fontWeight={600}>
            Классификация и прогнозирование
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            Обучение моделей машинного обучения для предсказания риска отчисления студентов
          </Typography>
        </Box>

        {/* 1. Выбор курса и сессии */}
        <CourseSessionSelector
          courses={courses}
          sessions={sessions}
          selectedCourse={selectedCourse}
          selectedSession={selectedSession}
          onCourseChange={setSelectedCourse}
          onSessionChange={setSelectedSession}
        />

        {/* 2. Выбор метрик (только если выбрана сессия) */}
        {selectedSession && (
          <MetricsSelector
            selectedMetrics={selectedMetrics}
            onToggleMetric={handleToggleMetric}
            onSelectAll={handleSelectAllMetrics}
            onClearAll={handleClearAllMetrics}
          />
        )}

        {/* 3. Панель обучения */}
        {selectedSession && selectedMetrics.length > 0 && (
          <ModelTrainingPanel
            isTraining={isTraining}
            progress={trainingProgress}
            status={trainingStatus}
            message={trainingMessage}
            onStartTraining={handleStartTraining}
            onStopTraining={handleStopTraining}
            selectedMetricsCount={selectedMetrics.length}
          />
        )}

        {/* 4. Результаты (после обучения) */}
        {showResults && (
          <>
            <Box sx={{ my: 3 }}>
              <Alert severity="success" sx={{ bgcolor: 'rgba(34, 197, 94, 0.1)', borderColor: 'success.main' }}>
                ✅ Обучение завершено. Сравните модели ниже и примените лучшую для прогнозирования.
              </Alert>
            </Box>
            <ModelComparisonTable onApplyModel={handleApplyModel} />
          </>
        )}

        {/* Подсказка, если ничего не выбрано */}
        {!selectedCourse && !showResults && !isTraining && (
          <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
            <CircularProgress size={32} sx={{ mb: 2 }} />
            <Typography>Выберите курс для начала работы</Typography>
          </Box>
        )}
      </Paper>
    </Container>
  );
}