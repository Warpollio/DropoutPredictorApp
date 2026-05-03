import { Container, Box, Divider } from '@mui/material';
import { useState, useCallback } from 'react';
import CourseStatsPanel from '../components/CourseStatsPanel';
import CSVUploader from '../components/CSVUploader';

export default function UploadPage() {
  // Ключ для принудительного ре-рендера CourseStatsPanel после импорта
  const [statsKey, setStatsKey] = useState(0);

  // Коллбэк: вызывается CSVUploader после успешной загрузки
  const handleUploadSuccess = useCallback(() => {
    // Увеличиваем ключ → CourseStatsPanel перемонтируется и перезагрузит данные
    setStatsKey(prev => prev + 1);
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Статистика курсов — с ключом для обновления */}
      <CourseStatsPanel key={statsKey} />

      <Divider sx={{ my: 3 }} />

      {/* Загрузчик CSV — ниже, с отступом */}
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <CSVUploader 
          onUploadSuccess={handleUploadSuccess}
          sx={{ width: '100%', maxWidth: 600 }}
        />
      </Box>
    </Container>
  );
}