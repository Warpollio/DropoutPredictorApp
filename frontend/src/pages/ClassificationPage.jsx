import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Container, CircularProgress, Alert, Paper, Snackbar } from '@mui/material';
import { 
  CourseSessionSelector, 
  MetricsSelector, 
  ModelTrainingPanel, 
  ModelComparisonTable,
  PredictionsTable
} from '../components/classification';
import useModelTraining from '../hooks/useModelTraining';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const AVAILABLE_METRICS = [
  { id: 'first_try_success_rate', label: 'Успех с первой попытки (%)', description: 'Доля шагов, решённых верно с первого раза' },
  { id: 'steps_completed', label: 'Пройдено шагов', description: 'Количество уникальных шагов' },
  { id: 'avg_attempts_per_step', label: 'Среднее число попыток', description: 'Среднее количество попыток на шаг' },
  { id: 'std_attempts_per_step', label: 'Стабильность попыток (std)', description: 'Стандартное отклонение числа попыток' },
  { id: 'avg_errors_before_success', label: 'Ошибок до успеха', description: 'Среднее число ошибок до первого верного ответа' },
  { id: 'pct_steps_with_post_success', label: '"Решения после успеха" (%)', description: 'Доля шагов с попытками после успеха' },
  { id: 'max_step_reached', label: 'Макс. достигнутый шаг', description: 'Номер самого дальнего шага в курсе' },
  { id: 'attempts_trend_slope', label: 'Тренд попыток', description: 'Среднее число повторных попыток на шаг' },
  { id: 'is_sequence_escalating', label: 'Эскалация попыток', description: 'Флаг: в среднем >1.5 попытки на шаг' },
];

