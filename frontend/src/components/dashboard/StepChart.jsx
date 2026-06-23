import { useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, Brush, ResponsiveContainer
} from 'recharts';
import { Paper, Typography, Box, Divider } from '@mui/material';

const COLORS = { submissions: '#3B82F6', successful: '#10B981', comments: '#8B5CF6' };
const LABELS = { submissions: 'Всего решений', successful: 'Успешные решения', comments: 'Комментарии' };

export default function StepChart({ data, metrics, sx = {} }) {
  const chartKey = useMemo(() => `chart-${data?.length || 0}-${metrics.join('-')}`, [data, metrics]);


  const chartData = useMemo(() => {
    return (data || []).map(item => ({
      step: item.step_id,           //  для оси X
      stepId: item.step_id,                // для тултипа
      moduleId: item.module_id,
      lessonId: item.lesson_id,
      position: item.position,    
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
    <Paper elevation={2} sx={{ p: 2, overflow: 'hidden', ...sx }}>
      <Typography variant="h6" gutterBottom color="text.primary">
        Активность по шагам
      </Typography>
      
      <Box sx={{ width: '100%', height: 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            key={chartKey}
            data={chartData}
            margin={{ top: 5, right: 15, left: 5, bottom: 35 }}
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
              trigger="all"
              cursor={{ stroke: '#6366F1', strokeWidth: 1, strokeDasharray: '3 3', pointerEvents: 'none' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0]?.payload; // берём данные первой метрики
                
                return (
                  <Box sx={{
                    bgcolor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: 2,
                    p: 1.5,
                    fontSize: 12,
                    minWidth: 160
                  }}>
                    <Typography variant="subtitle2" fontWeight={600} mb={0.5}>
                      {label} {/* #1, #2... */}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      ModuleId: <Typography component="span" fontWeight={500}>{point.moduleId ?? '—'}</Typography>
                      {', '}LessonId: <Typography component="span" fontWeight={500}>{point.lessonId ?? '—'}</Typography>
                      {', '}Position: <Typography component="span" fontWeight={500}>{point.position ?? '—'}</Typography>
                    </Typography>
                    <Divider sx={{ my: 0.5, borderColor: '#374151' }} />
                    {payload.map((entry, idx) => (
                      <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: entry.color }} />
                          <Typography variant="body2" color="text.secondary">{entry.name}:</Typography>
                        </Box>
                        <Typography variant="body2" fontWeight={500}>{entry.value}</Typography>
                      </Box>
                    ))}
                  </Box>
                );
              }}
              contentStyle={{ display: 'none' }} // скрываем стандартный стиль
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
                activeDot={{ r: 5 }}
                //activeDot = {false}
              />
            ))}
            
            <Brush height={25} stroke="#6366F1" travellerWidth={8} dataKey="step" />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
}