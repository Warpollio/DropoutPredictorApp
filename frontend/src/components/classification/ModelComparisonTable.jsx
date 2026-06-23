import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Button, Tooltip } from '@mui/material';
import { CheckCircle, PlayArrow, Info } from '@mui/icons-material';

const METRICS = [
  { id: 'roc_auc', label: 'ROC-AUC', higherIsBetter: true },
  { id: 'precision', label: 'Precision', higherIsBetter: true },
  { id: 'recall', label: 'Recall', higherIsBetter: true },
  { id: 'f1', label: 'F1-Score', higherIsBetter: true },
];

const MODEL_ID_MAP = {
  'Logistic Regression': 'logistic',
  'Random Forest': 'random_forest',
  'Gradient Boosting': 'gradient_boosting'
};

export default function ModelComparisonTable({ models = [], onApplyModel, appliedModel = null }) {
  const bestInColumn = (metricId) => {
    const values = models.map(m => m[metricId]).filter(v => v != null);
    return values.length > 0 ? Math.max(...values) : null;
  };

  const getMetricColor = (value, metricId) => {
    if (value == null) return 'text.secondary';
    const best = bestInColumn(metricId);
    if (Math.abs(value - best) < 0.01) return 'success.main';
    if (value < best - 0.1) return 'error.main';
    return 'text.primary';
  };

  if (!models || models.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
        <Typography>Нет данных для отображения</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="h6" color="text.primary">Сравнение моделей</Typography>
      </Box>

      {appliedModel && (
        <Box sx={{ mb: 2, p: 1, bgcolor: 'rgba(34, 197, 94, 0.1)', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="success.main">
            ✅ Применена: <b>{models.find(m => m.model === appliedModel)?.model}</b>
          </Typography>
          <Button size="small" onClick={() => onApplyModel?.(null)}>Сбросить</Button>
        </Box>
      )}

      <TableContainer component={Paper} sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: 'background.default' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Модель</TableCell>
              {METRICS.map(m => (
                <TableCell key={m.id} sx={{ fontWeight: 600, textAlign: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    {m.label}
                    <Tooltip title={m.higherIsBetter ? 'Чем выше — тем лучше' : 'Чем ниже — тем лучше'}>
                      <Info fontSize="small" sx={{ color: 'text.secondary', cursor: 'help' }} />
                    </Tooltip>
                  </Box>
                </TableCell>
              ))}
              <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>Действие</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {models.map((model, index) => (
              <TableRow 
                key={model.model || index} 
                hover 
                sx={{ 
                  bgcolor: appliedModel === model.model ? 'rgba(34, 197, 94, 0.08)' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' }
                }}
              >
                <TableCell sx={{ verticalAlign: 'top' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {model.recommended && (
                      <Chip label="рекомендуется" size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                    )}
                    <Typography variant="body2" fontWeight={500}>
                      {model.model}
                    </Typography>
                  </Box>
                </TableCell>
                {METRICS.map(metric => (
                  <TableCell 
                    key={metric.id} 
                    sx={{ 
                      textAlign: 'center', 
                      color: getMetricColor(model[metric.id], metric.id),
                      fontWeight: model[metric.id] === bestInColumn(metric.id) ? 600 : 400 
                    }}
                  >
                    {model[metric.id]?.toFixed(3) || '—'}
                  </TableCell>
                ))}
                <TableCell sx={{ textAlign: 'right' }}>
                  {appliedModel === model.model ? (
                    <Chip icon={<CheckCircle fontSize="small" />} label="Применена" size="small" color="success" variant="filled" />
                  ) : (
                    <Button 
                      size="small" 
                      variant="outlined" 
                      startIcon={<PlayArrow fontSize="small" />} 
                      onClick={() => onApplyModel?.(MODEL_ID_MAP[model.model] || model.model)}
                    >
                      Применить
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          <b style={{ color: 'success.main' }}>Зелёный</b> — лучшее в колонке,{' '}
          <b style={{ color: 'error.main' }}>красный</b> — хуже на 0.1+
        </Typography>
      </Box>
    </Box>
  );
}