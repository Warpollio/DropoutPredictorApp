// src/components/features/ComputationResult.jsx
import { Box, Typography, Chip, Divider, Alert, Grid, LinearProgress } from '@mui/material'
import { CheckCircle, Error, Info, HourglassEmpty } from '@mui/icons-material'

export default function ComputationResult({ status, progress, message, result, error, onReset }) {
  const isComputing = ['pending', 'running'].includes(status);

  // Ничего не показываем в состоянии idle
  if (status === 'idle' && !result && !error) return null;

  return (
    <Box sx={{ mt: 2 }}>
      {/* 🔹 Прогресс во время вычисления */}
      {isComputing && (
        <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid #4B5563' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <HourglassEmpty color="info" fontSize="small" />
            <Typography variant="subtitle2" fontWeight={600}>
              {status === 'pending' ? 'Запуск задачи...' : 'Вычисление признаков'}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">{message || 'Обработка...'}</Typography>
            <Typography variant="caption" color="text.secondary">{Math.round(progress * 100)}%</Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progress * 100} 
            sx={{ height: 6, borderRadius: 3 }} 
          />
        </Box>
      )}

      {/* ❌ Ошибка */}
      {error && (
        <Alert severity="error" icon={<Error />} onClose={onReset}>
          <Typography variant="subtitle2" fontWeight={600}>Ошибка вычисления</Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
      )}

      {/* ✅ Результат */}
      {result && !isComputing && (
        <Box sx={{ 
          p: 2, 
          bgcolor: 'success.lighter', 
          border: '1px solid', 
          borderColor: 'success.light',
          borderRadius: 1 
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <CheckCircle color="success" fontSize="small" />
            <Typography variant="subtitle2" fontWeight={600} color="success.main">
              ✅ Вычисление завершено
            </Typography>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">Пользователей</Typography>
              <Typography variant="h6" color="text.primary">{result.processed_users}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">Шагов</Typography>
              <Typography variant="h6" color="text.primary">{result.processed_steps}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">Дата отсечения</Typography>
              <Typography variant="body2" color="text.primary">
                {new Date(result.cutoff_date).toLocaleDateString('ru-RU')}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">Статус</Typography>
              <Chip label="Готово" size="small" color="success" variant="outlined" />
            </Grid>
          </Grid>

          {result?.warning && (
            <>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                <Info color="info" fontSize="small" sx={{ mt: 0.2 }} />
                <Typography variant="caption" color="text.secondary">
                  {result.warning}
                </Typography>
              </Box>
            </>
          )}
        </Box>
      )}
    </Box>
  )
}