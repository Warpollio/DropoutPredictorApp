import { useState, useEffect } from 'react';
import { 
  Paper, Typography, FormControl, InputLabel, Select, MenuItem, 
  Box, Grid, Card, CardContent, Divider, Chip, CircularProgress, Alert 
} from '@mui/material';
import { School, Category, MenuBook, People, Assignment } from '@mui/icons-material';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function CourseStatsPanel({ sx = {}, onCourseChange}) {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState(null);

  // Загрузка списка курсов
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/courses/list`);
        setCourses(res.data.courses);
        if (res.data.courses.length > 0) {
          setSelectedCourse(res.data.courses[0].id.toString());
        }
      } catch (err) {
        setError('Не удалось загрузить список курсов');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  // Загрузка деталей при выборе курса
  useEffect(() => {
    if (!selectedCourse) return;
    
    const fetchDetails = async () => {
      setLoadingDetails(true);
      try {
        const res = await axios.get(`${API_URL}/api/courses/${selectedCourse}/details`);
        setDetails(res.data);
      } catch (err) {
        setDetails(null);
        console.error(err);
      } finally {
        setLoadingDetails(false);
      }
    };
    fetchDetails();
  }, [selectedCourse]);

  useEffect(() => {
    if (onCourseChange && selectedCourse) {
      onCourseChange(selectedCourse);
    }
  }, [selectedCourse, onCourseChange]);

  if (loading) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center', ...sx }}>
        <CircularProgress size={24} />
        <Typography sx={{ ml: 2 }}>Загрузка статистики...</Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 4, bgcolor: 'background.paper', ...sx }}>
      {/* Заголовок и селектор */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <School color="primary" />
          <Typography variant="h6">
            Курсы в базе: <Chip label={courses.length} size="small" color="primary" />
          </Typography>
        </Box>
        
        <FormControl sx={{ minWidth: 220 }} size="small">
          <InputLabel id="course-select-label">Выбрать курс</InputLabel>
          <Select
            labelId="course-select-label"
            value={selectedCourse}
            label="Выбрать курс"
            onChange={(e) => setSelectedCourse(e.target.value)}
          >
            {courses.map((course) => (
              <MenuItem key={course.id} value={course.id}>
                {course.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Детали выбранного курса */}
      {selectedCourse && details && (
        <>
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" color="text.primary">
              {details.course.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
              <Chip 
                label={`Сложность: ${details.course.difficulty}`} 
                size="small" 
                variant="outlined" 
                color="primary"
              />
              <Chip 
                label={`Дискриминация: ${details.course.discrimination}`} 
                size="small" 
                variant="outlined" 
                color="secondary"
              />
            </Box>
          </Box>

          {/* Карточки статистики */}
          {loadingDetails ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={20} />
              <Typography sx={{ ml: 2, fontSize: '0.875rem' }}>Обновление...</Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {/* Модули */}
              <Grid item xs={6} sm={4} md={2.4}>
                <Card sx={{ bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2, textAlign: 'center' }}>
                    <Category color="primary" sx={{ mb: 1 }} />
                    <Typography variant="h6" color="text.primary">
                      {details.stats.modules}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Модулей
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>


              <Grid item xs={6} sm={4} md={2.4}>
                <Card sx={{ bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2, textAlign: 'center' }}>
                    <MenuBook color="primary" sx={{ mb: 1 }} />
                    <Typography variant="h6" color="text.primary">
                      {details.stats.lessons}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Уроков
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Шаги */}
              <Grid item xs={6} sm={4} md={2.4}>
                <Card sx={{ bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2, textAlign: 'center' }}>
                    <Assignment color="primary" sx={{ mb: 1 }} />
                    <Typography variant="h6" color="text.primary">
                      {details.stats.steps}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Шагов
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Активные студенты */}
              <Grid item xs={6} sm={4} md={2.4}>
                <Card sx={{ bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2, textAlign: 'center' }}>
                    <People color="success" sx={{ mb: 1 }} />
                    <Typography variant="h6" color="text.primary">
                      {details.stats.active_learners}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Студентов
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Попытки */}
              <Grid item xs={6} sm={4} md={2.4}>
                <Card sx={{ bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2, textAlign: 'center' }}>
                    <Assignment color="secondary" sx={{ mb: 1 }} />
                    <Typography variant="h6" color="text.primary">
                      {details.stats.submissions}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Попыток
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </>
      )}

      {selectedCourse && !details && !loadingDetails && (
        <Alert severity="info">Выберите курс для просмотра статистики</Alert>
      )}
    </Paper>
  );
}