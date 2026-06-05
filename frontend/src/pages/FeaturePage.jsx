import { useState, useEffect } from 'react';
import {
  Paper, Typography, Box, Card, CardContent,
  Divider, Chip, Alert, Button, TextField,
  FormControl, Select, MenuItem, LinearProgress
} from '@mui/material';
import { AutoFixHigh, DataObject, Person, WarningAmber, School } from '@mui/icons-material';
import axios from 'axios';

import UserComparisonTable from '../components/features/UserComparisonTable';
import CoursePicker from '../components/common/CoursePicker';

import useFeatureComputation from '../hooks/useFeatureComputation';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// 🎨 Стили для компактного селекта курса (в единой тёмной теме)
const compactSelectStyles = {
  '& .MuiSelect-select': {
    background: '#374151',
    color: '#fff',
    fontSize: '0.875rem',
    py: 0.5,
    px: 1.5
  },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#4B5563' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#6B7280' },
  '& .MuiSvgIcon-root': { color: '#9CA3AF' },
  '& .MuiMenuItem-root': {
    background: '#1f2937',
    color: '#e5e7eb',
    fontSize: '0.875rem',
    '&:hover': { background: '#374151' },
    '&.Mui-selected': { background: '#374151' }
  },
  '& .MuiPaper-root': { background: '#1f2937', border: '1px solid #4B5563' }
};

