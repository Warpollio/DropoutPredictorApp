import { Box, Typography, FormControlLabel, Checkbox, Paper, Divider, Tooltip } from '@mui/material';
import { Analytics, Info } from '@mui/icons-material';

export default function MetricsSelector({ 
  availableMetrics = [], 
  selectedMetrics = [], 
  onToggleMetric, 
  onSelectAll, 
  onClearAll 
}) {
  const allMetricIds = availableMetrics.map(m => m.id);
  const allSelected = availableMetrics.length > 0 && selectedMetrics.length === allMetricIds.length;

  return (
    <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Analytics color="primary" />
          <Typography variant="subtitle1" color="text.primary" fontWeight={600}>
            Признаки для обучения
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={allSelected}
                indeterminate={selectedMetrics.length > 0 && !allSelected}
                onChange={onSelectAll}
                size="small"
                sx={{ color: 'text.secondary', '&.Mui-checked': { color: 'primary.main' } }}
              />
            }
            label={<Typography variant="caption" color="text.secondary">Выбрать все</Typography>}
            sx={{ m: 0 }}
          />
          <Typography
            component="button"
            variant="caption"
            color="primary.main"
            sx={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
            onClick={onClearAll}
          >
            Очистить
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Плоский список метрик */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {availableMetrics.map((metric) => (
          <Tooltip key={metric.id} title={metric.description || ''} arrow placement="right">
            <FormControlLabel
              control={
                <Checkbox
                  checked={selectedMetrics.includes(metric.id)}
                  onChange={() => onToggleMetric(metric.id)}
                  size="small"
                  sx={{ color: 'text.secondary', '&.Mui-checked': { color: 'primary.main' } }}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" color="text.primary">
                    {metric.label}
                  </Typography>
                  <Info fontSize="small" sx={{ color: 'text.secondary', opacity: 0.7 }} />
                </Box>
              }
              sx={{
                m: 0,
                py: 1,
                px: 1,
                borderRadius: 1,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            />
          </Tooltip>
        ))}
        
        {availableMetrics.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            Нет доступных метрик
          </Typography>
        )}
      </Box>
    </Paper>
  );
}