export default function ClassificationPage() {

  const {
    start: startTraining,
    stop: stopTraining,
    reset: resetTraining,
    applyModel,
    status: trainingStatus,
    progress: trainingProgress,
    message: trainingMessage,
    results: trainingResults,
    error: trainingError,
    isTraining,
  } = useModelTraining();

  
  const [courses, setCourses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [dataLoading, setDataLoading] = useState({ courses: true, sessions: false });
  const [dataError, setDataError] = useState(null);
  
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  
  const [showResults, setShowResults] = useState(false);
  const [appliedModel, setAppliedModel] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  //Predictions
  const [predictions, setPredictions] = useState([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [predictionsLoading, setPredictionsLoading] = useState(false);

  const handleApplyModel = useCallback(async (modelId) => {
    if (!selectedSession) return;
    
    setPredictionsLoading(true);
    try {
      const result = await applyModel(modelId, selectedSession, {
        threshold: 80.0,
        limit: 50,
        includeFeatures: true
      });
      
      setPredictions(result.predictions || []);
      setShowPredictions(true);
      setAppliedModel(modelId);
      setSnackbar({ 
        open: true, 
        message: `Найдено ${result.returned_count} студентов с риском отчисления`, 
        severity: 'success' 
      });
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    } finally {
      setPredictionsLoading(false);
    }
  }, [selectedSession, applyModel]);

  useEffect(() => {
    let cancelled = false;
    
    const fetchCourses = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/courses/list`, { timeout: 10000 });
        if (!cancelled) {
          setCourses(res.data.courses || []);
          setDataLoading(prev => ({ ...prev, courses: false }));
        }
      } catch (err) {
        if (!cancelled) {
          setDataError(err.message || 'Не удалось загрузить курсы');
          setDataLoading(prev => ({ ...prev, courses: false }));
        }
      }
    };
    
    fetchCourses();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedCourse) {
      setSessions([]);
      return;
    }
    
    let cancelled = false;
    setDataLoading(prev => ({ ...prev, sessions: true }));
    
    const fetchSessions = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/classification/sessions`, {
          params: { course_id: selectedCourse, limit: 50 },
          timeout: 10000
        });
        
        if (!cancelled) {
          setSessions(res.data.sessions || []);
          setDataLoading(prev => ({ ...prev, sessions: false }));
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Ошибка загрузки сессий:', err);
          setSessions([]);
          setDataLoading(prev => ({ ...prev, sessions: false }));
        }
      }
    };
    
    fetchSessions();
    return () => { cancelled = true; };
  }, [selectedCourse]);

  useEffect(() => {
    setShowResults(false);
    setAppliedModel(null);
    resetTraining();
  }, [selectedSession]); 

  const handleToggleMetric = useCallback((metricId) => {
    setSelectedMetrics(prev => 
      prev.includes(metricId) 
        ? prev.filter(id => id !== metricId) 
        : [...prev, metricId]
    );
  }, []);

  const handleSelectAllMetrics = useCallback(() => {
    const allIds = AVAILABLE_METRICS.map(m => m.id);
    setSelectedMetrics(prev => prev.length === allIds.length ? [] : allIds);
  }, []);

  const handleClearAllMetrics = useCallback(() => setSelectedMetrics([]), []);

  const handleStartTraining = useCallback(() => {
    if (!selectedSession || selectedMetrics.length === 0) {
      setSnackbar({ open: true, message: 'Выберите сессию и хотя бы одну метрику', severity: 'warning' });
      return;
    }
    startTraining({
      cf_id: selectedSession,
      features: selectedMetrics,
      threshold: 80.0,
      test_size: 0.3
    });
  }, [selectedSession, selectedMetrics, startTraining]);

  useEffect(() => {
    if (trainingError) {
      setSnackbar({ open: true, message: trainingError, severity: 'error' });
    }
  }, [trainingError]);

  useEffect(() => {
    if (trainingStatus === 'completed' && trainingResults) {
      setShowResults(true);
    }
  }, [trainingStatus, trainingResults]);

  const handleCloseSnackbar = () => setSnackbar(prev => ({ ...prev, open: false }));
  const isLoading = dataLoading.courses || dataLoading.sessions;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper' }}>
        
        {/* Заголовок */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" color="text.primary" fontWeight={600}>
            Классификация и прогнозирование
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            Обучение моделей машинного обучения для предсказания риска отчисления студентов
          </Typography>
        </Box>

        {/* Загрузка / Ошибка */}
        {isLoading && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Загрузка данных...
            </Typography>
          </Box>
        )}
        
        {!isLoading && dataError && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setDataError(null)}>
            {dataError}
          </Alert>
        )}

        {!isLoading && (
          <CourseSessionSelector
            courses={courses}
            sessions={sessions}
            selectedCourse={selectedCourse}
            selectedSession={selectedSession}
            onCourseChange={setSelectedCourse}
            onSessionChange={setSelectedSession}
            loading={dataLoading}
          />
        )}

        {!isLoading && selectedSession && (
          <MetricsSelector
            availableMetrics={AVAILABLE_METRICS}
            selectedMetrics={selectedMetrics}
            onToggleMetric={handleToggleMetric}
            onSelectAll={handleSelectAllMetrics}
            onClearAll={handleClearAllMetrics}
          />
        )}

        {!isLoading && selectedSession && selectedMetrics.length > 0 && (
          <ModelTrainingPanel
            isTraining={isTraining}
            progress={trainingProgress}
            status={trainingStatus}
            message={trainingMessage}
            onStartTraining={handleStartTraining}
            onStopTraining={stopTraining}
            selectedMetricsCount={selectedMetrics.length}
            canStop={['pending', 'running'].includes(trainingStatus)}
          />
        )}

        {showResults && trainingResults && (
          <>
            <Box sx={{ my: 3 }}>
              <Alert 
                severity="success" 
                sx={{ bgcolor: 'rgba(34, 197, 94, 0.1)', borderColor: 'success.main' }}
                onClose={() => setShowResults(false)}
              >
                ✅ Обучение завершено. Лучшая модель: <b>{trainingResults.best_model}</b> (ROC-AUC: {trainingResults.best_roc_auc?.toFixed(3)})
              </Alert>
            </Box>
            <ModelComparisonTable 
              models={trainingResults.results || []}
              onApplyModel={handleApplyModel}
              appliedModel={appliedModel}
              cfId={selectedSession}
            />
          </>
        )}

        {showPredictions && (
          <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
            <PredictionsTable 
              predictions={predictions}
              loading={predictionsLoading}
              onReset={() => setShowPredictions(false)}
            />
          </Box>
        )}

        {!isLoading && !selectedCourse && !showResults && !isTraining && (
          <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
            <Typography>Выберите курс для начала работы</Typography>
          </Box>
        )}
      </Paper>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={5000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}