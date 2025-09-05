'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  FormControlLabel,
  Checkbox,
  CircularProgress,
} from '@mui/material';
import {
  DatePicker,
  TimePicker,
} from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import {
  Save,
  Cancel,
  DirectionsCar,
  Schedule,
  Warning,
} from '@mui/icons-material';
import { format, addDays, isSameDay, differenceInHours, parseISO } from 'date-fns';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase/client';
import { Taxi, Shift } from '@/lib/supabase/database.types';
import { useAuth } from '@/contexts/AuthContext';
import { enqueueSnackbar } from 'notistack';

function BookShiftContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [taxis, setTaxis] = useState<Taxi[]>([]);
  const [selectedTaxi, setSelectedTaxi] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [multipleDays, setMultipleDays] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    fetchTaxis();
  }, []);

  useEffect(() => {
    if (selectedTaxi && selectedDate && startTime && endTime) {
      checkConflicts();
    }
  }, [selectedTaxi, selectedDate, startTime, endTime, selectedDates, multipleDays]);

  const fetchTaxis = async () => {
    try {
      const { data, error } = await supabase
        .from('taxis')
        .select('*')
        .eq('is_active', true)
        .order('license_plate');

      if (error) throw error;
      setTaxis(data || []);
    } catch (error) {
      console.error('Error fetching taxis:', error);
      enqueueSnackbar(t('errors.generic'), { variant: 'error' });
    }
  };

  const checkConflicts = async () => {
    if (!selectedTaxi || !startTime || !endTime || !user) return;

    const datesToCheck = multipleDays ? selectedDates : [selectedDate!];
    const conflictDates: string[] = [];
    const driverConflictDates: string[] = [];

    for (const date of datesToCheck) {
      if (!date) continue;

      const shiftStart = new Date(date);
      shiftStart.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
      
      const shiftEnd = new Date(date);
      shiftEnd.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
      
      // If end time is before start time, assume it's the next day
      if (shiftEnd <= shiftStart) {
        shiftEnd.setDate(shiftEnd.getDate() + 1);
      }

      // Check taxi availability
      const { data: taxiAvailable } = await supabase
        .rpc('check_taxi_availability', {
          p_taxi_id: selectedTaxi,
          p_start_time: shiftStart.toISOString(),
          p_end_time: shiftEnd.toISOString(),
        });

      // Check driver availability
      const { data: driverAvailable } = await supabase
        .rpc('check_driver_availability', {
          p_driver_id: user.id,
          p_start_time: shiftStart.toISOString(),
          p_end_time: shiftEnd.toISOString(),
        });

      if (!taxiAvailable) {
        conflictDates.push(format(date, 'MMM d, yyyy'));
      }
      
      if (!driverAvailable) {
        driverConflictDates.push(format(date, 'MMM d, yyyy'));
      }
    }

    setConflicts(conflictDates);
    
    // Set validation error if driver has conflicts
    if (driverConflictDates.length > 0) {
      setValidationError(`You already have shifts scheduled on: ${driverConflictDates.join(', ')}`);
    }
  };

  const validateShift = (): boolean => {
    if (!selectedTaxi || !selectedDate || !startTime || !endTime) {
      setValidationError('Please fill in all required fields');
      return false;
    }

    const shiftStart = new Date(selectedDate);
    shiftStart.setHours(startTime.getHours(), startTime.getMinutes());
    
    const shiftEnd = new Date(selectedDate);
    shiftEnd.setHours(endTime.getHours(), endTime.getMinutes());
    
    // If end time is before start time, assume it's the next day
    if (shiftEnd <= shiftStart) {
      shiftEnd.setDate(shiftEnd.getDate() + 1);
    }

    const duration = differenceInHours(shiftEnd, shiftStart);
    
    if (duration > 10) {
      setValidationError(t('shifts.maxDuration'));
      return false;
    }

    if (conflicts.length > 0) {
      setValidationError(t('shifts.conflictError'));
      return false;
    }

    setValidationError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!validateShift() || !user) return;

    setLoading(true);
    try {
      const datesToBook = multipleDays ? selectedDates : [selectedDate!];
      const shifts = [];

      for (const date of datesToBook) {
        if (!date) continue;

        const shiftStart = new Date(date);
        shiftStart.setHours(startTime!.getHours(), startTime!.getMinutes(), 0, 0);
        
        const shiftEnd = new Date(date);
        shiftEnd.setHours(endTime!.getHours(), endTime!.getMinutes(), 0, 0);
        
        // If end time is before start time, assume it's the next day
        if (shiftEnd <= shiftStart) {
          shiftEnd.setDate(shiftEnd.getDate() + 1);
        }

        shifts.push({
          driver_id: user.id,
          taxi_id: selectedTaxi,
          start_time: shiftStart.toISOString(),
          end_time: shiftEnd.toISOString(),
        });
      }

      const { error } = await supabase.from('shifts').insert(shifts);

      if (error) throw error;

      enqueueSnackbar(t('shifts.bookingSuccess'), { variant: 'success' });
      router.push('/driver/shifts');
    } catch (error: any) {
      console.error('Error booking shift:', error);
      enqueueSnackbar(error.message || t('errors.generic'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelection = (dates: Date[]) => {
    setSelectedDates(dates);
    if (dates.length > 0 && !selectedDate) {
      setSelectedDate(dates[0]);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t('shifts.bookShift')}
      </Typography>

      <Paper sx={{ p: 4, mt: 3 }}>
        <Grid container spacing={3}>
          {/* Taxi Selection */}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>{t('shifts.selectTaxi')}</InputLabel>
              <Select
                value={selectedTaxi}
                onChange={(e) => setSelectedTaxi(e.target.value)}
                startAdornment={<DirectionsCar sx={{ mr: 1, color: 'action.active' }} />}
              >
                {taxis.map((taxi) => (
                  <MenuItem key={taxi.id} value={taxi.id}>
                    {taxi.license_plate}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Multiple Days Checkbox */}
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={multipleDays}
                  onChange={(e) => setMultipleDays(e.target.checked)}
                />
              }
              label={t('shifts.multipleDates')}
            />
          </Grid>

          {/* Date Selection */}
          <Grid item xs={12}>
            {multipleDays ? (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t('shifts.selectDates')}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                  {[0, 1, 2, 3, 4, 5, 6].map((daysToAdd) => {
                    const date = addDays(new Date(), daysToAdd);
                    const isSelected = selectedDates.some(d => isSameDay(d, date));
                    return (
                      <Chip
                        key={daysToAdd}
                        label={format(date, 'EEE, MMM d')}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedDates(selectedDates.filter(d => !isSameDay(d, date)));
                          } else {
                            setSelectedDates([...selectedDates, date]);
                          }
                        }}
                        color={isSelected ? 'primary' : 'default'}
                        variant={isSelected ? 'filled' : 'outlined'}
                      />
                    );
                  })}
                </Box>
              </Box>
            ) : (
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label={t('common.date')}
                  value={selectedDate}
                  onChange={setSelectedDate}
                  minDate={new Date()}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                    },
                  }}
                />
              </LocalizationProvider>
            )}
          </Grid>

          {/* Time Selection */}
          <Grid item xs={12} md={6}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <TimePicker
                label={t('common.startTime')}
                value={startTime}
                onChange={setStartTime}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    InputProps: {
                      startAdornment: <Schedule sx={{ mr: 1, color: 'action.active' }} />,
                    },
                  },
                }}
              />
            </LocalizationProvider>
          </Grid>

          <Grid item xs={12} md={6}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <TimePicker
                label={t('common.endTime')}
                value={endTime}
                onChange={setEndTime}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    InputProps: {
                      startAdornment: <Schedule sx={{ mr: 1, color: 'action.active' }} />,
                    },
                  },
                }}
              />
            </LocalizationProvider>
          </Grid>

          {/* Validation Messages */}
          {validationError && (
            <Grid item xs={12}>
              <Alert severity="error" icon={<Warning />}>
                {validationError}
              </Alert>
            </Grid>
          )}

          {conflicts.length > 0 && (
            <Grid item xs={12}>
              <Alert severity="warning" icon={<Warning />}>
                {t('shifts.conflictError')} on: {conflicts.join(', ')}
              </Alert>
            </Grid>
          )}

          {/* Overnight Shift Notice */}
          {startTime && endTime && endTime < startTime && (
            <Grid item xs={12}>
              <Alert severity="info">
                {t('shifts.overnight')}
              </Alert>
            </Grid>
          )}

          {/* Action Buttons */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                startIcon={<Cancel />}
                onClick={() => router.push('/driver/dashboard')}
                disabled={loading}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={20} /> : <Save />}
                onClick={handleSubmit}
                disabled={loading || !selectedTaxi || !selectedDate || !startTime || !endTime || conflicts.length > 0}
              >
                {loading ? t('common.loading') : t('shifts.bookShift')}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}

export default function BookShiftPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <BookShiftContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}