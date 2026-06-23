import { useState } from 'react';
import { Box, Typography, Button, LinearProgress, Alert, Chip } from '@mui/material';
import { AutoFixHigh, PlayArrow, Stop } from '@mui/icons-material';

export default function ModelTrainingPanel({ 
  isTraining, 
  progress, 
  status, 
  message, 
  onStartTraining, 
  onStopTraining,
  selectedMetricsCount,
  canStop = true
}) {
  const [confirmStop, setConfirmStop] = useState(false);

  const handleStart = () => {
    if (selectedMetricsCount === 0) {
      alert('Выберите хотя бы один признак для обучения');
      return;
    }
    onStartTraining();
  };

  const handleStop = () => {
    if (confirmStop) {
      onStopTraining();
      setConfirmStop(false);
    } else {
      setConfirmStop(true);
      setTimeout(() => setConfirmStop(false), 3000);
    }
  };

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AutoFixHigh color="primary" />
        <Typography variant="h6" color="text.primary">
          Обучение моделей
        </Typography>
        {selectedMetricsCount > 0 && (
          <Chip 
            label={`${selectedMetricsCount} признаков`} 
            size="small" 
            color="primary" 
            variant="outlined" 
            sx={{ ml: 1 }} 
          />
        )}
      </Box>

      {!isTraining ? (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button 
            variant="contained" 
            startIcon={<PlayArrow />} 
            onClick={handleStart}
            disabled={selectedMetricsCount === 0}
          >
            🚀 Запустить обучение
          </Button>
          <Typography variant="caption" color="text.secondary">
            Будут обучены: Логистическая регрессия, Random Forest, Градиентный бустинг
          </Typography>
        </Box>
      ) : (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {status === 'preprocessing' && 'Подготовка данных...'}
              {status === 'training' && 'Обучение моделей...'}
              {status === 'evaluating' && 'Оценка качества...'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {Math.round(progress * 100)}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progress * 100} 
            sx={{ 
              height: 8, 
              borderRadius: 4,
              bgcolor: 'action.hover',
              '& .MuiLinearProgress-bar': { bgcolor: 'primary.main' }
            }} 
          />
          {message && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {message}
            </Typography>
          )}
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button 
              variant="outlined" 
              color="error" 
              startIcon={confirmStop ? <Stop /> : null}
              onClick={handleStop}
              size="small"
            >
              {confirmStop ? 'Подтвердить остановку' : 'Остановить'}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}