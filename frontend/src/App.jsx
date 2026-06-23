import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import Header from './components/header';
import UploadPage from './pages/UploadPage'; 
import FeaturePage from './pages/FeaturePage';
import DashboardPage from './pages/DashboardPage';
import { createTheme } from '@mui/material/styles'
import ClassificationPage from './pages/ClassificationPage';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#3B82F6' },
    secondary: { main: '#8B5CF6' },
    background: { 
      default: '#171717',
    },
  },
})

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Header />
        <Routes>
          <Route path="/" element={<UploadPage />} /> 
          <Route path="/features" element={<FeaturePage />} />
          <Route path="/dashboard/:courseId?" element={<DashboardPage />} />
          <Route path="/classification" element={<ClassificationPage />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;