import { useState, useEffect } from 'react';
import { 
  Box, FormControl, InputLabel, Select, MenuItem, 
  Chip, Typography, Paper 
} from '@mui/material';

export default function FilterPanel({ filters, selected, onChange, sx = {} }) {
  const [selectedModule, setSelectedModule] = useState(selected.module_id || '');
  const [selectedLesson, setSelectedLesson] = useState(selected.lesson_id || '');
  
  const availableLessons = selectedModule 
    ? filters.lessons.filter(l => l.module_id === parseInt(selectedModule))
    : filters.lessons;

  useEffect(() => {
    onChange({
      module_id: selectedModule || null,
      lesson_id: selectedLesson || null
    });
  }, [selectedModule, selectedLesson]);

  useEffect(() => {
    if (selectedModule && !availableLessons.some(l => l.id === parseInt(selectedLesson))) {
      setSelectedLesson('');
    }
  }, [selectedModule, availableLessons]);

  return (
    <Paper elevation={1} sx={{ p: 2, ...sx }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <Typography variant="subtitle2" sx={{ mr: 1 }}>
          Фильтры:
        </Typography>
        
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Модуль</InputLabel>
          <Select
            value={selectedModule}
            label="Модуль"
            onChange={(e) => {
              setSelectedModule(e.target.value);
              if (!e.target.value) setSelectedLesson('');
            }}
          >
            <MenuItem value="">Все модули</MenuItem>
            {filters.modules.map(mod => (
              <MenuItem key={mod.id} value={mod.id}>
                {mod.name} #{mod.position}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }} disabled={!selectedModule && !filters.lessons.length}>
          <InputLabel>Урок</InputLabel>
          <Select
            value={selectedLesson}
            label="Урок"
            onChange={(e) => setSelectedLesson(e.target.value)}
          >
            <MenuItem value="">Все уроки</MenuItem>
            {availableLessons.map(lesson => (
              <MenuItem key={lesson.id} value={lesson.id}>
                {lesson.name} #{lesson.position}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
          {selectedModule && (
            <Chip 
              label={`Модуль #${selectedModule}`} 
              size="small" 
              onDelete={() => setSelectedModule('')}
              variant="outlined"
            />
          )}
          {selectedLesson && (
            <Chip 
              label={`Урок #${selectedLesson}`} 
              size="small" 
              onDelete={() => setSelectedLesson('')}
              variant="outlined"
            />
          )}
        </Box>
      </Box>
    </Paper>
  );
}