import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Paper, Typography, FormControl, Select, MenuItem,
  Box, Chip, CircularProgress, Alert
} from '@mui/material';
import { School } from '@mui/icons-material';

// 🎨 Единый стиль для тёмной темы (можно вынести в theme.js)
const darkStyles = {
  paper: {
    p: 4,
    textAlign: 'center',
    bgcolor: '#111827',
    border: '1px solid #4B5563',
    borderRadius: 2
  },
  select: {
    '& .MuiSelect-select': {
      background: '#374151',
      color: '#fff',
      fontSize: '1rem',
      py: 1,
      px: 2
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
  }
};

/**
 * Универсальный пикер курсов
 * @param {Object} props
 * @param {Array} props.courses - Список курсов [{ id, name, modules, steps, ... }]
 * @param {boolean} props.loading - Состояние загрузки
 * @param {string|null} props.error - Текст ошибки
 * @param {Function} props.onSelect - Callback при выборе курса: (courseId) => void
 * @param {boolean} props.useNavigation - Если true, использует navigate вместо onSelect
 * @param {string} props.placeholder - Текст заглушки в селекте
 * @param {string} props.title - Заголовок компонента
 */
export default function CoursePicker({
  courses = [],
  loading = false,
  error = null,
  onSelect = null,
  useNavigation = false,
  placeholder = 'Выберите курс...',
  title = '📊 Выберите курс'
}) {
  const navigate = useNavigate();
  const [localValue, setLocalValue] = useState('');

  const handleChange = (event) => {
    const courseId = event.target.value;
    if (useNavigation && courseId) {
      navigate(`/dashboard/${courseId}`);
    } else if (onSelect) {
      onSelect(courseId);
      setLocalValue(''); // Сброс для повторного выбора того же курса
    }
  };

  // Состояние загрузки
  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={24} />
          <Typography color="#9CA3AF">Загрузка списка курсов...</Typography>
        </Box>
      </Container>
    );
  }

  // Нет курсов в БД
  if (courses.length === 0) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Alert severity="warning" sx={{ bgcolor: '#1f2937', color: '#e5e7eb', border: '1px solid #4B5563' }}>
          <Typography fontWeight={600} mb={1}>Курсы не найдены</Typography>
          <Typography variant="body2" color="#9CA3AF">
            Импортируйте структуру курса через панель импорта, чтобы начать работу.
          </Typography>
        </Alert>
      </Container>
    );
  }

  // Основной UI
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Paper elevation={3} sx={darkStyles.paper}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
          <School color="primary" />
          <Typography variant="h5" fontWeight={600} color="#e5e7eb">
            {title}
          </Typography>
        </Box>
        
        <Typography color="#9CA3AF" sx={{ mb: 3 }}>
          Доступно курсов: <b style={{ color: '#e5e7eb' }}>{courses.length}</b>
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3, bgcolor: '#fef2f2', color: '#991b1b' }}>
            {error}
          </Alert>
        )}
        
        <FormControl fullWidth>
          <Select
            value={localValue}
            onChange={handleChange}
            displayEmpty
            size="large"
            sx={darkStyles.select}
          >
            <MenuItem disabled value="" sx={{ color: '#6B7280' }}>
              <em>{placeholder}</em>
            </MenuItem>
            {courses.map(course => (
              <MenuItem key={course.id} value={course.id} sx={{ py: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <Typography fontWeight={500} color="#e5e7eb">{course.name}</Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {course.modules !== undefined && (
                      <Chip 
                        label={`${course.modules} мод.`} 
                        size="small" 
                        variant="outlined" 
                        sx={{ color: '#9CA3AF', borderColor: '#4B5563', height: 24 }} 
                      />
                    )}
                    {course.steps !== undefined && (
                      <Chip 
                        label={`${course.steps} шагов`} 
                        size="small" 
                        variant="outlined" 
                        sx={{ color: '#9CA3AF', borderColor: '#4B5563', height: 24 }} 
                      />
                    )}
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