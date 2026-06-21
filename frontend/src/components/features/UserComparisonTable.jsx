import { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Chip, IconButton,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  TablePagination, TableSortLabel, Paper, Card, CardContent,
  CircularProgress, Tooltip, Divider, useTheme, alpha
} from '@mui/material';
import { 
  Person, WarningAmber, Add, Remove, CompareArrows, Refresh
} from '@mui/icons-material';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const METRIC_COLUMNS = [
  { id: 'steps_completed', label: 'Шагов', numeric: true, sortable: true, higherIsBetter: true },
  { id: 'first_try_success_rate', label: 'Успех с 1-й (%)', numeric: true, sortable: true, percent: true, higherIsBetter: true },
  { id: 'avg_attempts_per_step', label: 'Сред. попыток', numeric: true, sortable: true, higherIsBetter: false },
  { id: 'avg_errors_before_success', label: 'Ошибок до успеха', numeric: true, sortable: true, higherIsBetter: false },
  { id: 'pct_steps_with_post_success', label: '"Решение после успеха" (%)', numeric: true, sortable: true, percent: true, higherIsBetter: false },
  { id: 'std_attempts_per_step', label: 'Стабильность', numeric: true, sortable: true, higherIsBetter: true }
];

const COMP_METRICS = [
  { key: 'first_try_success_rate', label: 'Успех с 1-й попытки', percent: true, higherIsBetter: true },
  { key: 'avg_attempts_per_step', label: 'Среднее число попыток', percent: false, higherIsBetter: false },
  { key: 'std_attempts_per_step', label: 'Стабильность (std)', percent: false, higherIsBetter: true },
  { key: 'pct_steps_with_post_success', label: '% "решения после успеха"', percent: true, higherIsBetter: false },
  { key: 'avg_errors_before_success', label: 'Ошибок до успеха', percent: false, higherIsBetter: false },
  { key: 'steps_completed', label: 'Пройдено шагов', percent: false, higherIsBetter: true }
];


