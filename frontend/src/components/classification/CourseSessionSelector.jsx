import { Box, Typography, FormControl, InputLabel, Select, MenuItem, Chip } from '@mui/material';
import { School, CalendarToday } from '@mui/icons-material';

export default function CourseSessionSelector({ 
  courses, 
  sessions, 
  selectedCourse, 
  selectedSession, 
  onCourseChange, 
  onSessionChange 
}) {
  return (
    <Box sx={{ 
      p: 2, 
      bgcolor: 'background.default', 
      borderRadius: 1, 
      border: '1px solid', 
      borderColor: 'divider',
      mb: 3 
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <School color="primary" />
        <Typography variant="subtitle1" color="text.primary" fontWeight={600}>
          Данные для обучения
        </Typography>
      </Box>
      
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'flex-end' }}>
        {/* Выбор курса */}
        <FormControl sx={{ minWidth: 280 }} size="small">
          <InputLabel id="course-select-label">Курс</InputLabel>
          <Select
            labelId="course-select-label"
            value={selectedCourse || ''}
            label="Курс"
            onChange={(e) => onCourseChange(e.target.value)}
            sx={{
              '& .MuiSelect-select': { color: 'text.primary' },
              '& .MuiInputLabel-root': { color: 'text.secondary' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'text.secondary' }
            }}
          >
            {courses.map(course => (
              <MenuItem key={course.id} value={course.id}>
                {course.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Выбор сессии */}
        <FormControl sx={{ minWidth: 280 }} size="small" disabled={!selectedCourse}>
          <InputLabel id="session-select-label">Сессия вычисления</InputLabel>
          <Select
            labelId="session-select-label"
            value={selectedSession || ''}
            label="Сессия вычисления"
            onChange={(e) => onSessionChange(e.target.value)}
            sx={{
              '& .MuiSelect-select': { color: 'text.primary' },
              '& .MuiInputLabel-root': { color: 'text.secondary' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'text.secondary' }
            }}
          >
            {sessions.map(session => (
              <MenuItem key={session.id} value={session.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarToday fontSize="small" sx={{ color: 'text.secondary' }} />
                  {new Date(session.cutoff_date).toLocaleDateString('ru-RU')}
                  <Chip 
                    label={`v${session.algorithm_version}`} 
                    size="small" 
                    variant="outlined" 
                    sx={{ ml: 1, color: 'text.secondary', borderColor: 'divider', height: 20 }} 
                  />
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    </Box>
  );
}