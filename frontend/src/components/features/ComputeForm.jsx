// src/components/features/ComputeForm.jsx
import { Box, TextField, Button, Typography, InputAdornment } from '@mui/material'
import { useState } from 'react'

export default function ComputeForm({ onCompute, loading }) {
  const [userId, setUserId] = useState('')
  const [cutoffDate, setCutoffDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })

  const handleSubmit = () => {
    const cutoff = cutoffDate ? `${cutoffDate}T23:59:59` : new Date().toISOString()
    onCompute({
      cutoff_date: cutoff,
      user_id: userId ? parseInt(userId, 10) : undefined
    })
  }

  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <TextField
        label="User ID (опционально)"
        type="number"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        sx={{ minWidth: 150 }}
        InputProps={{ startAdornment: <InputAdornment position="start">#</InputAdornment> }}
        size="small"
        variant="outlined"
      />
      <Box>
        <Typography variant="caption" display="block" sx={{ mb: 0.5, color: 'text.secondary' }}>
          Дата отсечения
        </Typography>
        <input
          type="date"
          value={cutoffDate}
          onChange={(e) => setCutoffDate(e.target.value)}
          style={{ 
            background: '#374151', border: '1px solid #4B5563', borderRadius: 4, 
            padding: '8px 10px', color: '#fff', fontSize: '0.875rem', cursor: 'pointer'
          }}
        />
      </Box>
      <Button variant="contained" onClick={handleSubmit} disabled={loading} sx={{ height: 40 }}>
        {loading ? '⏳ Запуск...' : '🚀 Вычислить'}
      </Button>
    </Box>
  )
}