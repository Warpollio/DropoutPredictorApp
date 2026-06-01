import { Box, TextField, Button, Typography, InputAdornment } from '@mui/material'
import { useState } from 'react'

export default function ComputeForm({ onCompute, loading }) {
  const [userId, setUserId] = useState('')
  // Формат для input type="date": YYYY-MM-DD
  const [cutoffDate, setCutoffDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })

  const handleSubmit = () => {
    // Преобразуем дату в полный ISO-строку с временем 23:59:59
    const cutoff = cutoffDate ? `${cutoffDate}T23:59:59` : new Date().toISOString()
    
    const params = {
      cutoff_date: cutoff,
      user_id: userId ? parseInt(userId, 10) : undefined
    }
    onCompute(params)
  }

  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      
      {/* User ID input — используем MUI TextField корректно */}
      <TextField
        label="User ID (опционально)"
        type="number"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        sx={{ minWidth: 150 }}
        InputProps={{
          startAdornment: <InputAdornment position="start">#</InputAdornment>,
        }}
        size="small"
        variant="outlined"
      />

      {/* Native date input в вашем стиле */}
      <Box>
        <Typography variant="caption" display="block" sx={{ mb: 0.5, color: 'text.secondary' }}>
          Дата отсечения (cutoff)
        </Typography>
        <input
          type="date"
          value={cutoffDate}
          onChange={(e) => setCutoffDate(e.target.value)}
          style={{ 
            background: '#374151', 
            border: '1px solid #4B5563', 
            borderRadius: 4, 
            padding: '8px 10px', 
            color: '#fff', 
            fontSize: '0.875rem',
            cursor: 'pointer',
            outline: 'none'
          }}
        />
      </Box>

      {/* Кнопка вычисления */}
      <Button
        variant="contained"
        onClick={handleSubmit}
        disabled={loading}
        sx={{ height: 40 }}
      >
        {loading ? 'Вычисление...' : '🚀 Вычислить фичи'}
      </Button>

    </Box>
  )
}