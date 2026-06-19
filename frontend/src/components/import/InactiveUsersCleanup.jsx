import { useState } from 'react';
import { Box, Typography, TextField, Button, Alert, CircularProgress, Paper } from '@mui/material';
import { DeleteSweep } from '@mui/icons-material';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function InactiveUsersCleanup({ courseId }) {
  const [minSteps, setMinSteps] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleCleanup = async () => {
    if (!courseId) {
      setError('Сначала выберите курс');
      return;
    }
    if (!minSteps || minSteps < 0) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
    const res = await fetch(`${API_URL}/api/cleanup/inactive-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ min_steps: parseInt(minSteps, 10), course_id: courseId })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
    
    setResult(data); // { deleted_users: X, deleted_submissions: Y }
    } catch (err) {
    setError(err.message);
    } finally {
    setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <DeleteSweep color="primary" />
        <Typography variant="subtitle1" color="text.primary" fontWeight={600}>
          Очистка неактивных студентов
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Удаляет попытки пользователей, которые решили меньше указанного количества шагов.
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', mb: 2 }}>
        <TextField
          label="Мин. кол-во шагов"
          type="number"
          value={minSteps}
          onChange={(e) => setMinSteps(parseInt(e.target.value, 10))}
          size="small"
          fullWidth
          InputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
          sx={{ 
            '& .MuiInputBase-input': { color: 'text.primary' },
            '& .MuiInputLabel-root': { color: 'text.secondary' },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'text.secondary' }
          }}
        />
        <Button 
          variant="contained" 
          onClick={handleCleanup} 
          disabled={loading}
          startIcon={!loading && <DeleteSweep />}
          sx={{ minWidth: 120 }}
        >
          {loading ? <CircularProgress size={20} color="inherit" /> : 'Очистить'}
        </Button>
      </Box>

      {result && (
        <Alert severity="success" sx={{ mt: 1 }}>
          Студентов затронуто: <b>{result.deleted_users}</b>, решений удалено: <b>{result.deleted_submissions}</b>
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    </Paper>
  );
}