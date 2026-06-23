import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, Box, Alert, CircularProgress, Divider, 
  Typography, Select, MenuItem, FormControl, Paper, Chip
} from '@mui/material';
import axios from 'axios';
import FilterPanel from './FilterPanel';
import MetricToggle from './MetricToggle';
import StepChart from './StepChart';
import EnrollmentChart from './EnrollmentChart';

import CoursePicker from '../common/CoursePicker';

const API_URL = 'http://localhost:5000';

export default function CourseDashboard({ courseId = null, sx = {} }) {
  const navigate = useNavigate(); // ← хук для смены маршрута
  
  // Данные графика
  const [data, setData] = useState([]);
  const [filters, setFilters] = useState({ modules: [], lessons: [] });
  
  // Фильтры и метрики
  const [selectedMetrics, setSelectedMetrics] = useState(['submissions', 'successful', 'comments']);
  const [activeFilters, setActiveFilters] = useState({ module_id: null, lesson_id: null });
  
  // Список курсов для пикера
  const [courses, setCourses] = useState([]);
  
  // Загрузка
  const [loading, setLoading] = useState(true);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const requestRef = useRef(null);

  // График поступлений

  const [enrollmentDates, setEnrollmentDates] = useState({
  start: '',  
  end: ''    
});
const [enrollmentPeriod, setEnrollmentPeriod] = useState('month'); // 'day' | 'week' | 'month'
const [enrollmentData, setEnrollmentData] = useState([]);
const [enrollmentLoading, setEnrollmentLoading] = useState(false);

  //список курсов
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/courses/list`, { timeout: 100000 });
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

  //статистика, если courseId есть
  useEffect(() => {
    if (!courseId) return;
    
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
        const res = await axios.get(url, { timeout: 100000 });
        
        setData(res.data.data);
        setFilters(res.data.filters);
        setError(null);
      } catch (err) {
        console.error('Ошибка:', err);
        setError(err.response?.data?.error || 'Не удалось загрузить статистику');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    return () => { requestRef.current = null; };
  }, [courseId, selectedMetrics.join(','), activeFilters.module_id, activeFilters.lesson_id]);


  useEffect(() => {
    if (!courseId) return;
    
    const fetchEnrollment = async () => {
      try {
        setEnrollmentLoading(true);
        
        const params = { interval: enrollmentPeriod };
        if (enrollmentDates.start) params.start_date = enrollmentDates.start;
        if (enrollmentDates.end) params.end_date = enrollmentDates.end;
        
        const res = await axios.get(
          `${API_URL}/api/courses/${courseId}/enrollment`,
          { timeout: 10000, params }
        );
        setEnrollmentData(res.data.data);
      } catch (err) {
        console.error('Ошибка загрузки enrollment:', err);
        setError('Не удалось загрузить статистику регистрации');
      } finally {
        setEnrollmentLoading(false);
      }
    };
    
    fetchEnrollment();
  }, [courseId, enrollmentPeriod, enrollmentDates.start, enrollmentDates.end]);

  const handleCourseChange = (event) => {
    const newId = event.target.value;
    navigate(`/dashboard/${newId}`); // /dashboard/123
  };

  // Загрузка курсов
  if (coursesLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  // Нет курсов
  if (courses.length === 0) {
    return <Container maxWidth="xl" sx={{ py: 8 }}><Alert severity="warning">Курсы не найдены</Alert></Container>;
  }

  // НЕТ courseId в URL → показываем пикер
  if (!courseId) {
    return (
      <CoursePicker
        courses={courses}
        loading={coursesLoading}
        error={error}
        useNavigation={true} // ← используем navigate для смены URL
        title="📊 Выберите курс для анализа"
        placeholder="Выберите курс..."
      />
    );
  }

  //показываем дэшборд
  return (
    <Container maxWidth="xl" sx={{ py: 4, ...sx }}>
      
      {/*селект для смены курса (всегда виден) */}
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
      
      <Paper elevation={1} sx={{ p: 2, mb: 3, bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" fontWeight={600}>📅 Период:</Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">С:</Typography>
            <input
              type="date"
              value={enrollmentDates.start}
              onChange={(e) => setEnrollmentDates(prev => ({ ...prev, start: e.target.value }))}
              style={{ 
                border: '1px solid #4B5563', borderRadius: 4, 
                padding: '6px 10px', color: '#fff', fontSize: '0.875rem' 
              }}
            />
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">По:</Typography>
            <input
              type="date"
              value={enrollmentDates.end}
              onChange={(e) => setEnrollmentDates(prev => ({ ...prev, end: e.target.value }))}
              style={{ 
                border: '1px solid #4B5563', borderRadius: 4, 
                padding: '6px 10px', color: '#fff', fontSize: '0.875rem' 
              }}
            />
          </Box>
          
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5,}}>
            <Typography variant="caption" color="text.secondary">Группировка:</Typography>
            <Select
              value={enrollmentPeriod}
              onChange={(e) => setEnrollmentPeriod(e.target.value)}
              size="small"
              sx={{ 
                minWidth: 100, 
                '.MuiSelect-select': { py: 0.5, px: 1 },
              }}
            >
              <MenuItem value="day">По дням</MenuItem>
              <MenuItem value="week">По неделям</MenuItem>
              <MenuItem value="month">По месяцам</MenuItem>
            </Select>
          </Box>
          
          {/* Кнопка сброса */}
          <Box sx={{ ml: 'auto' }}>
            <Chip 
              label="✕ Сбросить" 
              size="small" 
              onClick={() => {
                setEnrollmentDates({ start: '', end: '' });
                setEnrollmentPeriod('month');
              }}
              variant="outlined"
            />
          </Box>
        </Box>
      </Paper>

      <EnrollmentChart 
        data={enrollmentData} 
        period={enrollmentPeriod}
        sx={{ mb: 4 }}
      />
    </Container>
  );
}