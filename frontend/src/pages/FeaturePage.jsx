import { useState } from 'react';
import {
  Paper, Typography, Box, Card, CardContent,
  Divider, Chip, Alert, Button, TextField
} from '@mui/material';
import { AutoFixHigh, DataObject, Person, WarningAmber } from '@mui/icons-material';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function FeaturePage() {
  const [userId, setUserId] = useState('');
  const [cutoffDate, setCutoffDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleCompute = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    const cutoff = cutoffDate ? `${cutoffDate}T23:59:59` : new Date().toISOString();
    const body = {
      cutoff_date: cutoff,
      user_id: userId ? parseInt(userId, 10) : undefined
    };

    try {
      const res = await fetch(`${API_URL}/api/features/compute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 4, bgcolor: 'background.paper' }}>
      {/* Заголовок */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AutoFixHigh color="primary" />
        <Typography variant="h6">Вычисление фич для предсказания отчисления</Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Форма ввода */}
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
              background: '#374151',
              border: '1px solid #4B5563',
              borderRadius: 4,
              padding: '8px 10px',
              color: '#fff',
              fontSize: '0.875rem',
              cursor: 'pointer',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </Box>

        <Box sx={{ flex: '1 1 200px' }}>
          <Button variant="contained" onClick={handleCompute} disabled={loading} fullWidth>
            {loading ? 'Вычисление...' : '🚀 Вычислить фичи'}
          </Button>
        </Box>
      </Box>

      {/* Ошибки и результаты */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      {result && (
        <Box sx={{ p: 2, bgcolor: 'success.lighter', borderRadius: 1, mb: 3, border: '1px solid', borderColor: 'success.light' }}>
          <Typography variant="subtitle2" color="success.main" sx={{ mb: 1, fontWeight: 'bold' }}>
            ✅ Вычисление завершено
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            <Box>
              <Typography variant="caption" display="block">Пользователей</Typography>
              <Typography variant="h6">{result.processed_users}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" display="block">Шагов</Typography>
              <Typography variant="h6">{result.processed_steps}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" display="block">Дата отсечения</Typography>
              <Typography variant="body2">{new Date(result.cutoff_date).toLocaleDateString('ru-RU')}</Typography>
            </Box>
          </Box>
        </Box>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Справочные карточки */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>📋 Что вычисляется:</Typography>
      
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, 
        gap: 2 
      }}>
        <Card sx={{ bgcolor: 'action.hover' }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <DataObject color="primary" fontSize="small" />
              <Typography variant="subtitle2" fontWeight={600}>На уровне шага</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Число попыток, ошибки до успеха, паттерн (W,W,C)
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ bgcolor: 'action.hover' }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Person color="primary" fontSize="small" />
              <Typography variant="subtitle2" fontWeight={600}>На уровне пользователя</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Успех с 1-й попытки, тренд попыток, % «залипаний»
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ bgcolor: 'action.hover', border: '1px dashed', borderColor: 'divider' }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <WarningAmber color="warning" fontSize="small" />
              <Typography variant="subtitle2" fontWeight={600}>💡 Совет</Typography>
            </Box>
            <Typography component="span" variant="body2" color="text.secondary">
              Для теста укажите 
              <Chip label="User ID" size="small" variant="outlined" sx={{ verticalAlign: 'middle', mx: 0.5 }} />. 
              Для полного пересчёта оставьте поле пустым.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Paper>
  );
}