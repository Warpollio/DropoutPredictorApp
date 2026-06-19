import { useState } from 'react';
import { Box, Typography, TextField, Button, Alert, CircularProgress, Paper } from '@mui/material';
import { PersonRemove } from '@mui/icons-material';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function TeachersCleanup({ courseId }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleCleanup = async () => {
    if (!courseId) {
      setError('Сначала выберите курс');
      return;
    }
    if (!query.trim()) {
      setError('Введите имя или ID пользователя');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
    const res = await fetch(`${API_URL}/api/cleanup/teachers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), course_id: courseId })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
    
    setResult(data); // { deleted_teachers: X, deleted_submissions: Y }
    } catch (err) {
    setError(err.message);
    } finally {
    setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <PersonRemove color="error" />
        <Typography variant="subtitle1" color="text.primary" fontWeight={600}>
          Удаление пользователей
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Поиск по имени или ID для удаления решений конкретных пользователей.
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', mb: 2 }}>
        <TextField
          label="Имя или ID пользователя"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          size="small"
          fullWidth
          placeholder="Например: Иванов И.И."
          sx={{ 
            '& .MuiInputBase-input': { color: 'text.primary' },
            '& .MuiInputLabel-root': { color: 'text.secondary' },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'text.secondary' }
          }}
        />
        <Button 
          variant="contained" 
          color="error" 
          onClick={handleCleanup} 
          disabled={loading || !query.trim()}
          startIcon={!loading && <PersonRemove />}
          sx={{ minWidth: 120 }}
        >
          {loading ? <CircularProgress size={20} color="inherit" /> : 'Удалить'}
        </Button>
      </Box>

      {result && (
        <Alert severity="success" sx={{ mt: 1 }}>
          Решений удалено: <b>{result.deleted_submissions}</b>
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    </Paper>
  );
}