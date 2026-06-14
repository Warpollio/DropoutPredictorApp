import { Container, Box, Divider } from '@mui/material';
import { useState, useCallback } from 'react';
import CourseStatsPanel from '../components/CourseStatsPanel';
import CSVUploader from '../components/CSVUploader';

export default function UploadPage() {

  const [statsKey, setStatsKey] = useState(0);

  const handleUploadSuccess = useCallback(() => {
    setStatsKey(prev => prev + 1);
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>

      <CourseStatsPanel key={statsKey} />

      <Divider sx={{ my: 3 }} />

      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <CSVUploader 
          onUploadSuccess={handleUploadSuccess}
          sx={{ width: '100%', maxWidth: 600 }}
        />
      </Box>
    </Container>
  );
}