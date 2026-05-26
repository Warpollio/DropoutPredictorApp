// src/pages/DashboardPage.jsx
import { useParams } from 'react-router-dom';
import CourseDashboard from '../components/dashboard/CourseDashboard';

export default function DashboardPage() {
  const { courseId } = useParams();
  
  // Передаём courseId как есть (строка) или null
  return <CourseDashboard courseId={courseId ? parseInt(courseId) : null} />;
}