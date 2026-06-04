import { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';
import { Paper, Typography, Box } from '@mui/material';

const formatFullDate = (rawDate, interval) => {
  if (!rawDate) return rawDate;
  
  if (interval === 'week') {
    const clean = rawDate.replace('-W', '-'); 
    const [year, week] = clean.split('-');
    return `Неделя ${week}, ${year}`;
  }
  
  // Месяцы
  if (rawDate.length === 7 && rawDate.includes('-')) {
    const [year, month] = rawDate.split('-');
    const date = new Date(year, parseInt(month) - 1);
    return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  }
  
  // Дни
  if (rawDate.length === 10 && rawDate.includes('-')) {
    const [year, month, day] = rawDate.split('-');
    const date = new Date(year, parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  
  return rawDate;
};

//метка для оси X
const formatShortLabel = (rawDate, interval) => {
  if (!rawDate) return rawDate;
  
  if (interval === 'week') {
    const clean = rawDate.replace('-W', '-');
    const [year, week] = clean.split('-');
    return `W${week}`;
  }
  
  if (interval === 'month' && rawDate.length === 7) {
    const [year, month] = rawDate.split('-');
    const date = new Date(year, parseInt(month) - 1);
    return date.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
  }
  
  if (interval === 'day' && rawDate.length === 10) {
    const [, month, day] = rawDate.split('-');
    return `${day}.${month}`;
  }
  
  return rawDate;
};

export default function EnrollmentChart({ data, period, sx = {} }) {
  const interval = period?.interval || 'month';
  
  const chartData = useMemo(() => {
    return (data || []).map(item => ({
      rawDate: item.date,
      label: formatShortLabel(item.date, interval),
      count: item.count
    }));
  }, [data, interval]);


  const maxVisibleTicks = 12;
  const tickInterval = chartData.length > maxVisibleTicks 
    ? Math.ceil(chartData.length / maxVisibleTicks) - 1 
    : 0;

  if (!data?.length) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', minHeight: 250, ...sx }}>
        <Typography color="text.secondary">Нет данных за выбранный период</Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 2, ...sx }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Новые студенты</Typography>
        <Typography variant="caption" color="text.secondary">
          {interval === 'month' && 'По месяцам'}
          {interval === 'week' && 'По неделям'}
          {interval === 'day' && 'По дням'}
        </Typography>
      </Box>
      
      <Box sx={{ width: '100%', height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            
            <XAxis 
              dataKey="label" 
              stroke="#9CA3AF" 
              tick={{ fontSize: 10 }} 
              angle={-45} 
              textAnchor="end" 
              height={50}
              interval={tickInterval}   // динамический интервал
              minTickGap={15}           // не ближе 15px
            />
            
            <YAxis 
              stroke="#9CA3AF" 
              tick={{ fontSize: 10 }} 
              allowDecimals={false}
              width={30}
            />
            
            <Tooltip
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151',
                borderRadius: 8,
                fontSize: 12
              }}
              formatter={(value) => [`${value} студ.`, 'Новые']}
              labelFormatter={(label, payload) => {
                const raw = payload?.[0]?.payload?.rawDate;
                return formatFullDate(raw, interval);
              }}
            />
            
            <Bar 
              dataKey="count" 
              fill="#8B5CF6" 
              radius={[4, 4, 0, 0]}
              name="Новые студенты"
            />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
}