import { useState } from 'react';
import { 
  Box, Paper, Typography, Button, Select, MenuItem, 
  InputLabel, FormControl, Alert, LinearProgress, Chip 
} from '@mui/material';
import { CloudUpload, CheckCircle, ErrorOutlined } from '@mui/icons-material';
import axios from 'axios';

const IMPORT_TYPES = [
  { value: 'structure', label: '📊 Структура (Курсы/Модули/Шаги)' },
  { value: 'step_metrics', label: 'Сложность шагов' },
  { value: 'learners', label: '👥 Пользователи' },
  { value: 'submissions', label: '📝 Попытки (Submissions)' },
  { value: 'comments', label: '💬 Комментарии' },
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function CSVUploader({ onUploadSuccess, sx = {} }) {
  const [file, setFile] = useState(null);
  const [type, setType] = useState('structure');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setResult(null);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      setResult(res.data);

      onUploadSuccess?.(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка соединения с сервером');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, ...sx }}>
      <Typography variant="h6" gutterBottom color="text.primary">
        Загрузка CSV
      </Typography>

      <FormControl fullWidth sx={{ mb: 2 }} size="small">
        <InputLabel id="import-type-label">Тип данных</InputLabel>
        <Select
          labelId="import-type-label"
          value={type}
          label="Тип данных"
          onChange={(e) => setType(e.target.value)}
        >
          {IMPORT_TYPES.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box
        sx={{
          border: '2px dashed',
          borderColor: 'divider',
          borderRadius: 2,
          p: 2.5,
          textAlign: 'center',
          mb: 2,
          bgcolor: file ? 'action.selected' : 'transparent',
        }}
      >
        <input
          accept=".csv"
          style={{ display: 'none' }}
          id="csv-upload"
          type="file"
          onChange={handleFileChange}
        />
        <label htmlFor="csv-upload">
          <Button variant="contained" component="span" startIcon={<CloudUpload />} size="small">
            Выбрать файл
          </Button>
        </label>
        {file && (
          <Typography sx={{ mt: 1.5, fontSize: '0.875rem', color: 'text.secondary' }}>
            <Chip label={file.name} size="small" variant="outlined" sx={{ mr: 1 }} />
            {(file.size / 1024).toFixed(1)} KB
          </Typography>
        )}
      </Box>

      <Button
        variant="contained"
        size="medium"
        fullWidth
        onClick={handleUpload}
        disabled={!file || loading}
        sx={{ mb: 2 }}
      >
        {loading ? 'Обработка...' : 'Начать импорт'}
      </Button>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {result && (
        <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.primary">
            ✅ {result.message}
          </Typography>
          {result.details && (
            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {Object.entries(result.details).map(([k, v]) => (
                <Chip key={k} label={`${k}: ${v}`} size="small" variant="outlined" />
              ))}
            </Box>
          )}
        </Alert>
      )}

      {error && (
        <Alert severity="error" icon={<ErrorOutlined />}>
          {error}
        </Alert>
      )}
    </Paper>
  );
}