export default function UserComparisonTable({ courseId = null, cfId = null, refreshTrigger = 0 }) {
  const theme = useTheme();
  
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [tableError, setTableError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [sortConfig, setSortConfig] = useState({ field: 'calculated_at', direction: 'desc' });

  const [comparedUsers, setComparedUsers] = useState([]);
  const [compareInput, setCompareInput] = useState('');
  const [globalError, setGlobalError] = useState(null);


  const buildQueryParams = () => {
    const params = new URLSearchParams({
      page: page + 1,
      per_page: rowsPerPage,
      sort_by: sortConfig.field,
      order: sortConfig.direction,
    });
    
    // cfId > courseId > последняя сессия
    if (cfId) {
      params.append('cf_id', cfId);
    } else if (courseId) {
      params.append('course_id', courseId);
    }
    
    return params.toString();
  };

  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      setTableError(null);
      try {
        const queryParams = buildQueryParams();
        const res = await fetch(`${API_URL}/api/features/list?${queryParams}`);
        if (!res.ok) throw new Error('Ошибка загрузки');
        const data = await res.json();
        setUsers(data.data);
        setTotalUsers(data.total);
      } catch (err) {
        setTableError(err.message);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [page, rowsPerPage, sortConfig, courseId, cfId, refreshTrigger]);

  const handleSort = (field) => {
    const isAsc = sortConfig.field === field && sortConfig.direction === 'asc';
    setSortConfig({ field, direction: isAsc ? 'desc' : 'asc' });
  };

  const fmt = (val, percent) => {
    if (val === null || val === undefined) return '—';
    if (percent) return `${(val * 100).toFixed(1)}%`;
    return typeof val === 'number' ? val.toFixed(2) : val;
  };


  const getCellSx = (values, val, higherIsBetter) => {
    const nums = values.filter(v => typeof v === 'number' && !isNaN(v));
    if (nums.length < 2 || val === null) return { color: 'text.secondary' };
    const best = higherIsBetter ? Math.max(...nums) : Math.min(...nums);
    const worst = higherIsBetter ? Math.min(...nums) : Math.max(...nums);
    if (val === best) return { color: 'success.main', fontWeight: 600 };
    if (val === worst) return { color: 'error.main', fontWeight: 500 };
    return {};
  };

  const toggleCompare = async (user) => {
    const exists = comparedUsers.some(u => u.id === user.user_id);
    if (exists) {
      setComparedUsers(prev => prev.filter(u => u.id !== user.user_id));
      return;
    }
    const metrics = {
      first_try_success_rate: user.first_try_success_rate,
      avg_attempts_per_step: user.avg_attempts_per_step,
      std_attempts_per_step: user.std_attempts_per_step,
      pct_steps_with_post_success: user.pct_steps_with_post_success,
      avg_errors_before_success: user.avg_errors_before_success,
      steps_completed: user.steps_completed
    };
    setComparedUsers(prev => [...prev, { id: user.user_id, loading: false, error: null, metrics }]);
  };

  const handleManualAdd = async () => {
    const uid = parseInt(compareInput, 10);
    if (!uid || comparedUsers.some(u => u.id === uid)) {
      setGlobalError('Введите корректный ID или пользователь уже добавлен');
      return;
    }
    setComparedUsers(prev => [...prev, { id: uid, loading: true, error: null, metrics: null }]);
    try {
      const res = await fetch(`${API_URL}/api/features/${uid}`);
      if (!res.ok) throw new Error('Не найдено');
      const data = await res.json();
      setComparedUsers(prev => prev.map(u => u.id === uid ? { ...u, loading: false, metrics: data.metrics } : u));
      setCompareInput('');
    } catch (err) {
      setComparedUsers(prev => prev.map(u => u.id === uid ? { ...u, loading: false, error: err.message } : u));
    }
  };

  const handleChangePage = (_, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); };

  const loadedForComp = comparedUsers.filter(u => u.metrics);
  const isComparisonReady = loadedForComp.length >= 2;

  // отображение активного фильтра
  const filterLabel = cfId 
    ? `Сессия #${cfId}` 
    : courseId 
      ? `Курс #${courseId} (последняя)` 
      : 'Последняя сессия';


  const tableStyles = {
    container: { 
      bgcolor: 'background.paper', 
      border: '1px solid',
      borderColor: 'divider',
      color: 'text.primary'
    },
    head: { 
      bgcolor: 'background.default', 
      color: 'text.primary', 
      fontWeight: 600 
    },
    cell: { 
      color: 'text.primary', 
      borderColor: 'divider' 
    },
    sortable: { 
      cursor: 'pointer', 
      '&:hover': { bgcolor: 'action.hover' } 
    }
  };

  return (
    <Box>
      {/* Таблица всех пользователей*/}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Person color="primary" />
            <Typography variant="h6" color="text.primary">Пользователи</Typography>
            <Chip 
              label={totalUsers} 
              size="small" 
              variant="outlined" 
              sx={{ 
                color: 'text.secondary', 
                borderColor: 'divider' 
              }} 
            />
            
            {/*активный фильтр */}
            <Chip 
              label={filterLabel} 
              size="small" 
              variant="filled" 
              color="info"
              sx={{ fontSize: '0.75rem', height: 24, ml: 1 }}
            />
          </Box>
          
          <Tooltip title="Обновить">
            <IconButton 
              size="small" 
              onClick={() => setPage(page)} 
              disabled={loadingUsers} 
              sx={{ color: 'text.secondary' }}
            >
              <Refresh fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {tableError && (
          <Typography variant="caption" color="error" sx={{ mb: 2, display: 'block' }}>
            ⚠️ {tableError}
          </Typography>
        )}

        <TableContainer component={Paper} sx={{ ...tableStyles.container, mb: 1 }}>
          <Table size="small">
            <TableHead sx={tableStyles.head}>
              <TableRow>
                <TableCell sx={{ ...tableStyles.cell, minWidth: 160 }}>Пользователь</TableCell>
                {METRIC_COLUMNS.map(col => (
                  <TableCell 
                    key={col.id} 
                    align={col.numeric ? 'right' : 'left'} 
                    sx={{ 
                      ...tableStyles.cell, 
                      ...(col.sortable ? tableStyles.sortable : {}) 
                    }} 
                    onClick={() => col.sortable && handleSort(col.id)}
                  >
                    {col.sortable ? (
                      <TableSortLabel 
                        active={sortConfig.field === col.id} 
                        direction={sortConfig.field === col.id ? sortConfig.direction : 'asc'} 
                        sx={{ 
                          color: 'text.primary', 
                          '& .MuiTableSortLabel-icon': { 
                            color: 'text.secondary !important' 
                          } 
                        }}
                      >
                        {col.label}
                      </TableSortLabel>
                    ) : col.label}
                  </TableCell>
                ))}
                <TableCell align="right" sx={tableStyles.cell}>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loadingUsers ? (
                <TableRow>
                  <TableCell colSpan={METRIC_COLUMNS.length + 2} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} color="primary" />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={METRIC_COLUMNS.length + 2} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Нет данных. {cfId || courseId ? 'Попробуйте выбрать другую сессию' : 'Сначала выполните вычисление признаков.'}
                  </TableCell>
                </TableRow>
              ) : (
                users.map(user => {
                  const isSelected = comparedUsers.some(u => u.id === user.user_id);
                  return (
                    <TableRow 
                      key={user.user_id} 
                      hover 
                      sx={{ 
                        bgcolor: isSelected ? alpha(theme.palette.success.main, 0.1) : 'transparent',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <TableCell align="left" sx={{ ...tableStyles.cell, verticalAlign: 'top', minWidth: 160 }}>
                        <Typography variant="body2" sx={{ lineHeight: 1.3, fontWeight: 500, color: 'text.primary' }}>
                          {user.last_name || '—'}
                        </Typography>
                        <Typography variant="body2" sx={{ lineHeight: 1.3, color: 'text.secondary' }}>
                          {user.first_name || '—'}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                          ID: {user.user_id}
                        </Typography>
                      </TableCell>
                      {METRIC_COLUMNS.map(col => (
                        <TableCell key={col.id} align={col.numeric ? 'right' : 'left'} sx={tableStyles.cell}>
                          {fmt(user[col.id], col.percent)}
                        </TableCell>
                      ))}
                      <TableCell align="right" sx={tableStyles.cell}>
                        <Button 
                          size="small" 
                          variant={isSelected ? 'contained' : 'outlined'} 
                          startIcon={isSelected ? <Remove fontSize="small" /> : <Add fontSize="small" />} 
                          onClick={() => toggleCompare(user)} 
                          sx={{ 
                            color: isSelected ? 'common.white' : 'success.main', 
                            borderColor: 'success.main', 
                            minWidth: 'auto', 
                            px: 1,
                            '&:hover': {
                              borderColor: 'success.dark',
                              bgcolor: isSelected ? 'success.dark' : alpha(theme.palette.success.main, 0.08)
                            }
                          }}
                        >
                          {isSelected ? 'Убрать' : 'В сравнение'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div" 
          count={totalUsers} 
          page={page} 
          rowsPerPage={rowsPerPage}
          onPageChange={handleChangePage} 
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 20, 50]} 
          labelRowsPerPage="На странице:"
          sx={{ 
            color: 'text.secondary', 
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { 
              color: 'text.primary' 
            },
            '& .MuiTablePagination-select': {
              color: 'text.primary'
            }
          }}
        />
      </Box>

      <Divider sx={{ my: 3 }} />

      {/*Блок сравнения*/}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CompareArrows color="primary" />
          <Typography variant="h6" color="text.primary">Сравнение ({loadedForComp.length})</Typography>
          {(cfId || courseId) && (
            <Chip 
              label={filterLabel} 
              size="small" 
              variant="outlined" 
              color="info" 
              sx={{ fontSize: '0.7rem' }} 
            />
          )}
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <TextField 
            label="Добавить по ID" 
            type="number" 
            value={compareInput} 
            onChange={e => setCompareInput(e.target.value)} 
            fullWidth 
            size="small" 
            onKeyPress={e => e.key === 'Enter' && handleManualAdd()}
            sx={{
              '& .MuiInputBase-input': { color: 'text.primary' },
              '& .MuiInputLabel-root': { color: 'text.secondary' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'text.secondary' }
            }}
          />
          <Button 
            variant="contained" 
            startIcon={<Add />} 
            onClick={handleManualAdd} 
            sx={{ height: 40 }}
          >
            Добавить
          </Button>
        </Box>
        
        {globalError && (
          <Typography variant="caption" color="error" sx={{ display: 'block', mb: 2 }}>
            ⚠️ {globalError}
          </Typography>
        )}

        {comparedUsers.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
            {comparedUsers.map(u => (
              <Chip 
                key={u.id} 
                label={u.loading ? `#${u.id}...` : `#${u.id}`} 
                onDelete={() => !u.loading && setComparedUsers(prev => prev.filter(x => x.id !== u.id))} 
                color={u.error ? 'error' : 'primary'} 
                variant={u.error ? 'filled' : 'outlined'} 
                disabled={u.loading}
                sx={{
                  '& .MuiChip-deleteIcon': {
                    color: u.error ? 'error.light' : 'inherit',
                    '&:hover': { color: u.error ? 'error.main' : 'inherit' }
                  }
                }}
              />
            ))}
          </Box>
        )}

        {isComparisonReady && (
          <>
            <TableContainer component={Paper} sx={{ ...tableStyles.container, mb: 2 }}>
              <Table size="small">
                <TableHead sx={tableStyles.head}>
                  <TableRow>
                    <TableCell sx={tableStyles.cell}><b>Метрика</b></TableCell>
                    {loadedForComp.map(u => (
                      <TableCell key={u.id} sx={{ ...tableStyles.cell, textAlign: 'center' }}>
                        <b>User #{u.id}</b>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {COMP_METRICS.map(m => {
                    const vals = loadedForComp.map(u => u.metrics?.[m.key]);
                    return (
                      <TableRow key={m.key}>
                        <TableCell sx={tableStyles.cell}>{m.label}</TableCell>
                        {loadedForComp.map(u => (
                          <TableCell 
                            key={u.id} 
                            sx={{ 
                              ...tableStyles.cell, 
                              textAlign: 'center', 
                              ...getCellSx(vals, u.metrics?.[m.key], m.higherIsBetter) 
                            }}
                          >
                            {fmt(u.metrics?.[m.key], m.percent)}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            {/* 
            <Card sx={{ ...tableStyles.container, p: 2 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <WarningAmber color="warning" fontSize="small" sx={{ mt: 0.2 }} />
                <Typography variant="body2" color="text.secondary">
                  <b style={{ color: theme.palette.success.main }}>Зелёный</b> — лучшее,{' '}
                  <b style={{ color: theme.palette.error.main }}>красный</b> — худшее значение в строке.
                </Typography>
              </Box>
            </Card>
            */}
          </>
        )}
      </Box>
    </Box>
  );
}