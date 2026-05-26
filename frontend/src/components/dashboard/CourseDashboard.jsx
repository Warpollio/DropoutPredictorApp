// src/components/dashboard/CourseDashboard.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; // ← для навигации при выборе курса
import { 
  Container, Box, Alert, CircularProgress, Divider, 
  Typography, Select, MenuItem, FormControl, Paper, Chip
} from '@mui/material';
import axios from 'axios';
import FilterPanel from './FilterPanel';
import MetricToggle from './MetricToggle';
import StepChart from './StepChart';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function CourseDashboard({ courseId = null, sx = {} }) {
  const navigate = useNavigate(); // ← хук для смены маршрута
  
  // 📊 Данные графика
  const [data, setData] = useState([]);
  const [filters, setFilters] = useState({ modules: [], lessons: [] });
  
  // 🎛 Фильтры и метрики
  const [selectedMetrics, setSelectedMetrics] = useState(['submissions', 'successful', 'comments']);
  const [activeFilters, setActiveFilters] = useState({ module_id: null, lesson_id: null });
  
  // 📚 Список курсов для пикера
  const [courses, setCourses] = useState([]);
  
  // ⚙️ Загрузка
  const [loading, setLoading] = useState(true);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const requestRef = useRef(null);

  // 🔹 Загружаем список курсов (один раз)
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/courses/stats`, { timeout: 10000 });
        setCourses(res.data.courses || []);
      } catch (err) {
        console.error('❌ Ошибка загрузки курсов:', err);
        setError('Не удалось загрузить список курсов');
      } finally {
        setCoursesLoading(false);
      }
    };
    fetchCourses();
  }, []);

  // 🔹 Загружаем статистику, если courseId есть
  useEffect(() => {
    if (!courseId) return; // ← нет ID в URL → не грузим статистику
    
    const { module_id, lesson_id } = activeFilters;
    const metricsKey = selectedMetrics.join(',');
    const requestKey = `${courseId}-${metricsKey}-${module_id}-${lesson_id}`;
    
    if (requestRef.current === requestKey && !loading) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        requestRef.current = requestKey;
        
        const params = new URLSearchParams({
          metrics: metricsKey,
          ...(module_id && { module_id }),
          ...(lesson_id && { lesson_id }),
        });
        
        const url = `${API_URL}/api/courses/${courseId}/step-stats?${params}`;
        const res = await axios.get(url, { timeout: 10000 });
        
        setData(res.data.data);
        setFilters(res.data.filters);
        setError(null);
      } catch (err) {
        console.error('❌ Ошибка:', err);
        setError(err.response?.data?.error || 'Не удалось загрузить статистику');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    return () => { requestRef.current = null; };
  }, [courseId, selectedMetrics.join(','), activeFilters.module_id, activeFilters.lesson_id]);

  // 🔄 При выборе курса — просто меняем URL
  const handleCourseChange = (event) => {
    const newId = event.target.value;
    navigate(`/dashboard/${newId}`); // ← редирект на /dashboard/123
  };

  // 🎨 Загрузка курсов
  if (coursesLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  // 🎨 Нет курсов в БД
  if (courses.length === 0) {
    return <Container maxWidth="xl" sx={{ py: 8 }}><Alert severity="warning">Курсы не найдены</Alert></Container>;
  }

  // 🎨 НЕТ courseId в URL → показываем пикер на весь экран
  if (!courseId) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            📊 Выберите курс
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Доступно курсов: {courses.length}
          </Typography>
          
          <FormControl fullWidth>
            <Select
              value=""
              onChange={handleCourseChange}
              displayEmpty
              size="large"
              sx={{ fontSize: '1rem' }}
            >
              <MenuItem disabled value=""><em>Выберите курс...</em></MenuItem>
              {courses.map(c => (
                <MenuItem key={c.id} value={c.id} sx={{ py: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <Typography fontWeight={500}>{c.name}</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Chip label={`${c.modules} мод.`} size="small" variant="outlined" />
                      <Chip label={`${c.steps} шагов`} size="small" variant="outlined" />
                    </Box>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Paper>
      </Container>
    );
  }

  // 🎨 ЕСТЬ courseId → показываем дэшборд
  return (
    <Container maxWidth="xl" sx={{ py: 4, ...sx }}>
      
      {/* 🔝 Компактный селект для смены курса (всегда виден) */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap', p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>Курс:</Typography>
        <FormControl sx={{ minWidth: 250, flex: 1 }} size="small">
          <Select value={courseId} onChange={handleCourseChange}>
            {courses.map(c => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      
      <MetricToggle selected={selectedMetrics} onChange={setSelectedMetrics} sx={{ mb: 2 }} />
      <Divider sx={{ my: 2 }} />
      <FilterPanel filters={filters} selected={activeFilters} onChange={setActiveFilters} sx={{ mb: 3 }} />
      
      {loading && !data.length ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <StepChart data={data} metrics={selectedMetrics} sx={{ mb: 4 }} />
      )}
      
      {/* Сводка */}
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mt: 3 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">Шагов</Typography>
          <Typography variant="h6">{data.length}</Typography>
        </Box>
        {selectedMetrics.includes('submissions') && (
          <Box>
            <Typography variant="caption" color="text.secondary">Решений</Typography>
            <Typography variant="h6">{data.reduce((s, i) => s + (i.submissions || 0), 0)}</Typography>
          </Box>
        )}
      </Box>
    </Container>
  );
}