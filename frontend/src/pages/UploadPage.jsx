import { Container, Box, Divider, Typography, Grid } from '@mui/material';
import { useState, useCallback } from 'react';
import CourseStatsPanel from '../components/CourseStatsPanel';
import CSVUploader from '../components/CSVUploader';

import InactiveUsersCleanup from '../components/import/InactiveUsersCleanup';
import TeachersCleanup from '../components/import/TeachersCleanup';

export default function UploadPage() {

  const [statsKey, setStatsKey] = useState(0);
  const [selectedCourse, setSelectedCourse] = useState(null); 

  const handleUploadSuccess = useCallback(() => {
    setStatsKey(prev => prev + 1);
  }, []);

  const handleCourseChange = useCallback((courseId) => {
    setSelectedCourse(courseId);
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>

      <CourseStatsPanel key={statsKey}
        selectedCourse={selectedCourse}
        onCourseChange={handleCourseChange} />

      <Divider sx={{ my: 3 }} />

      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <CSVUploader 
          onUploadSuccess={handleUploadSuccess}
          sx={{ width: '100%', maxWidth: 600 }}
        />
      </Box>

      <Divider sx={{ my: 3 }} />
      
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 2,
        justifyContent: 'center',
        alignItems: 'center' 
      }}>

          <InactiveUsersCleanup courseId={selectedCourse}/>

          <TeachersCleanup courseId={selectedCourse}/>
      </Box>

    </Container>
  );
}