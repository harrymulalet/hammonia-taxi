'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Tooltip,
  InputAdornment,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Avatar,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  DirectionsCar,
  Search,
  CalendarMonth,
  ViewList,
  Person,
  Schedule,
  FilterList,
} from '@mui/icons-material';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO, isToday, isFuture, isPast, startOfWeek, endOfWeek, differenceInHours } from 'date-fns';
import { enqueueSnackbar } from 'notistack';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase/client';
import { ShiftWithDetails, Taxi, Profile } from '@/lib/supabase/database.types';

function AdminShiftsContent() {
  const { t } = useTranslation();
  const [shifts, setShifts] = useState<ShiftWithDetails[]>([]);
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [taxis, setTaxis] = useState<Taxi[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentShift, setCurrentShift] = useState<Partial<ShiftWithDetails> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [filterDate, setFilterDate] = useState<Date | null>(null);
  const [filterDriver, setFilterDriver] = useState('');
  const [filterTaxi, setFilterTaxi] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [shiftsResult, driversResult, taxisResult] = await Promise.all([
        supabase
          .from('shifts')
          .select(`
            *,
            driver:profiles(*),
            taxi:taxis(*)
          `)
          .order('start_time', { ascending: false }),
        supabase.from('profiles').select('*').order('first_name'),
        supabase.from('taxis').select('*').eq('is_active', true).order('license_plate'),
      ]);

      if (shiftsResult.error) throw shiftsResult.error;
      if (driversResult.error) throw driversResult.error;
      if (taxisResult.error) throw taxisResult.error;

      setShifts(shiftsResult.data || []);
      setDrivers(driversResult.data || []);
      setTaxis(taxisResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      enqueueSnackbar(t('errors.generic'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (shift?: ShiftWithDetails) => {
    if (shift) {
      setCurrentShift(shift);
      const startDate = parseISO(shift.start_time);
      const endDate = parseISO(shift.end_time);
      setSelectedDate(startDate);
      setStartTime(startDate);
      setEndTime(endDate);
    } else {
      setCurrentShift({
        driver_id: '',
        taxi_id: '',
      });
      setSelectedDate(new Date());
      setStartTime(null);
      setEndTime(null);
    }
    setValidationError('');
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setCurrentShift(null);
    setValidationError('');
  };

  const validateShift = async (): Promise<boolean> => {
    if (!currentShift?.driver_id || !currentShift?.taxi_id || !selectedDate || !startTime || !endTime) {
      setValidationError('Please fill in all required fields');
      return false;
    }

    const shiftStart = new Date(selectedDate);
    shiftStart.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
    
    const shiftEnd = new Date(selectedDate);
    shiftEnd.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
    
    if (shiftEnd <= shiftStart) {
      shiftEnd.setDate(shiftEnd.getDate() + 1);
    }

    const duration = differenceInHours(shiftEnd, shiftStart);
    
    if (duration > 10) {
      setValidationError(t('shifts.maxDuration'));
      return false;
    }

    // Check for conflicts
    const { data: conflicts } = await supabase
      .from('shifts')
      .select('*')
      .eq('taxi_id', currentShift.taxi_id)
      .neq('id', currentShift.id || '')
      .or(`and(start_time.lt.${shiftEnd.toISOString()},end_time.gt.${shiftStart.toISOString()})`);

    if (conflicts && conflicts.length > 0) {
      setValidationError(t('shifts.conflictError'));
      return false;
    }

    setValidationError('');
    return true;
  };

  const handleSaveShift = async () => {
    if (!await validateShift()) return;
    if (!currentShift || !selectedDate || !startTime || !endTime) return;

    try {
      const shiftStart = new Date(selectedDate);
      shiftStart.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
      
      const shiftEnd = new Date(selectedDate);
      shiftEnd.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
      
      if (shiftEnd <= shiftStart) {
        shiftEnd.setDate(shiftEnd.getDate() + 1);
      }

      const shiftData = {
        driver_id: currentShift.driver_id,
        taxi_id: currentShift.taxi_id,
        start_time: shiftStart.toISOString(),
        end_time: shiftEnd.toISOString(),
      };

      if (currentShift.id) {
        const { error } = await supabase
          .from('shifts')
          .update(shiftData)
          .eq('id', currentShift.id);

        if (error) throw error;
        enqueueSnackbar(t('shifts.updateSuccess'), { variant: 'success' });
      } else {
        const { error } = await supabase
          .from('shifts')
          .insert(shiftData);

        if (error) throw error;
        enqueueSnackbar(t('shifts.bookingSuccess'), { variant: 'success' });
      }

      handleCloseDialog();
      fetchData();
    } catch (error: any) {
      console.error('Error saving shift:', error);
      enqueueSnackbar(error.message || t('errors.generic'), { variant: 'error' });
    }
  };

  const handleDeleteShift = async () => {
    if (!currentShift?.id) return;

    try {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', currentShift.id);

      if (error) throw error;

      enqueueSnackbar(t('shifts.deleteSuccess'), { variant: 'success' });
      setDeleteDialogOpen(false);
      setCurrentShift(null);
      fetchData();
    } catch (error: any) {
      console.error('Error deleting shift:', error);
      enqueueSnackbar(error.message || t('errors.generic'), { variant: 'error' });
    }
  };

  const filteredShifts = shifts.filter(shift => {
    let matches = true;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      matches = matches && (
        shift.driver?.first_name.toLowerCase().includes(search) ||
        shift.driver?.last_name.toLowerCase().includes(search) ||
        shift.taxi?.license_plate.toLowerCase().includes(search)
      );
    }

    if (filterDriver) {
      matches = matches && shift.driver_id === filterDriver;
    }

    if (filterTaxi) {
      matches = matches && shift.taxi_id === filterTaxi;
    }

    if (filterDate) {
      const shiftDate = parseISO(shift.start_time);
      matches = matches && format(shiftDate, 'yyyy-MM-dd') === format(filterDate, 'yyyy-MM-dd');
    }

    return matches;
  });

  const getShiftStatus = (shift: ShiftWithDetails) => {
    const start = parseISO(shift.start_time);
    const end = parseISO(shift.end_time);
    const now = new Date();

    if (now >= start && now <= end) return 'ongoing';
    if (isFuture(start)) return 'upcoming';
    return 'completed';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {t('shifts.title')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="list">
              <ViewList />
            </ToggleButton>
            <ToggleButton value="calendar">
              <CalendarMonth />
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
          >
            {t('shifts.bookShift')}
          </Button>
        </Box>
      </Box>

      <Paper sx={{ mb: 3, p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            variant="outlined"
            placeholder={t('common.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ flex: 1, minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>{t('shifts.driver')}</InputLabel>
            <Select
              value={filterDriver}
              onChange={(e) => setFilterDriver(e.target.value)}
              label={t('shifts.driver')}
            >
              <MenuItem value="">All</MenuItem>
              {drivers.map((driver) => (
                <MenuItem key={driver.id} value={driver.id}>
                  {driver.first_name} {driver.last_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>{t('shifts.taxi')}</InputLabel>
            <Select
              value={filterTaxi}
              onChange={(e) => setFilterTaxi(e.target.value)}
              label={t('shifts.taxi')}
            >
              <MenuItem value="">All</MenuItem>
              {taxis.map((taxi) => (
                <MenuItem key={taxi.id} value={taxi.id}>
                  {taxi.license_plate}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label={t('common.date')}
              value={filterDate}
              onChange={setFilterDate}
              slotProps={{
                textField: {
                  sx: { minWidth: 150 },
                },
              }}
            />
          </LocalizationProvider>
        </Box>
      </Paper>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('shifts.driver')}</TableCell>
                <TableCell>{t('shifts.taxi')}</TableCell>
                <TableCell>{t('common.date')}</TableCell>
                <TableCell>{t('common.time')}</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredShifts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary">
                      {t('shifts.noShifts')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredShifts.map((shift) => {
                  const status = getShiftStatus(shift);
                  return (
                    <TableRow key={shift.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 32, height: 32 }}>
                            {shift.driver?.first_name[0]}{shift.driver?.last_name[0]}
                          </Avatar>
                          {shift.driver?.first_name} {shift.driver?.last_name}
                        </Box>
                      </TableCell>
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
                        {format(parseISO(shift.start_time), 'HH:mm')} - 
                        {format(parseISO(shift.end_time), 'HH:mm')}
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
                        <Tooltip title={t('common.edit')}>
                          <IconButton size="small" onClick={() => handleOpenDialog(shift)}>
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
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add/Edit Shift Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {currentShift?.id ? t('shifts.editShift') : t('shifts.bookShift')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>{t('shifts.selectDriver')}</InputLabel>
              <Select
                value={currentShift?.driver_id || ''}
                onChange={(e) => setCurrentShift({ ...currentShift, driver_id: e.target.value })}
              >
                {drivers.map((driver) => (
                  <MenuItem key={driver.id} value={driver.id}>
                    {driver.first_name} {driver.last_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>{t('shifts.selectTaxi')}</InputLabel>
              <Select
                value={currentShift?.taxi_id || ''}
                onChange={(e) => setCurrentShift({ ...currentShift, taxi_id: e.target.value })}
              >
                {taxis.map((taxi) => (
                  <MenuItem key={taxi.id} value={taxi.id}>
                    {taxi.license_plate}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label={t('common.date')}
                value={selectedDate}
                onChange={setSelectedDate}
                slotProps={{
                  textField: {
                    fullWidth: true,
                  },
                }}
              />

              <TimePicker
                label={t('common.startTime')}
                value={startTime}
                onChange={setStartTime}
                slotProps={{
                  textField: {
                    fullWidth: true,
                  },
                }}
              />

              <TimePicker
                label={t('common.endTime')}
                value={endTime}
                onChange={setEndTime}
                slotProps={{
                  textField: {
                    fullWidth: true,
                  },
                }}
              />
            </LocalizationProvider>

            {validationError && (
              <Alert severity="error">
                {validationError}
              </Alert>
            )}

            {startTime && endTime && endTime < startTime && (
              <Alert severity="info">
                {t('shifts.overnight')}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>{t('common.cancel')}</Button>
          <Button
            onClick={handleSaveShift}
            variant="contained"
            disabled={!currentShift?.driver_id || !currentShift?.taxi_id || !selectedDate || !startTime || !endTime}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

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
                <strong>Driver:</strong> {currentShift.driver?.first_name} {currentShift.driver?.last_name}
              </Typography>
              <Typography variant="body2">
                <strong>Taxi:</strong> {currentShift.taxi?.license_plate}
              </Typography>
              {currentShift.start_time && (
                <Typography variant="body2">
                  <strong>Time:</strong> {format(parseISO(currentShift.start_time), 'PPp')}
                </Typography>
              )}
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

export default function AdminShiftsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <DashboardLayout>
        <AdminShiftsContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}