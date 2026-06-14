import { useState, useEffect } from 'react';
import {
  Paper, Typography, Box, Card, CardContent,
  Divider, Chip, Alert, Button, TextField,
  FormControl, Select, MenuItem, LinearProgress, useTheme
} from '@mui/material';
import { AutoFixHigh, DataObject, Person, WarningAmber, School } from '@mui/icons-material';
import axios from 'axios';

import UserComparisonTable from '../components/features/UserComparisonTable';
import CoursePicker from '../components/common/CoursePicker';

import useFeatureComputation from '../hooks/useFeatureComputation';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function FeaturePage() {
  const theme = useTheme();
  
  //вычисление фич
  const [userId, setUserId] = useState('');
  const [cutoffDate, setCutoffDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  //выбор курса
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

  //список курсов
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/courses/list`, { timeout: 10000 });
        setCourses(res.data.courses || []);
        if (res.data.courses?.length > 0 && !selectedCourse) {
          setSelectedCourse(res.data.courses[0].id);
        }
      } catch (err) {
        console.error('❌ Ошибка загрузки курсов:', err);
        // setError('Не удалось загрузить список курсов');
      } finally {
        setCoursesLoading(false);
      }
    };
    fetchCourses();
  }, [selectedCourse]);

  //кнопка "вычислить"
  const handleCompute = () => {
    const cutoff = cutoffDate ? `${cutoffDate}T23:59:59` : new Date().toISOString();
    const body = {
      cutoff_date: cutoff,
      user_id: userId ? parseInt(userId, 10) : undefined,
      ...(selectedCourse && { course_id: selectedCourse })
    };
    startCompute(body);
  };

  //сброс при смене курса
  useEffect(() => {
    resetCompute();
  }, [selectedCourse]);

  // смена курса через компактный селект
  const handleCourseChange = (event) => {
    setSelectedCourse(event.target.value);
  };

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

  //основной интерфейс
  return (
    <Paper elevation={2} sx={{ p: 3, mb: 4, bgcolor: 'background.paper' }}>
      
      {/*селектор смены курса*/}
      <Box sx={{ 
        display: 'flex', gap: 2, mb: 3, alignItems: 'center', 
        flexWrap: 'wrap', p: 2, 
        bgcolor: 'background.default',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <School color="primary" fontSize="small" />
          <Typography variant="subtitle2" fontWeight={600} color="text.primary">
            Курс:
          </Typography>
        </Box>
        <FormControl sx={{ minWidth: 250, flex: 1 }} size="small">
          <Select 
            value={selectedCourse} 
            onChange={handleCourseChange}
            sx={{
              '& .MuiSelect-select': {
                bgcolor: 'background.default',
                color: 'text.primary',
                fontSize: '0.875rem',
                py: 0.5,
                px: 1.5
              },
              '& .MuiOutlinedInput-notchedOutline': { 
                borderColor: 'divider' 
              },
              '&:hover .MuiOutlinedInput-notchedOutline': { 
                borderColor: 'text.secondary' 
              },
              '& .MuiSvgIcon-root': { 
                color: 'text.secondary' 
              },
              '& .MuiMenuItem-root': {
                bgcolor: 'background.default',
                color: 'text.primary',
                fontSize: '0.875rem',
                '&:hover': { 
                  bgcolor: 'action.hover' 
                },
                '&.Mui-selected': { 
                  bgcolor: 'action.selected',
                  '&:hover': { bgcolor: 'action.hover' }
                }
              },
              '& .MuiPaper-root': { 
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider'
              }
            }}
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
          sx={{ 
            color: 'text.secondary', 
            borderColor: 'divider' 
          }}
        />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AutoFixHigh color="primary" />
        <Typography variant="h6" color="text.primary">
          Вычисление признаков для предсказания отчисления
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

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
              '& .MuiInputBase-input': { color: 'text.primary' },
              '& .MuiInputLabel-root': { color: 'text.secondary' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'text.secondary' },
              '& .MuiInputBase-input::placeholder': { color: 'text.secondary', opacity: 0.7 }
            }}
          />
        </Box>

        <Box sx={{ flex: '1 1 200px' }}>
          <Typography variant="caption" display="block" sx={{ mb: 0.5, color: 'text.secondary' }}>
            Дата отсечения
          </Typography>
          <input
            type="date"
            value={cutoffDate}
            onChange={(e) => setCutoffDate(e.target.value)}
            style={{
              width: '100%',
              background: 'background.default',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 4,
              padding: '8px 10px',
              color: theme.palette.text.primary,
              fontSize: '0.875rem',
              cursor: 'pointer',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </Box>

        <Box sx={{ flex: '1 1 200px' }}>
          <Button 
            variant="contained" 
            onClick={handleCompute} 
            disabled={loading} 
            fullWidth
          >
            {loading ? 'Вычисление...' : '🚀 Вычислить'}
          </Button>
        </Box>
      </Box>

      {/*прогрес бар*/}
      {isComputing && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {status === 'pending' ? 'Запуск...' : 'Обработка'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {Math.round(progress * 100)}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progress * 100} 
            sx={{ 
              height: 8, 
              borderRadius: 4,
              bgcolor: 'action.hover',
              '& .MuiLinearProgress-bar': { 
                bgcolor: 'primary.main' 
              }
            }} 
          />
          {message && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {message}
            </Typography>
          )}
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => resetCompute()}>
          {error}
        </Alert>
      )}
      
      {/*результат */}
      {result && !isComputing && (
        <Box sx={{ 
          p: 2, 
          bgcolor: 'rgba(34, 197, 94, 0.1)', 
          borderRadius: 1, 
          mb: 3, 
          border: '1px solid', 
          borderColor: 'success.main' 
        }}>
          <Typography variant="subtitle2" color="success.main" sx={{ mb: 1, fontWeight: 'bold' }}>
            ✅ Вычисление завершено
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            <Box>
              <Typography variant="caption" display="block" color="text.secondary">
                Пользователей
              </Typography>
              <Typography variant="h6" color="text.primary">
                {result.processed_users}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" display="block" color="text.secondary">
                Шагов
              </Typography>
              <Typography variant="h6" color="text.primary">
                {result.processed_steps}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" display="block" color="text.secondary">
                Дата отсечения
              </Typography>
              <Typography variant="body2" color="text.primary">
                {new Date(result.cutoff_date).toLocaleDateString('ru-RU')}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      <Divider sx={{ my: 3 }} />
      <UserComparisonTable courseId={selectedCourse} />
    </Paper>
  );
}