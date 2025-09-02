'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tooltip,
  Tabs,
  Tab,
  CircularProgress,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import {
  Edit,
  Delete,
  DirectionsCar,
  Schedule,
  AddCircle,
  EventNote,
  AccessTime,
  CalendarMonth,
} from '@mui/icons-material';
import { format, parseISO, isFuture, isPast, isToday, differenceInHours, startOfWeek, endOfWeek } from 'date-fns';
import { enqueueSnackbar } from 'notistack';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase/client';
import { ShiftWithDetails } from '@/lib/supabase/database.types';
import { useAuth } from '@/contexts/AuthContext';

function DriverShiftsContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const [shifts, setShifts] = useState<ShiftWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentShift, setCurrentShift] = useState<ShiftWithDetails | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [stats, setStats] = useState({
    totalShifts: 0,
    upcomingShifts: 0,
    hoursThisWeek: 0,
    hoursThisMonth: 0,
  });

  useEffect(() => {
    if (user) {
      fetchShifts();
    }
  }, [user]);

  const fetchShifts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('shifts')
        .select(`
          *,
          taxi:taxis(*)
        `)
        .eq('driver_id', user.id)
        .order('start_time', { ascending: false });

      if (error) throw error;

      const allShifts = data || [];
      setShifts(allShifts);

      // Calculate statistics
      const now = new Date();
      const weekStart = startOfWeek(now);
      const weekEnd = endOfWeek(now);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const upcomingShifts = allShifts.filter(shift => isFuture(parseISO(shift.start_time)));
      
      const weekShifts = allShifts.filter(shift => {
        const start = parseISO(shift.start_time);
        return start >= weekStart && start <= weekEnd;
      });

      const monthShifts = allShifts.filter(shift => {
        const start = parseISO(shift.start_time);
        return start >= monthStart && start <= monthEnd;
      });

      const hoursThisWeek = weekShifts.reduce((total, shift) => {
        return total + differenceInHours(parseISO(shift.end_time), parseISO(shift.start_time));
      }, 0);

      const hoursThisMonth = monthShifts.reduce((total, shift) => {
        return total + differenceInHours(parseISO(shift.end_time), parseISO(shift.start_time));
      }, 0);

      setStats({
        totalShifts: allShifts.length,
        upcomingShifts: upcomingShifts.length,
        hoursThisWeek,
        hoursThisMonth,
      });
    } catch (error) {
      console.error('Error fetching shifts:', error);
      enqueueSnackbar(t('errors.generic'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteShift = async () => {
    if (!currentShift) return;

    try {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', currentShift.id);

      if (error) throw error;

      enqueueSnackbar(t('shifts.deleteSuccess'), { variant: 'success' });
      setDeleteDialogOpen(false);
      setCurrentShift(null);
      fetchShifts();
    } catch (error: any) {
      console.error('Error deleting shift:', error);
      enqueueSnackbar(error.message || t('errors.generic'), { variant: 'error' });
    }
  };

  const getShiftStatus = (shift: ShiftWithDetails) => {
    const start = parseISO(shift.start_time);
    const end = parseISO(shift.end_time);
    const now = new Date();

    if (now >= start && now <= end) return 'ongoing';
    if (isFuture(start)) return 'upcoming';
    return 'completed';
  };

  const upcomingShifts = shifts.filter(shift => isFuture(parseISO(shift.start_time)));
  const pastShifts = shifts.filter(shift => isPast(parseISO(shift.end_time)));
  const todaysShifts = shifts.filter(shift => isToday(parseISO(shift.start_time)));

  const displayedShifts = tabValue === 0 ? upcomingShifts : pastShifts;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {t('navigation.myShifts')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddCircle />}
          onClick={() => router.push('/driver/book-shift')}
        >
          {t('shifts.bookShift')}
        </Button>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <EventNote color="primary" />
                <Typography color="text.secondary" variant="subtitle2">
                  Total Shifts
                </Typography>
              </Box>
              <Typography variant="h4">{stats.totalShifts}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Schedule color="secondary" />
                <Typography color="text.secondary" variant="subtitle2">
                  Upcoming
                </Typography>
              </Box>
              <Typography variant="h4">{stats.upcomingShifts}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <AccessTime color="success" />
                <Typography color="text.secondary" variant="subtitle2">
                  Hours This Week
                </Typography>
              </Box>
              <Typography variant="h4">{stats.hoursThisWeek}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CalendarMonth color="warning" />
                <Typography color="text.secondary" variant="subtitle2">
                  Hours This Month
                </Typography>
              </Box>
              <Typography variant="h4">{stats.hoursThisMonth}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Today's Shifts Alert */}
      {todaysShifts.length > 0 && (
        <Alert severity="info" sx={{ mb: 3 }} icon={<Schedule />}>
          <Typography variant="subtitle1">
            Today's Shifts: {todaysShifts.map(shift => (
              <span key={shift.id}>
                {shift.taxi?.license_plate} ({format(parseISO(shift.start_time), 'HH:mm')} - {format(parseISO(shift.end_time), 'HH:mm')})
                {todaysShifts.indexOf(shift) < todaysShifts.length - 1 && ', '}
              </span>
            ))}
          </Typography>
        </Alert>
      )}

      {/* Shifts Table */}
      <Paper>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ px: 2, pt: 2 }}>
          <Tab label={`${t('shifts.upcomingShifts')} (${upcomingShifts.length})`} />
          <Tab label={`${t('shifts.pastShifts')} (${pastShifts.length})`} />
        </Tabs>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('shifts.taxi')}</TableCell>
                <TableCell>{t('common.date')}</TableCell>
                <TableCell>{t('common.startTime')}</TableCell>
                <TableCell>{t('common.endTime')}</TableCell>
                <TableCell>{t('common.duration')}</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : displayedShifts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="text.secondary">
                      {tabValue === 0 ? t('shifts.noShifts') : 'No past shifts'}
                    </Typography>
                    {tabValue === 0 && (
                      <Button
                        variant="outlined"
                        startIcon={<AddCircle />}
                        onClick={() => router.push('/driver/book-shift')}
                        sx={{ mt: 2 }}
                      >
                        {t('shifts.bookShift')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                displayedShifts.map((shift) => {
                  const status = getShiftStatus(shift);
                  const duration = differenceInHours(parseISO(shift.end_time), parseISO(shift.start_time));
                  const canEdit = isFuture(parseISO(shift.start_time));

                  return (
                    <TableRow key={shift.id}>
                      <TableCell>
                        <Chip
                          icon={<DirectionsCar />}
                          label={shift.taxi?.license_plate}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {format(parseISO(shift.start_time), 'EEE, MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {format(parseISO(shift.start_time), 'HH:mm')}
                      </TableCell>
                      <TableCell>
                        {format(parseISO(shift.end_time), 'HH:mm')}
                      </TableCell>
                      <TableCell>
                        {duration} {t('common.hours')}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={status}
                          size="small"
                          color={
                            status === 'ongoing' ? 'success' :
                            status === 'upcoming' ? 'primary' : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell align="right">
                        {canEdit && (
                          <>
                            <Tooltip title={t('common.edit')}>
                              <IconButton
                                size="small"
                                onClick={() => router.push(`/driver/edit-shift/${shift.id}`)}
                              >
                                <Edit />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('common.delete')}>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setCurrentShift(shift);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Delete />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('shifts.deleteShift')}</DialogTitle>
        <DialogContent>
          <Alert severity="warning">
            {t('shifts.confirmDelete')}
          </Alert>
          {currentShift && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Taxi:</strong> {currentShift.taxi?.license_plate}
              </Typography>
              <Typography variant="body2">
                <strong>Date:</strong> {format(parseISO(currentShift.start_time), 'EEEE, MMMM d, yyyy')}
              </Typography>
              <Typography variant="body2">
                <strong>Time:</strong> {format(parseISO(currentShift.start_time), 'HH:mm')} - {format(parseISO(currentShift.end_time), 'HH:mm')}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleDeleteShift} color="error" variant="contained">
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function DriverShiftsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <DriverShiftsContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}