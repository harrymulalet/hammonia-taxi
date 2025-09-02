'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  Button,
  Skeleton,
  Alert,
} from '@mui/material';
import {
  Schedule,
  DirectionsCar,
  AddCircle,
  EventNote,
  AccessTime,
} from '@mui/icons-material';
import { format, isToday, isFuture, parseISO, differenceInHours } from 'date-fns';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase/client';
import { ShiftWithDetails } from '@/lib/supabase/database.types';
import { useAuth } from '@/contexts/AuthContext';

function DriverDashboardContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myShifts, setMyShifts] = useState<ShiftWithDetails[]>([]);
  const [todaysShift, setTodaysShift] = useState<ShiftWithDetails | null>(null);
  const [upcomingShifts, setUpcomingShifts] = useState<ShiftWithDetails[]>([]);
  const [stats, setStats] = useState({
    totalShifts: 0,
    hoursThisWeek: 0,
    nextShiftIn: null as string | null,
  });

  useEffect(() => {
    if (user) {
      fetchDriverData();
    }
  }, [user]);

  const fetchDriverData = async () => {
    if (!user) return;

    try {
      // Fetch driver's shifts
      const { data: shifts, error } = await supabase
        .from('shifts')
        .select(`
          *,
          taxi:taxis(*)
        `)
        .eq('driver_id', user.id)
        .order('start_time', { ascending: true });

      if (error) throw error;

      const allShifts = shifts || [];
      
      // Find today's shift
      const todayShift = allShifts.find(shift => 
        isToday(parseISO(shift.start_time))
      );
      
      // Get upcoming shifts
      const upcoming = allShifts.filter(shift => 
        isFuture(parseISO(shift.start_time))
      ).slice(0, 5);

      // Calculate statistics
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      
      const weekShifts = allShifts.filter(shift => 
        parseISO(shift.start_time) >= weekStart
      );
      
      const hoursThisWeek = weekShifts.reduce((total, shift) => {
        return total + differenceInHours(
          parseISO(shift.end_time),
          parseISO(shift.start_time)
        );
      }, 0);

      let nextShiftIn = null;
      if (upcoming.length > 0) {
        const hoursUntilNext = differenceInHours(
          parseISO(upcoming[0].start_time),
          new Date()
        );
        if (hoursUntilNext < 24) {
          nextShiftIn = `${hoursUntilNext} ${t('common.hours')}`;
        } else {
          const days = Math.floor(hoursUntilNext / 24);
          nextShiftIn = `${days} ${days === 1 ? 'day' : 'days'}`;
        }
      }

      setMyShifts(allShifts);
      setTodaysShift(todayShift || null);
      setUpcomingShifts(upcoming);
      setStats({
        totalShifts: allShifts.length,
        hoursThisWeek,
        nextShiftIn,
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching driver data:', error);
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          {t('dashboard.welcome')}, {profile?.first_name}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Today's Shift Alert */}
        {todaysShift && (
          <Grid item xs={12}>
            <Alert severity="info" icon={<Schedule />}>
              <Typography variant="subtitle1">
                Today's Shift: {todaysShift.taxi?.license_plate} | {' '}
                {format(parseISO(todaysShift.start_time), 'HH:mm')} - 
                {format(parseISO(todaysShift.end_time), 'HH:mm')}
              </Typography>
            </Alert>
          </Grid>
        )}

        {/* Statistics Cards */}
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <EventNote sx={{ mr: 1, color: 'primary.main' }} />
                <Typography color="textSecondary" variant="subtitle2">
                  Total Shifts
                </Typography>
              </Box>
              <Typography variant="h4">
                {loading ? <Skeleton width={60} /> : stats.totalShifts}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AccessTime sx={{ mr: 1, color: 'secondary.main' }} />
                <Typography color="textSecondary" variant="subtitle2">
                  Hours This Week
                </Typography>
              </Box>
              <Typography variant="h4">
                {loading ? <Skeleton width={60} /> : stats.hoursThisWeek}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Schedule sx={{ mr: 1, color: 'success.main' }} />
                <Typography color="textSecondary" variant="subtitle2">
                  Next Shift In
                </Typography>
              </Box>
              <Typography variant="h4">
                {loading ? (
                  <Skeleton width={100} />
                ) : (
                  stats.nextShiftIn || 'No shifts'
                )}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              {t('dashboard.quickActions')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <Button
                variant="contained"
                startIcon={<AddCircle />}
                onClick={() => router.push('/driver/book-shift')}
                fullWidth
              >
                {t('shifts.bookShift')}
              </Button>
              <Button
                variant="outlined"
                startIcon={<EventNote />}
                onClick={() => router.push('/driver/shifts')}
                fullWidth
              >
                {t('navigation.myShifts')}
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Upcoming Shifts */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              {t('shifts.upcomingShifts')}
            </Typography>
            {loading ? (
              <Skeleton variant="rectangular" height={200} />
            ) : upcomingShifts.length > 0 ? (
              <List>
                {upcomingShifts.map((shift) => (
                  <ListItem key={shift.id} divider>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <DirectionsCar fontSize="small" />
                          <Typography variant="subtitle1">
                            {shift.taxi?.license_plate}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2">
                            {format(parseISO(shift.start_time), 'EEE, MMM d')}
                          </Typography>
                          <Typography variant="body2">
                            {format(parseISO(shift.start_time), 'HH:mm')} - 
                            {format(parseISO(shift.end_time), 'HH:mm')}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', mt: 3 }}>
                <Typography color="text.secondary" gutterBottom>
                  {t('shifts.noShifts')}
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddCircle />}
                  onClick={() => router.push('/driver/book-shift')}
                  sx={{ mt: 2 }}
                >
                  {t('shifts.bookShift')}
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default function DriverDashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <DriverDashboardContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}