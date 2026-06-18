import { Box, Typography, FormControlLabel, Checkbox, Paper, Divider, Tooltip } from '@mui/material';
import { Analytics, Info } from '@mui/icons-material';

const METRIC_GROUPS = {
  'Успешность': [
    { id: 'first_try_success_rate', label: 'Успех с первой попытки (%)', description: 'Доля шагов, решённых верно с первого раза' },
    { id: 'steps_completed', label: 'Пройдено шагов', description: 'Количество уникальных шагов, к которым обращался студент' },
  ],
  'Активность': [
    { id: 'avg_attempts_per_step', label: 'Среднее число попыток', description: 'Среднее количество попыток на один шаг' },
    { id: 'std_attempts_per_step', label: 'Стабильность попыток (std)', description: 'Стандартное отклонение числа попыток по шагам' },
  ],
  'Поведенческие паттерны': [
    { id: 'avg_errors_before_success', label: 'Ошибок до успеха', description: 'Среднее количество неверных попыток до первого верного ответа' },
    { id: 'pct_steps_with_post_success', label: '"Решения после успеха" (%)', description: 'Доля шагов, на которых были попытки после успешного решения' },
  ],
};

export default function MetricsSelector({ selectedMetrics, onToggleMetric, onSelectAll, onClearAll }) {
  const allMetricIds = Object.values(METRIC_GROUPS).flat().map(m => m.id);
  const allSelected = selectedMetrics.length === allMetricIds.length;

  return (
    <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
      {/* Шапка с переключателями */}
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

      {/* Список метрик вертикально */}
      {Object.entries(METRIC_GROUPS).map(([group, metrics], groupIndex, groups) => (
        <Box key={group} sx={{ mb: groupIndex < groups.length - 1 ? 3 : 0 }}>
          <Typography
            variant="overline"
            color="text.secondary"
            fontWeight={600}
            sx={{ display: 'block', mb: 1, letterSpacing: 0.5 }}
          >
            {group}
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {metrics.map((metric) => (
              <Tooltip key={metric.id} title={metric.description} arrow placement="right">
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
          </Box>
        </Box>
      ))}
    </Paper>
  );
}