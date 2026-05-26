import { useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, Brush, ResponsiveContainer 
} from 'recharts';
import { Paper, Typography, Box } from '@mui/material';

const COLORS = { submissions: '#3B82F6', successful: '#10B981', comments: '#8B5CF6' };
const LABELS = { submissions: 'Всего решений', successful: 'Успешные решения', comments: 'Комментарии' };

export default function StepChart({ data, metrics, sx = {} }) {
  const chartKey = useMemo(() => `chart-${data?.length || 0}-${metrics.join('-')}`, [data, metrics]);

  const chartData = useMemo(() => {
    return (data || []).map(item => ({
      step: `#${item.position}`,
      ...Object.fromEntries(metrics.map(m => [m, item[m] ?? 0]))
    }));
  }, [data, metrics]);

  if (!data?.length) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', minHeight: 300, ...sx }}>
        <Typography color="text.secondary">Нет данных для отображения</Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 2, overflow: 'hidden', ...sx }}>  {/* ← уменьшили padding */}
      <Typography variant="h6" gutterBottom color="text.primary">
        Активность по шагам
      </Typography>
      
      <Box sx={{ width: '100%', height: 400 }}>  {/* ← фиксированная высота для ResponsiveContainer */}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            key={chartKey}
            data={chartData}
            margin={{ top: 5, right: 15, left: 5, bottom: 35 }}  // ← компактные отступы
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="step" 
              stroke="#9CA3AF" 
              tick={{ fontSize: 10 }} 
              angle={-45} 
              textAnchor="end" 
              height={60}
              //interval={0}
              interval={Math.max(1, Math.floor(data.length / 15))}
            />
            <YAxis 
              stroke="#9CA3AF" 
              tick={{ fontSize: 10 }} 
              allowDecimals={false}
              width={40}
            />
            <Tooltip
              trigger="all"  // ← ключевое: активирует тултип при наведении на любую область
              cursor={{ stroke: '#6366F1', strokeWidth: 1, strokeDasharray: '3 3', pointerEvents: 'none'}}  // ← визуальный курсор
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151',
                borderRadius: 8,
                fontSize: 12
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
            
            {metrics.map(m => (
              <Line
                key={m}
                type="monotone"
                dataKey={m}
                name={LABELS[m]}
                stroke={COLORS[m]}
                strokeWidth={2}
                dot={false}
                //activeDot={{ r: 5 }}
                activeDot = {false}
              />
            ))}
            
            <Brush height={25} stroke="#6366F1" travellerWidth={8} dataKey="step" />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
}