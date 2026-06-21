import { useState, useEffect } from 'react';
import {
  Paper, Typography, Box, Divider, Chip, Alert, 
  Button, FormControl, InputLabel, Select, MenuItem, 
  LinearProgress, useTheme
} from '@mui/material';
import { AutoFixHigh, School } from '@mui/icons-material';
import axios from 'axios';

import UserComparisonTable from '../components/features/UserComparisonTable';
import CoursePicker from '../components/common/CoursePicker';
import useFeatureComputation from '../hooks/useFeatureComputation';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function FeaturePage() {
  const theme = useTheme();
  

  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState(null);


  const [obsDays, setObsDays] = useState(30);

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

  // Table refresh
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (status === 'completed' && result) {
      setRefreshKey(prev => prev + 1);
    }
  }, [status, result]);

  // Загрузка списка курсов
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
      } finally {
        setCoursesLoading(false);
      }
    };
    fetchCourses();
  }, [selectedCourse]);

  useEffect(() => {

    if (!isComputing) {
      resetCompute();
    }
  }, [selectedCourse]);

  // Запуск вычисления
  const handleCompute = () => {
    if (!selectedCourse) return;
    startCompute({
      course_id: selectedCourse,
      obs_days: obsDays
    });
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

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 4, bgcolor: 'background.paper' }}>
      
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
            onChange={(e) => setSelectedCourse(e.target.value)}
            sx={{
              '& .MuiSelect-select': {
                bgcolor: 'background.default',
                color: 'text.primary',
                fontSize: '0.875rem',
                py: 0.5,
                px: 1.5
              },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'text.secondary' },
              '& .MuiSvgIcon-root': { color: 'text.secondary' },
              '& .MuiMenuItem-root': {
                bgcolor: 'background.default',
                color: 'text.primary',
                fontSize: '0.875rem',
                '&:hover': { bgcolor: 'action.hover' },
                '&.Mui-selected': { bgcolor: 'action.selected' }
              },
              '& .MuiPaper-root': { bgcolor: 'background.paper' }
            }}
          >
            {courses.map(c => (
              <MenuItem key={c.id} value={c.id} sx={{ py: 1 }}>
                {c.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Chip label={`ID: ${selectedCourse}`} size="small" variant="outlined" />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AutoFixHigh color="primary" />
        <Typography variant="h6" color="text.primary">
          Вычисление признаков
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3, alignItems: 'flex-end' }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="obs-days-label" sx={{ color: 'text.secondary' }}>
            Интервал наблюдения (дней)
          </InputLabel>
          <Select
            labelId="obs-days-label"
            value={obsDays}
            label="Интервал наблюдения (дней)"
            onChange={(e) => setObsDays(e.target.value)}
            size="small"
            sx={{ 
              '& .MuiInputBase-input': { color: 'text.primary' },
              '& .MuiInputLabel-root': { color: 'text.secondary' }
            }}
          >
            <MenuItem value={7}>7 дней (1 неделя)</MenuItem>
            <MenuItem value={14}>14 дней (2 недели)</MenuItem>
            <MenuItem value={30}>30 дней (1 месяц)</MenuItem>
            <MenuItem value={60}>60 дней (2 месяца)</MenuItem>
            <MenuItem value={90}>90 дней (3 месяца)</MenuItem>
          </Select>
        </FormControl>

        <Button 
          variant="contained" 
          onClick={handleCompute} 
          disabled={isComputing}
          sx={{ height: 40 }}
        >
          {isComputing ? '⏳ Вычисление...' : '🚀 Запустить'}
        </Button>
      </Box>


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
              '& .MuiLinearProgress-bar': { bgcolor: 'primary.main' }
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
                Интервал
              </Typography>
              <Typography variant="body2" color="text.primary">
                {obsDays} дней
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      <Divider sx={{ my: 3 }} />
      
      <UserComparisonTable courseId={selectedCourse}
                           refreshTrigger={refreshKey}/>
    </Paper>
  );
}