export default function FeaturePage() {
  // === Состояние для вычисления фич ===
  const [userId, setUserId] = useState('');
  const [cutoffDate, setCutoffDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  //const [result, setResult] = useState(null);
  //const [error, setError] = useState(null);

  // === Состояние для выбора курса ===
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState(null);

    const {
      start: startCompute,
      reset: resetCompute,
      status,
      progress,
      message,
      result,
      error,
      isComputing
    } = useFeatureComputation();

  // 🔹 Загрузка списка курсов при монтировании
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/courses/stats`, { timeout: 10000 });
        setCourses(res.data.courses || []);
        // Автовыбор первого курса, если список не пуст и курс ещё не выбран
        if (res.data.courses?.length > 0 && !selectedCourse) {
          setSelectedCourse(res.data.courses[0].id);
        }
      } catch (err) {
        console.error('❌ Ошибка загрузки курсов:', err);
        setError('Не удалось загрузить список курсов');
      } finally {
        setCoursesLoading(false);
      }
    };
    fetchCourses();
  }, [selectedCourse]);

  // 🔹 Обработчик кнопки "Вычислить"
  const handleCompute = () => {
    const cutoff = cutoffDate ? `${cutoffDate}T23:59:59` : new Date().toISOString();
    const body = {
      cutoff_date: cutoff,
      user_id: userId ? parseInt(userId, 10) : undefined,
      ...(selectedCourse && { course_id: selectedCourse })
    };
    startCompute(body);
  };

  // 🔹 Сброс при смене курса
  useEffect(() => {
    resetCompute();
  }, [selectedCourse]);

  // 🔹 Смена курса через компактный селект
  const handleCourseChange = (event) => {
    setSelectedCourse(event.target.value);
  };

  // 🔹 Стили для input type="date"
  const dateInputStyle = {
    width: '100%',
    background: '#374151',
    border: '1px solid #4B5563',
    borderRadius: 4,
    padding: '8px 10px',
    color: '#fff',
    fontSize: '0.875rem',
    cursor: 'pointer',
    outline: 'none',
    boxSizing: 'border-box'
  };

  // 🎨 Если курс НЕ выбран — показываем пикер на весь экран
  if (!selectedCourse) {
    return (
      <CoursePicker
        courses={courses}
        loading={coursesLoading}
        error={error}
        onSelect={setSelectedCourse}
        useNavigation={false}
        title="🔮 Выберите курс для вычисления признаков"
        placeholder="Выберите курс, чтобы начать..."
      />
    );
  }

  // 🎨 Если курс выбран — показываем основной интерфейс
  return (
    <Paper elevation={2} sx={{ p: 3, mb: 4, bgcolor: 'background.paper' }}>
      
      {/* 🔝 Компактный селект для смены курса (всегда виден) */}
      <Box sx={{ 
        display: 'flex', gap: 2, mb: 3, alignItems: 'center', 
        flexWrap: 'wrap', p: 2, 
        bgcolor: '#111827', borderRadius: 1,
        border: '1px solid #4B5563'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <School color="primary" fontSize="small" />
          <Typography variant="subtitle2" fontWeight={600} color="#e5e7eb">Курс:</Typography>
        </Box>
        <FormControl sx={{ minWidth: 250, flex: 1 }} size="small">
          <Select 
            value={selectedCourse} 
            onChange={handleCourseChange}
            sx={compactSelectStyles}
          >
            {courses.map(c => (
              <MenuItem key={c.id} value={c.id} sx={{ py: 1 }}>
                {c.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Chip 
          label={`ID: ${selectedCourse}`} 
          size="small" 
          variant="outlined"
          sx={{ color: '#9CA3AF', borderColor: '#4B5563' }}
        />
      </Box>

      {/* Заголовок раздела */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AutoFixHigh color="primary" />
        <Typography variant="h6" color="#e5e7eb">Вычисление признаков для предсказания отчисления</Typography>
      </Box>

      <Divider sx={{ my: 2, borderColor: '#4B5563' }} />

      {/* Форма ввода параметров вычисления */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3, alignItems: 'flex-end' }}>
        <Box sx={{ flex: '1 1 200px' }}>
          <TextField
            label="User ID (опционально)"
            type="number"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            fullWidth
            size="small"
            placeholder="Оставьте пустым для всех"
            sx={{ 
              '& .MuiInputBase-input': { color: '#fff' },
              '& .MuiInputLabel-root': { color: '#9CA3AF' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#4B5563' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#6B7280' }
            }}
          />
        </Box>

        <Box sx={{ flex: '1 1 200px' }}>
          <Typography variant="caption" display="block" sx={{ mb: 0.5, color: '#9CA3AF' }}>
            Дата отсечения
          </Typography>
          <input
            type="date"
            value={cutoffDate}
            onChange={(e) => setCutoffDate(e.target.value)}
            style={dateInputStyle}
          />
        </Box>

        <Box sx={{ flex: '1 1 200px' }}>
          <Button variant="contained" onClick={handleCompute} disabled={loading} fullWidth>
            {loading ? 'Вычисление...' : '🚀 Вычислить'}
          </Button>
        </Box>
      </Box>

      {/* 🔹 Прогресс-бар (показывается во время вычисления) */}
      {isComputing && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="#9CA3AF">
              {status === 'pending' ? 'Запуск...' : 'Обработка'}
            </Typography>
            <Typography variant="caption" color="#9CA3AF">
              {Math.round(progress * 100)}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progress * 100} 
            sx={{ 
              height: 8, 
              borderRadius: 4,
              '& .MuiLinearProgress-bar': { bgcolor: '#3B82F6' }
            }} 
          />
          {message && (
            <Typography variant="caption" color="#9CA3AF" sx={{ mt: 0.5, display: 'block' }}>
              {message}
            </Typography>
          )}
        </Box>
      )}

      {/* ❌ Ошибка */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => resetCompute()}>
          {error}
        </Alert>
      )}
      
      {/* ✅ Результат */}
      {result && !isComputing && (
        <Box sx={{ 
          p: 2, 
          bgcolor: 'rgba(34, 197, 94, 0.1)', 
          borderRadius: 1, 
          mb: 3, 
          border: '1px solid', 
          borderColor: '#22c55e' 
        }}>
          <Typography variant="subtitle2" color="#22c55e" sx={{ mb: 1, fontWeight: 'bold' }}>
            ✅ Вычисление завершено
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            <Box>
              <Typography variant="caption" display="block" color="#9CA3AF">Пользователей</Typography>
              <Typography variant="h6" color="#e5e7eb">{result.processed_users}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" display="block" color="#9CA3AF">Шагов</Typography>
              <Typography variant="h6" color="#e5e7eb">{result.processed_steps}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" display="block" color="#9CA3AF">Дата отсечения</Typography>
              <Typography variant="body2" color="#e5e7eb">
                {new Date(result.cutoff_date).toLocaleDateString('ru-RU')}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      <Divider sx={{ my: 3, borderColor: '#4B5563' }} />
      <UserComparisonTable courseId={selectedCourse} />
    </Paper>
  );
}