import { useState } from 'react';
import { 
  Box, Typography, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, Chip, Button, Tooltip, IconButton,
  Divider, Alert
} from '@mui/material';
import { 
  CheckCircle, RadioButtonUnchecked, Info, PlayArrow, 
  BarChart, Assessment 
} from '@mui/icons-material';

const METRICS = [
  { id: 'roc_auc', label: 'ROC-AUC', description: 'Способность ранжировать студентов по риску', higherIsBetter: true },
  { id: 'precision', label: 'Precision', description: 'Доля верных срабатываний среди всех предсказаний "риск"', higherIsBetter: true },
  { id: 'recall', label: 'Recall', description: 'Доля выявленных отчислений среди всех реальных', higherIsBetter: true },
  { id: 'f1', label: 'F1-Score', description: 'Гармоническое среднее Precision и Recall', higherIsBetter: true },
];

const MOCK_MODELS = [
  {
    id: 'logistic',
    name: 'Логистическая регрессия',
    metrics: { roc_auc: 0.78, precision: 0.65, recall: 0.72, f1: 0.68 },
    trainingTime: '2.3 мин',
    features: 6,
  },
  {
    id: 'random_forest',
    name: 'Random Forest',
    metrics: { roc_auc: 0.84, precision: 0.71, recall: 0.79, f1: 0.75 },
    trainingTime: '5.1 мин',
    features: 6,
  },
  {
    id: 'xgboost',
    name: 'Градиентный бустинг (XGBoost)',
    metrics: { roc_auc: 0.89, precision: 0.76, recall: 0.83, f1: 0.79 },
    trainingTime: '8.7 мин',
    features: 6,
    recommended: true,
  },
];

export default function ModelComparisonTable({ models = MOCK_MODELS, onApplyModel }) {
  const [appliedModel, setAppliedModel] = useState(null);
  const [showInfo, setShowInfo] = useState(null);

  const bestInColumn = (metricId) => {
    const values = models.map(m => m.metrics[metricId]).filter(v => v != null);
    return values.length > 0 ? Math.max(...values) : null;
  };

  const getMetricColor = (value, metricId) => {
    if (value == null) return 'text.secondary';
    const best = bestInColumn(metricId);
    if (Math.abs(value - best) < 0.01) return 'success.main';
    if (value < best - 0.1) return 'error.main';
    return 'text.primary';
  };

  const handleApply = (modelId) => {
    setAppliedModel(modelId);
    onApplyModel?.(modelId);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Assessment color="primary" />
        <Typography variant="h6" color="text.primary">
          Сравнение моделей
        </Typography>
      </Box>

      {appliedModel && (
        <Alert 
          severity="success" 
          sx={{ mb: 2 }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => setAppliedModel(null)}
            >
              Сбросить
            </Button>
          }
        >
          Применена модель: <b>{models.find(m => m.id === appliedModel)?.name}</b>. 
          Теперь можно генерировать прогнозы для студентов.
        </Alert>
      )}

      <TableContainer component={Paper} sx={{ 
        bgcolor: 'background.paper', 
        border: '1px solid', 
        borderColor: 'divider',
        mb: 2 
      }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: 'background.default' }}>
            <TableRow>
              <TableCell sx={{ color: 'text.primary', fontWeight: 600, minWidth: 200 }}>Модель</TableCell>
              {METRICS.map(metric => (
                <TableCell key={metric.id} sx={{ color: 'text.primary', fontWeight: 600, textAlign: 'center', position: 'relative' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    {metric.label}
                    <Tooltip title={metric.description} arrow>
                      <IconButton 
                        size="small" 
                        onClick={(e) => { e.stopPropagation(); setShowInfo(showInfo === metric.id ? null : metric.id); }}
                        sx={{ 
                          color: 'text.secondary', 
                          '&:hover': { color: 'primary.main' },
                          p: 0.5 
                        }}
                      >
                        <Info fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  {showInfo === metric.id && (
                    <Typography variant="caption" color="text.secondary" sx={{ 
                      position: 'absolute', top: '100%', left: 0, right: 0, 
                      bgcolor: 'background.paper', p: 1, borderRadius: 1, 
                      border: '1px solid', borderColor: 'divider', zIndex: 10 
                    }}>
                      {metric.description}
                    </Typography>
                  )}
                </TableCell>
              ))}
              <TableCell sx={{ color: 'text.primary', fontWeight: 600, textAlign: 'center' }}>Время</TableCell>
              <TableCell sx={{ color: 'text.primary', fontWeight: 600, textAlign: 'right' }}>Действие</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {models.map(model => (
              <TableRow 
                key={model.id} 
                hover 
                sx={{ 
                  bgcolor: appliedModel === model.id ? 'rgba(34, 197, 94, 0.08)' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' }
                }}
              >
                <TableCell sx={{ color: 'text.primary', borderColor: 'divider', verticalAlign: 'top' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {model.recommended && (
                      <Chip 
                        label="рекомендуется" 
                        size="small" 
                        color="primary" 
                        variant="outlined" 
                        sx={{ height: 20, fontSize: '0.7rem' }} 
                      />
                    )}
                    <Typography variant="body2" fontWeight={500} color="text.primary">
                      {model.name}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {model.features} признаков
                  </Typography>
                </TableCell>
                {METRICS.map(metric => (
                  <TableCell 
                    key={metric.id} 
                    sx={{ 
                      color: getMetricColor(model.metrics[metric.id], metric.id), 
                      borderColor: 'divider', 
                      textAlign: 'center', 
                      fontWeight: model.metrics[metric.id] === bestInColumn(metric.id) ? 600 : 400 
                    }}
                  >
                    {model.metrics[metric.id]?.toFixed(2) || '—'}
                  </TableCell>
                ))}
                <TableCell sx={{ color: 'text.secondary', borderColor: 'divider', textAlign: 'center' }}>
                  {model.trainingTime}
                </TableCell>
                <TableCell sx={{ borderColor: 'divider', textAlign: 'right' }}>
                  {appliedModel === model.id ? (
                    <Chip 
                      icon={<CheckCircle fontSize="small" />} 
                      label="Применена" 
                      size="small" 
                      color="success" 
                      variant="filled" 
                    />
                  ) : (
                    <Tooltip title="Применить модель для прогнозирования">
                      <Button 
                        size="small" 
                        variant="outlined" 
                        startIcon={<PlayArrow fontSize="small" />}
                        onClick={() => handleApply(model.id)}
                        sx={{ 
                          color: 'primary.main', 
                          borderColor: 'primary.main',
                          '&:hover': { borderColor: 'primary.dark', bgcolor: 'action.hover' }
                        }}
                      >
                        Применить
                      </Button>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <BarChart fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary">
          <b style={{ color: 'success.main' }}>Зелёный</b> — лучшее значение в колонке,{' '}
          <b style={{ color: 'error.main' }}>красный</b> — значение более чем на 0.1 хуже лучшего
        </Typography>
      </Box>
    </Box>
  );
}