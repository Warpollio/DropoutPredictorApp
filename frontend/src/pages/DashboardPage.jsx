import { Container, Typography, Paper, Grid, Card, CardContent, Box } from '@mui/material'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { School, TrendingUp, Warning, CheckCircle } from '@mui/icons-material'

// Пример данных (в реальности получать с бэкенда)
const studentsData = [
  { name: 'Янв', active: 120, dropped: 15 },
  { name: 'Фев', active: 132, dropped: 18 },
  { name: 'Мар', active: 101, dropped: 25 },
  { name: 'Апр', active: 134, dropped: 20 },
  { name: 'Май', active: 190, dropped: 30 },
]

const coursesData = [
  { name: 'Математика', value: 400 },
  { name: 'Физика', value: 300 },
  { name: 'Программирование', value: 300 },
  { name: 'Другие', value: 200 },
]

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

function DashboardPage() {
  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <School sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Всего студентов
                  </Typography>
                  <Typography variant="h4">1,234</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CheckCircle sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Активных
                  </Typography>
                  <Typography variant="h4">987</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Warning sx={{ fontSize: 40, color: 'warning.main', mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    В группе риска
                  </Typography>
                  <Typography variant="h4">156</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingUp sx={{ fontSize: 40, color: 'error.main', mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Отчислено
                  </Typography>
                  <Typography variant="h4">91</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Динамика студентов
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={studentsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="active" stroke="#1976d2" name="Активные" />
                <Line type="monotone" dataKey="dropped" stroke="#f44336" name="Отчисленные" />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Распределение по курсам
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={coursesData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {coursesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Успеваемость по модулям
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={studentsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="active" fill="#1976d2" name="Успешные" />
                <Bar dataKey="dropped" fill="#f44336" name="Неуспешные" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  )
}

export default DashboardPage