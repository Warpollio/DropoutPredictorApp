import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, LinearProgress, Tooltip, Button } from '@mui/material';
import { WarningAmber, Person, Info } from '@mui/icons-material';

export default function PredictionsTable({ predictions = [], loading = false, onReset }) {
  const getRiskColor = (prob) => {
    if (prob >= 0.8) return 'error.main';
    if (prob >= 0.6) return 'warning.main';
    return 'success.main';
  };

  const getRiskLabel = (prob) => {
    if (prob >= 0.8) return 'Высокий риск';
    if (prob >= 0.6) return 'Средний риск';
    return 'Низкий риск';
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <LinearProgress sx={{ mb: 2 }} />
        <Typography color="text.secondary">Загрузка прогнозов...</Typography>
      </Box>
    );
  }

  if (!predictions.length) {
    return (
      <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
        <WarningAmber sx={{ mb: 1, color: 'warning.main' }} />
        <Typography>Нет студентов с риском отчисления по выбранным критериям</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmber color="warning" />
          <Typography variant="h6" color="text.primary">
            Студенты с риском отчисления ({predictions.length})
          </Typography>
        </Box>
        {onReset && (
          <Button size="small" variant="outlined" onClick={onReset}>
            Скрыть
          </Button>
        )}
      </Box>

      <TableContainer component={Paper} sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: 'background.default' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, minWidth: 180 }}>Студент</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>Прогресс</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>Вероятность</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>Риск</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Последняя активность</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Факторы</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {predictions.map((pred, index) => (
              <TableRow key={pred.user_id || index} hover>
                <TableCell sx={{ verticalAlign: 'top', minWidth: 180 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Person fontSize="small" sx={{ color: 'text.secondary' }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="body2" fontWeight={600} color="text.primary">
                        {pred.last_name || '—'} {pred.first_name || ''}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ID: {pred.user_id}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell sx={{ textAlign: 'center' }}>
                  <Chip 
                    label={`${pred.progress_percent?.toFixed(1) || '—'}%`} 
                    size="small" 
                    color={pred.progress_percent < 50 ? 'error' : 'default'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell sx={{ textAlign: 'center' }}>
                  <Typography 
                    variant="body2" 
                    fontWeight={600}
                    sx={{ color: getRiskColor(pred.dropout_probability) }}
                  >
                    {(pred.dropout_probability * 100).toFixed(1)}%
                  </Typography>
                </TableCell>
                <TableCell sx={{ textAlign: 'center' }}>
                  <Chip 
                    label={getRiskLabel(pred.dropout_probability)} 
                    size="small" 
                    sx={{ 
                      bgcolor: `${getRiskColor(pred.dropout_probability)}15`,
                      color: getRiskColor(pred.dropout_probability),
                      fontWeight: 500
                    }} 
                  />
                </TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>
                  {pred.last_activity_utc 
                    ? new Date(pred.last_activity_utc).toLocaleDateString('ru-RU')
                    : '—'
                  }
                </TableCell>
                <TableCell sx={{ textAlign: 'right' }}>
                  {pred.risk_factors?.length > 0 && (
                    <Tooltip 
                      title={
                        <Box sx={{ p: 1 }}>
                          {pred.risk_factors.map((f, i) => (
                            <Box key={i} sx={{ mb: i < pred.risk_factors.length - 1 ? 1 : 0 }}>
                              <Typography variant="caption" color="text.primary" sx={{ display: 'block' }}>
                                <b>{f.feature}:</b> {f.value?.toFixed?.(2) ?? f.value}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                                важность: {(f.importance * 100).toFixed(1)}%
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      }
                      arrow
                      placement="top"
                    >
                      <Chip 
                        label={`${pred.risk_factors.length} фактора`} 
                        size="small" 
                        variant="outlined"
                        sx={{ cursor: 'help' }}
                      />
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: 'error.main' }} />
          <Typography variant="caption" color="text.secondary">≥80% — высокий риск</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: 'warning.main' }} />
          <Typography variant="caption" color="text.secondary">60-79% — средний риск</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: 'success.main' }} />
          <Typography variant="caption" color="text.secondary">&lt;60% — низкий риск</Typography>
        </Box>
      </Box>
    </Box>
  );
}