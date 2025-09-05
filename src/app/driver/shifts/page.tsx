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
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Tooltip,
  Tab,
  Tabs,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  CalendarMonth,
  ViewList,
  DirectionsCar,
  Person,
  Edit,
  Delete,
  Schedule,
  Info,
  Visibility,
} from '@mui/icons-material';
import { 
  format, 
  parseISO, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval,
  isSameDay,
  isToday,
  isFuture,
  isPast,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ShiftWithDetails } from '@/lib/supabase/database.types';
import { enqueueSnackbar } from 'notistack';
import { useRouter } from 'next/navigation';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

function DriverShiftsContent() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const [tabValue, setTabValue] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [myShifts, setMyShifts] = useState<ShiftWithDetails[]>([]);
  const [allShifts, setAllShifts] = useState<ShiftWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShift, setSelectedShift] = useState<ShiftWithDetails | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const locale = i18n.language === 'de' ? de : enUS;

  useEffect(() => {
    if (user) {
      fetchShifts();
    }
  }, [user, selectedDate]);

  const fetchShifts = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Fetch user's own shifts
      const { data: userShifts, error: userError } = await supabase
        .from('shifts')
        .select(`
          *,
          taxi:taxis(*),
          driver:profiles(*)
        `)
        .eq('driver_id', user.id)
        .order('start_time', { ascending: true });

      if (userError) throw userError;

      // Fetch all shifts for availability view (NO driver filter - show ALL shifts)
      const startDate = startOfMonth(selectedDate);
      const endDate = endOfMonth(selectedDate);
      
      const { data: allShiftsData, error: allError } = await supabase
        .from('shifts')
        .select(`
          *,
          taxi:taxis(*),
          driver:profiles(*)
        `)
        .gte('start_time', startDate.toISOString())
        .lte('end_time', endDate.toISOString())
        .order('start_time', { ascending: true });

      if (allError) throw allError;

      setMyShifts(userShifts || []);
      setAllShifts(allShiftsData || []);
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

  const renderMyShiftsList = () => {
    const upcomingShifts = myShifts.filter(shift => 
      isFuture(parseISO(shift.start_time)) || isToday(parseISO(shift.start_time))
    );
    const pastShifts = myShifts.filter(shift => 
      isPast(parseISO(shift.end_time)) && !isToday(parseISO(shift.start_time))
    );

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          {t('shifts.upcomingShifts')} ({upcomingShifts.length})
        </Typography>
        <List>
          {upcomingShifts.map((shift) => (
            <Card key={shift.id} sx={{ mb: 2 }}>
              <CardContent>
                <Grid container alignItems="center">
                  <Grid item xs={12} md={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <DirectionsCar sx={{ mr: 1 }} />
                      <Typography variant="h6">
                        {shift.taxi?.license_plate}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={5}>
                    <Typography variant="body1">
                      {format(parseISO(shift.start_time), 'EEEE, dd.MM.yyyy', { locale })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {format(parseISO(shift.start_time), 'HH:mm')} - 
                      {format(parseISO(shift.end_time), 'HH:mm')}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4} sx={{ textAlign: 'right' }}>
                    <Tooltip title={t('common.delete')}>
                      <IconButton 
                        color="error"
                        onClick={() => {
                          setSelectedShift(shift);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          ))}
        </List>

        {pastShifts.length > 0 && (
          <>
            <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
              {t('shifts.pastShifts')} ({pastShifts.length})
            </Typography>
            <List>
              {pastShifts.slice(0, 5).map((shift) => (
                <Card key={shift.id} sx={{ mb: 1, opacity: 0.7 }}>
                  <CardContent>
                    <Grid container alignItems="center">
                      <Grid item xs={12} md={3}>
                        <Typography variant="body2">
                          {shift.taxi?.license_plate}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={5}>
                        <Typography variant="body2">
                          {format(parseISO(shift.start_time), 'dd.MM.yyyy', { locale })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {format(parseISO(shift.start_time), 'HH:mm')} - 
                          {format(parseISO(shift.end_time), 'HH:mm')}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}
            </List>
          </>
        )}

        {upcomingShifts.length === 0 && (
          <Alert severity="info">
            {t('shifts.noShifts')}
            <Button 
              sx={{ ml: 2 }}
              variant="outlined"
              size="small"
              onClick={() => router.push('/driver/book-shift')}
            >
              {t('shifts.bookShift')}
            </Button>
          </Alert>
        )}
      </Box>
    );
  };

  const renderCalendarView = () => {
    const startDate = startOfWeek(selectedDate, { locale });
    const endDate = endOfWeek(selectedDate, { locale });
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const getShiftsForDay = (date: Date) => {
      return myShifts.filter(shift => 
        isSameDay(parseISO(shift.start_time), date)
      );
    };

    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h6">
            {format(selectedDate, 'MMMM yyyy', { locale })}
          </Typography>
          <Box>
            <Button onClick={() => setSelectedDate(new Date())}>
              {t('common.today')}
            </Button>
          </Box>
        </Box>
        
        <Grid container spacing={1}>
          {days.map((day) => {
            const dayShifts = getShiftsForDay(day);
            const isCurrentDay = isToday(day);
            
            return (
              <Grid item xs={12} sm={6} md={12/7} key={day.toISOString()}>
                <Paper 
                  sx={{ 
                    p: 1, 
                    minHeight: 120,
                    backgroundColor: isCurrentDay ? 'primary.light' : 'background.paper',
                    opacity: isCurrentDay ? 0.9 : 1,
                  }}
                >
                  <Typography 
                    variant="subtitle2" 
                    sx={{ 
                      fontWeight: isCurrentDay ? 'bold' : 'normal',
                      color: isCurrentDay ? 'primary.contrastText' : 'text.primary',
                    }}
                  >
                    {format(day, 'EEE', { locale })}
                  </Typography>
                  <Typography 
                    variant="h6"
                    sx={{ 
                      color: isCurrentDay ? 'primary.contrastText' : 'text.primary',
                    }}
                  >
                    {format(day, 'd')}
                  </Typography>
                  
                  {dayShifts.map((shift) => (
                    <Chip
                      key={shift.id}
                      label={`${shift.taxi?.license_plate} ${format(parseISO(shift.start_time), 'HH:mm')}`}
                      size="small"
                      sx={{ mt: 0.5, width: '100%' }}
                      color="primary"
                      variant={isCurrentDay ? 'filled' : 'outlined'}
                    />
                  ))}
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      </Box>
    );
  };

  const renderAllShiftsView = () => {
    const groupedByTaxi = allShifts.reduce((acc, shift) => {
      const taxiId = shift.taxi?.license_plate || 'Unknown';
      if (!acc[taxiId]) {
        acc[taxiId] = [];
      }
      acc[taxiId].push(shift);
      return acc;
    }, {} as Record<string, ShiftWithDetails[]>);

    return (
      <Box>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            {t('shifts.availabilityInfo')}
          </Typography>
        </Alert>
        
        {Object.entries(groupedByTaxi).map(([taxiPlate, shifts]) => (
          <Card key={taxiPlate} sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <DirectionsCar sx={{ mr: 1 }} />
                <Typography variant="h6">
                  {taxiPlate}
                </Typography>
                <Chip 
                  label={`${shifts.length} ${t('shifts.title')}`}
                  size="small"
                  sx={{ ml: 2 }}
                />
              </Box>
              
              <Grid container spacing={1}>
                {shifts.slice(0, 10).map((shift) => {
                  const isMyShift = shift.driver_id === user?.id;
                  return (
                    <Grid item xs={12} md={6} key={shift.id}>
                      <Paper 
                        sx={{ 
                          p: 1.5, 
                          backgroundColor: isMyShift ? 'success.light' : 'background.default',
                          opacity: isMyShift ? 0.9 : 0.7,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Person sx={{ mr: 1, fontSize: 16 }} />
                          <Typography variant="body2" sx={{ fontWeight: isMyShift ? 'bold' : 'normal' }}>
                            {isMyShift ? t('common.you') : `${shift.driver?.first_name} ${shift.driver?.last_name}`}
                          </Typography>
                        </Box>
                        <Typography variant="body2">
                          {format(parseISO(shift.start_time), 'EEE dd.MM', { locale })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {format(parseISO(shift.start_time), 'HH:mm')} - 
                          {format(parseISO(shift.end_time), 'HH:mm')}
                        </Typography>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t('navigation.myShifts')}
      </Typography>

      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label={t('navigation.myShifts')} />
          <Tab label={t('shifts.availability')} />
        </Tabs>

        <Box sx={{ p: 3 }}>
          <TabPanel value={tabValue} index={0}>
            {/* My Shifts Tab */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(e, v) => v && setViewMode(v)}
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

            {viewMode === 'list' ? renderMyShiftsList() : renderCalendarView()}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            {/* All Shifts/Availability Tab */}
            {renderAllShiftsView()}
          </TabPanel>
        </Box>
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('shifts.deleteShift')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('shifts.confirmDelete')}
          </Typography>
          {selectedShift && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="body2">
                <strong>{t('shifts.taxi')}:</strong> {selectedShift.taxi?.license_plate}
              </Typography>
              <Typography variant="body2">
                <strong>{t('common.date')}:</strong> {format(parseISO(selectedShift.start_time), 'dd.MM.yyyy')}
              </Typography>
              <Typography variant="body2">
                <strong>{t('common.time')}:</strong> {format(parseISO(selectedShift.start_time), 'HH:mm')} - {format(parseISO(selectedShift.end_time), 'HH:mm')}
              </Typography>
            </Box>
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

export default function DriverShiftsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <DriverShiftsContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}