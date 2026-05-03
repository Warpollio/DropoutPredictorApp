import { Container, Typography, Paper, Grid, FormControl, InputLabel, Select, MenuItem, Button, Box, Chip } from '@mui/material'
import { useState } from 'react'

function FilterPage() {
  const [filters, setFilters] = useState({
    course: '',
    difficulty: '',
    status: '',
  })

  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value })
  }

  const handleApply = () => {
    console.log('Applied filters:', filters)
    // Здесь можно отправить фильтры на бэкенд или в контекст
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Фильтры данных
        </Typography>

        <Grid container spacing={3} sx={{ mt: 2 }}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Курс</InputLabel>
              <Select
                name="course"
                value={filters.course}
                label="Курс"
                onChange={handleChange}
              >
                <MenuItem value=""><em>Все курсы</em></MenuItem>
                <MenuItem value="1">Математика</MenuItem>
                <MenuItem value="2">Физика</MenuItem>
                <MenuItem value="3">Программирование</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Сложность</InputLabel>
              <Select
                name="difficulty"
                value={filters.difficulty}
                label="Сложность"
                onChange={handleChange}
              >
                <MenuItem value=""><em>Любая</em></MenuItem>
                <MenuItem value="low">Низкая</MenuItem>
                <MenuItem value="medium">Средняя</MenuItem>
                <MenuItem value="high">Высокая</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Статус</InputLabel>
              <Select
                name="status"
                value={filters.status}
                label="Статус"
                onChange={handleChange}
              >
                <MenuItem value=""><em>Все</em></MenuItem>
                <MenuItem value="active">Активные</MenuItem>
                <MenuItem value="completed">Завершенные</MenuItem>
                <MenuItem value="dropped">Отчисленные</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
          <Button variant="contained" size="large" onClick={handleApply}>
            Применить фильтры
          </Button>
          <Button variant="outlined" size="large" onClick={() => setFilters({ course: '', difficulty: '', status: '' })}>
            Сбросить
          </Button>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Активные фильтры:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {Object.entries(filters).map(([key, value]) =>
              value ? <Chip key={key} label={`${key}: ${value}`} onDelete={() => setFilters({ ...filters, [key]: '' })} /> : null
            )}
          </Box>
        </Box>
      </Paper>
    </Container>
  )
}

export default FilterPage