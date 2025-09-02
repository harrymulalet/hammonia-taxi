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
  ListItemAvatar,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  Skeleton,
} from '@mui/material';
import {
  People,
  DirectionsCar,
  Schedule,
  TrendingUp,
  Edit,
  Visibility,
  AddCircle,
} from '@mui/icons-material';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase/client';
import { ShiftWithDetails } from '@/lib/supabase/database.types';
import { useAuth } from '@/contexts/AuthContext';

function AdminDashboardContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDrivers: 0,
    totalTaxis: 0,
    todayShifts: 0,
    upcomingShifts: 0,
  });
  const [todaysShifts, setTodaysShifts] = useState<ShiftWithDetails[]>([]);
  const [upcomingShifts, setUpcomingShifts] = useState<ShiftWithDetails[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch statistics
      const [driversResult, taxisResult, shiftsResult] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact' }),
        supabase.from('taxis').select('*', { count: 'exact' }),
        supabase
          .from('shifts')
          .select(`
            *,
            driver:profiles(*),
            taxi:taxis(*)
          `)
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true }),
      ]);

      const shifts = shiftsResult.data || [];
      const todayShifts = shifts.filter((shift: ShiftWithDetails) => isToday(parseISO(shift.start_time)));
      const tomorrowShifts = shifts.filter((shift: ShiftWithDetails) => isTomorrow(parseISO(shift.start_time)));

      setStats({
        totalDrivers: driversResult.count || 0,
        totalTaxis: taxisResult.count || 0,
        todayShifts: todayShifts.length,
        upcomingShifts: shifts.length,
      });

      setTodaysShifts(todayShifts.slice(0, 5));
      setUpcomingShifts(shifts.slice(0, 5));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon, color }: any) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar sx={{ bgcolor: color, mr: 2 }}>
            {icon}
          </Avatar>
          <Typography color="textSecondary" variant="subtitle2">
            {title}
          </Typography>
        </Box>
        <Typography variant="h4" component="div">
          {loading ? <Skeleton width={60} /> : value}
        </Typography>
      </CardContent>
    </Card>
  );

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
        {/* Statistics Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('drivers.title')}
            value={stats.totalDrivers}
            icon={<People />}
            color="primary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('taxis.title')}
            value={stats.totalTaxis}
            icon={<DirectionsCar />}
            color="secondary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('dashboard.todaysShifts')}
            value={stats.todayShifts}
            icon={<Schedule />}
            color="success.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('dashboard.upcomingShifts')}
            value={stats.upcomingShifts}
            icon={<TrendingUp />}
            color="warning.main"
          />
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              {t('dashboard.quickActions')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Chip
                icon={<AddCircle />}
                label={t('drivers.addDriver')}
                onClick={() => router.push('/admin/drivers')}
                color="primary"
                variant="outlined"
                sx={{ justifyContent: 'flex-start' }}
              />
              <Chip
                icon={<AddCircle />}
                label={t('taxis.addTaxi')}
                onClick={() => router.push('/admin/taxis')}
                color="primary"
                variant="outlined"
                sx={{ justifyContent: 'flex-start' }}
              />
              <Chip
                icon={<Schedule />}
                label={t('shifts.bookShift')}
                onClick={() => router.push('/admin/shifts')}
                color="primary"
                variant="outlined"
                sx={{ justifyContent: 'flex-start' }}
              />
              <Chip
                icon={<Visibility />}
                label={t('analytics.title')}
                onClick={() => router.push('/admin/analytics')}
                color="primary"
                variant="outlined"
                sx={{ justifyContent: 'flex-start' }}
              />
            </Box>
          </Paper>
        </Grid>

        {/* Today's Shifts */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                {t('dashboard.todaysShifts')}
              </Typography>
              <IconButton size="small" onClick={() => router.push('/admin/shifts')}>
                <Visibility />
              </IconButton>
            </Box>
            {loading ? (
              <Skeleton variant="rectangular" height={200} />
            ) : todaysShifts.length > 0 ? (
              <List>
                {todaysShifts.map((shift) => (
                  <ListItem key={shift.id} divider>
                    <ListItemAvatar>
                      <Avatar>
                        {shift.driver?.first_name?.[0]}{shift.driver?.last_name?.[0]}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={`${shift.driver?.first_name} ${shift.driver?.last_name}`}
                      secondary={
                        <Box component="span">
                          <Chip
                            label={shift.taxi?.license_plate}
                            size="small"
                            sx={{ mr: 1 }}
                          />
                          {format(parseISO(shift.start_time), 'HH:mm')} - 
                          {format(parseISO(shift.end_time), 'HH:mm')}
                        </Box>
                      }
                    />
                    <Tooltip title={t('common.edit')}>
                      <IconButton size="small" onClick={() => router.push(`/admin/shifts/${shift.id}`)}>
                        <Edit />
                      </IconButton>
                    </Tooltip>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary" align="center">
                {t('shifts.noShifts')}
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute requireAdmin>
      <DashboardLayout>
        <AdminDashboardContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}