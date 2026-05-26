import { Box, Checkbox, FormControlLabel, Typography } from '@mui/material';

const METRICS = [
  { key: 'submissions', label: 'Всего решений', color: '#3B82F6' },
  { key: 'successful', label: 'Успешные решения', color: '#10B981' },
  { key: 'comments', label: 'Комментарии', color: '#8B5CF6' },
];

export default function MetricToggle({ selected, onChange, sx = {} }) {
  const handleChange = (metricKey) => (event) => {
    if (event.target.checked) {
      onChange([...selected, metricKey]);
    } else {
      onChange(selected.filter(m => m !== metricKey));
    }
  };

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, ...sx }}>
      <Typography variant="subtitle2" sx={{ mr: 2, my: 'auto' }}>
        Показать:
      </Typography>
      {METRICS.map(metric => (
        <FormControlLabel
          key={metric.key}
          control={
            <Checkbox
              checked={selected.includes(metric.key)}
              onChange={handleChange(metric.key)}
              sx={{ 
                color: metric.color,
                '&.Mui-checked': { color: metric.color }
              }}
              size="small"
            />
          }
          label={
            <Typography variant="body2" sx={{ color: metric.color }}>
              {metric.label}
            </Typography>
          }
        />
      ))}
    </Box>
  );
}