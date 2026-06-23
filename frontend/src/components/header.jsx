import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material'
import { Link, useLocation } from 'react-router-dom'
import { School, Upload, FilterList, Dashboard, TableChart} from '@mui/icons-material'

function Header() {
  const location = useLocation()

  const navItems = [
    { path: '/', label: 'Загрузка', icon: <Upload /> },
    { path: '/features', label: 'Критерии', icon: <FilterList /> },
    { path: '/dashboard', label: 'Дашборд', icon: <Dashboard /> },
    { path: '/classification', label: 'Классификация', icon: <TableChart /> },
  ]

  return (
    <AppBar position="static">
      <Toolbar>
        <School sx={{ mr: 2 }} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Dropout Predictor
        </Typography>
        <Box>
          {navItems.map((item) => (
            <Button
              key={item.path}
              component={Link}
              to={item.path}
              color="inherit"
              startIcon={item.icon}
              variant={location.pathname === item.path ? 'contained' : 'text'}
              sx={{ ml: 1 }}
            >
              {item.label}
            </Button>
          ))}
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default Header