'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Paper,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
} from '@mui/material';
import {
  CalendarMonth,
  ViewList,
  DirectionsCar,
  Person,
  Edit,
  Delete,
  Add,
  NavigateBefore,
  NavigateNext,
  Today,
} from '@mui/icons-material';
import { 
  format, 
  parseISO, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval,
  isSameDay,
  isToday,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase/client';
import { ShiftWithDetails } from '@/lib/supabase/database.types';
import { enqueueSnackbar } from 'notistack';
import { useRouter } from 'next/navigation';

function AdminShiftsContent() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [allShifts, setAllShifts] = useState<ShiftWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShift, setSelectedShift] = useState<ShiftWithDetails | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const locale = i18n.language === 'de' ? de : enUS;

  useEffect(() => {
    fetchShifts();
  }, [currentWeek]);

  const fetchShifts = async () => {
    try {
      setLoading(true);
      
      // Fetch shifts for the current month
      const startDate = viewMode === 'calendar' 
        ? startOfWeek(currentWeek, { locale })
        : startOfMonth(currentWeek);
      const endDate = viewMode === 'calendar'
        ? endOfWeek(currentWeek, { locale })
        : endOfMonth(currentWeek);
      
      const { data: shiftsData, error } = await supabase
        .from('shifts')
        .select(`
          *,
          taxi:taxis(*),
          driver:profiles(*)
        `)
        .gte('start_time', startDate.toISOString())
        .lte('end_time', endDate.toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;

      setAllShifts(shiftsData || []);
    } catch (error) {
      console.error('Error fetching shifts:', error);
      enqueueSnackbar(t('errors.generic'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteShift = async () => {
    if (!selectedShift) return;

    try {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', selectedShift.id);

      if (error) throw error;

      enqueueSnackbar(t('shifts.deleteSuccess'), { variant: 'success' });
      setDeleteDialogOpen(false);
      setSelectedShift(null);
      fetchShifts();
    } catch (error) {
      console.error('Error deleting shift:', error);
      enqueueSnackbar(t('errors.generic'), { variant: 'error' });
    }
  };

  const renderListView = () => {
    return (
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('common.date')}</TableCell>
              <TableCell>{t('common.time')}</TableCell>
              <TableCell>{t('shifts.driver')}</TableCell>
              <TableCell>{t('shifts.taxi')}</TableCell>
              <TableCell align="right">{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {allShifts.map((shift) => (
              <TableRow key={shift.id}>
                <TableCell>
                  {format(parseISO(shift.start_time), 'EEE, dd.MM.yyyy', { locale })}
                </TableCell>
                <TableCell>
                  {format(parseISO(shift.start_time), 'HH:mm')} - 
                  {format(parseISO(shift.end_time), 'HH:mm')}
                </TableCell>
                <TableCell>
                  {shift.driver?.first_name} {shift.driver?.last_name}
                </TableCell>
                <TableCell>
                  <Chip label={shift.taxi?.license_plate} size="small" />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={t('common.delete')}>
                    <IconButton 
                      size="small"
                      color="error"
                      onClick={() => {
                        setSelectedShift(shift);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Delete />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {allShifts.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">
              {t('shifts.noShifts')}
            </Typography>
          </Box>
        )}
      </TableContainer>
    );
  };

  const renderCalendarView = () => {
    const startDate = startOfWeek(currentWeek, { locale });
    const endDate = endOfWeek(currentWeek, { locale });
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const getShiftsForDay = (date: Date) => {
      return allShifts.filter(shift => 
        isSameDay(parseISO(shift.start_time), date)
      );
    };

    return (
      <Box>
        {/* Calendar Navigation */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">
            {format(currentWeek, 'MMMM yyyy', { locale })}
          </Typography>
          <Box>
            <IconButton onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
              <NavigateBefore />
            </IconButton>
            <Button onClick={() => setCurrentWeek(new Date())}>
              <Today sx={{ mr: 1 }} />
              {t('common.today')}
            </Button>
            <IconButton onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
              <NavigateNext />
            </IconButton>
          </Box>
        </Box>
        
        {/* Calendar Grid */}
        <Grid container spacing={1}>
          {/* Day headers */}
          <Grid item xs={12}>
            <Grid container>
              {days.map((day) => (
                <Grid item xs key={`header-${day.toISOString()}`} sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" align="center" sx={{ fontWeight: 'bold' }}>
                    {format(day, 'EEE', { locale })}
                  </Typography>
                  <Typography variant="caption" align="center" display="block">
                    {format(day, 'dd.MM', { locale })}
                  </Typography>
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* Calendar cells */}
          {days.map((day) => {
            const dayShifts = getShiftsForDay(day);
            const isCurrentDay = isToday(day);
            
            return (
              <Grid item xs key={day.toISOString()} sx={{ flex: 1 }}>
                <Paper 
                  sx={{ 
                    p: 1,
                    minHeight: 150,
                    backgroundColor: isCurrentDay ? 'primary.light' : 'background.paper',
                    opacity: isCurrentDay ? 0.95 : 1,
                    border: isCurrentDay ? '2px solid' : '1px solid',
                    borderColor: isCurrentDay ? 'primary.main' : 'divider',
                  }}
                >
                  {dayShifts.map((shift) => (
                    <Card 
                      key={shift.id} 
                      sx={{ 
                        mb: 0.5, 
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                        <Typography variant="caption" display="block" noWrap>
                          <DirectionsCar sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
                          {shift.taxi?.license_plate}
                        </Typography>
                        <Typography variant="caption" display="block" noWrap>
                          <Person sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
                          {shift.driver?.first_name} {shift.driver?.last_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {format(parseISO(shift.start_time), 'HH:mm')}-{format(parseISO(shift.end_time), 'HH:mm')}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {dayShifts.length === 0 && (
                    <Typography 
                      variant="caption" 
                      color="text.secondary" 
                      sx={{ display: 'block', textAlign: 'center', mt: 5 }}
                    >
                      -
                    </Typography>
                  )}
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      </Box>
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {t('shifts.allShifts')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, v) => {
              if (v) {
                setViewMode(v);
                fetchShifts();
              }
            }}
            size="small"
          >
            <ToggleButton value="list">
              <ViewList sx={{ mr: 1 }} />
              {t('shifts.listView')}
            </ToggleButton>
            <ToggleButton value="calendar">
              <CalendarMonth sx={{ mr: 1 }} />
              {t('shifts.calendarView')}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {viewMode === 'list' ? renderListView() : renderCalendarView()}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('shifts.deleteShift')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('shifts.confirmDelete')}
          </Typography>
          {selectedShift && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>{t('shifts.driver')}:</strong> {selectedShift.driver?.first_name} {selectedShift.driver?.last_name}
              </Typography>
              <Typography variant="body2">
                <strong>{t('shifts.taxi')}:</strong> {selectedShift.taxi?.license_plate}
              </Typography>
              <Typography variant="body2">
                <strong>{t('common.date')}:</strong> {format(parseISO(selectedShift.start_time), 'dd.MM.yyyy')}
              </Typography>
              <Typography variant="body2">
                <strong>{t('common.time')}:</strong> {format(parseISO(selectedShift.start_time), 'HH:mm')} - {format(parseISO(selectedShift.end_time), 'HH:mm')}
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleDeleteShift} color="error" variant="contained">
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function AdminShiftsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <DashboardLayout>
        <AdminShiftsContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}