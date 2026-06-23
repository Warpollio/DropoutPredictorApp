import { Box, Typography, FormControl, InputLabel, Select, MenuItem, Chip } from '@mui/material';
import { School, CalendarToday } from '@mui/icons-material';

export default function CourseSessionSelector({ 
  courses, 
  sessions, 
  selectedCourse, 
  selectedSession, 
  onCourseChange, 
  onSessionChange,
  loading = { courses: false, sessions: false }
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
        <FormControl sx={{ minWidth: 280 }} size="small" disabled={loading.courses || !courses.length}>
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

        <FormControl 
          sx={{ minWidth: 280 }} 
          size="small" 
          disabled={loading.sessions || !sessions.length || !selectedCourse}
        >
          <InputLabel id="session-select-label">Сессия вычисления</InputLabel>
          <Select
            labelId="session-select-label"
            value={selectedSession || ''}
            label="Сессия вычисления"
            onChange={(e) => onSessionChange(e.target.value)}
            sx={{
              '& .MuiSelect-select': { color: 'text.primary', py: 0.5 },
              '& .MuiInputLabel-root': { color: 'text.secondary' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'text.secondary' }
            }}
          >
            {sessions.map((session, index) => (
              <MenuItem 
                key={`${session.course_id}-${session.id}-${index}`} 
                value={session.id}
                sx={{ py: 1 }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CalendarToday fontSize="small" sx={{ color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.primary">
                      {session.cutoff_date ? new Date(session.cutoff_date).toLocaleDateString('ru-RU') : '—'}
                    </Typography>
                    <Chip 
                      label={`v${session.algorithm_version}`} 
                      size="small" 
                      variant="outlined" 
                      sx={{ color: 'text.secondary', borderColor: 'divider', height: 20, fontSize: '0.7rem' }} 
                    />
                  </Box>
                  
                  {session.description && (
                    <Typography 
                      variant="caption" 
                      color="text.secondary" 
                      sx={{ pl: 3, lineHeight: 1.2, maxWidth: 350 }}
                    >
                      {session.description.length > 50 ? `${session.description.slice(0, 50)}…` : session.description}
                    </Typography>
                  )}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    </Box>
  );
}