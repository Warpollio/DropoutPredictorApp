import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Paper, Typography, FormControl, Select, MenuItem,
  Box, Chip, CircularProgress, Alert, useTheme
} from '@mui/material';
import { School } from '@mui/icons-material';

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
  const theme = useTheme();

  const handleChange = (event) => {
    const courseId = event.target.value;
    if (useNavigation && courseId) {
      navigate(`/dashboard/${courseId}`);
    } else if (onSelect) {
      onSelect(courseId);
      setLocalValue('');
    }
  };

  // Состояние загрузки
  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={24} color="primary" />
          <Typography color="text.secondary">Загрузка списка курсов...</Typography>
        </Box>
      </Container>
    );
  }

  // Нет курсов в БД
  if (courses.length === 0) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Alert 
          severity="warning" 
          sx={{ 
            bgcolor: 'background.paper', 
            color: 'text.primary', 
            borderColor: 'divider',
            '& .MuiAlert-icon': { color: 'warning.light' }
          }} 
        >
          <Typography fontWeight={600} mb={1}>Курсы не найдены</Typography>
          <Typography variant="body2" color="text.secondary">
            Импортируйте структуру курса через панель импорта, чтобы начать работу.
          </Typography>
        </Alert>
      </Container>
    );
  }


  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Paper 
        elevation={3} 
        sx={{ 
          p: 4, 
          textAlign: 'center', 
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: 1, 
          mb: 2,
          bgcolor: 'background.default'
        }}>
          <School color="primary" />
          <Typography variant="h5" fontWeight={600} color="text.primary">
            {title}
          </Typography>
        </Box>
        
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Доступно курсов: <b style={{ color: theme.palette.text.primary }}>{courses.length}</b>
        </Typography>
        
        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3, 
              bgcolor: 'error.main', 
              color: 'error.contrastText',
              '& .MuiAlert-icon': { color: 'error.light' }
            }} 
          >
            {error}
          </Alert>
        )}
        
        <FormControl fullWidth>
          <Select
            value={localValue}
            onChange={handleChange}
            displayEmpty
            size="large"
            sx={{
              '& .MuiSelect-select': {
                bgcolor: 'background.default',
                color: 'text.primary',
                fontSize: '1rem',
                py: 1.5,
                px: 2,
                '&:focus': { bgcolor: 'background.default' }
              },
              '& .MuiOutlinedInput-notchedOutline': { 
                borderColor: 'divider' 
              },
              '&:hover .MuiOutlinedInput-notchedOutline': { 
                borderColor: 'text.secondary' 
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { 
                borderColor: 'primary.main' 
              },
              '& .MuiSvgIcon-root': { 
                color: 'text.secondary' 
              },
              '& .MuiMenuItem-root': {
                bgcolor: 'background.default',
                color: 'text.primary',
                fontSize: '0.875rem',
                py: 1.5,
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
            <MenuItem disabled value="" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
              {placeholder}
            </MenuItem>
            {courses.map(course => (
              <MenuItem key={course.id} value={course.id}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <Typography fontWeight={500} color="text.primary">{course.name}</Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {course.modules !== undefined && (
                      <Chip 
                        label={`${course.modules} мод.`} 
                        size="small" 
                        variant="outlined" 
                        sx={{ 
                          color: 'text.secondary', 
                          borderColor: 'divider', 
                          height: 24,
                          '& .MuiChip-label': { px: 1 }
                        }} 
                      />
                    )}
                    {course.steps !== undefined && (
                      <Chip 
                        label={`${course.steps} шагов`} 
                        size="small" 
                        variant="outlined" 
                        sx={{ 
                          color: 'text.secondary', 
                          borderColor: 'divider', 
                          height: 24,
                          '& .MuiChip-label': { px: 1 }
                        }} 
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