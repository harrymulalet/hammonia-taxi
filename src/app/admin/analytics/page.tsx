'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp,
  DirectionsCar,
  People,
  Schedule,
  AccessTime,
  EmojiEvents,
  Timeline,
} from '@mui/icons-material';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, differenceInHours, subMonths } from 'date-fns';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase/client';
import { ShiftWithDetails, Profile, Taxi } from '@/lib/supabase/database.types';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

function AdminAnalyticsContent() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [shifts, setShifts] = useState<ShiftWithDetails[]>([]);
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [taxis, setTaxis] = useState<Taxi[]>([]);
  const [stats, setStats] = useState({
    totalShifts: 0,
    totalHours: 0,
    averageShiftDuration: 0,
    utilizationRate: 0,
  });

  useEffect(() => {
    fetchAnalyticsData();
  }, [selectedMonth, selectedYear]);

  const fetchAnalyticsData = async () => {
    try {
      const startDate = startOfMonth(new Date(selectedYear, selectedMonth));
      const endDate = endOfMonth(new Date(selectedYear, selectedMonth));

      const [shiftsResult, driversResult, taxisResult] = await Promise.all([
        supabase
          .from('shifts')
          .select(`
            *,
            driver:profiles(*),
            taxi:taxis(*)
          `)
          .gte('start_time', startDate.toISOString())
          .lte('start_time', endDate.toISOString())
          .order('start_time', { ascending: true }),
        supabase.from('profiles').select('*'),
        supabase.from('taxis').select('*').eq('is_active', true),
      ]);

      if (shiftsResult.error) throw shiftsResult.error;
      if (driversResult.error) throw driversResult.error;
      if (taxisResult.error) throw taxisResult.error;

      const allShifts = shiftsResult.data || [];
      setShifts(allShifts);
      setDrivers(driversResult.data || []);
      setTaxis(taxisResult.data || []);

      // Calculate statistics
      const totalHours = allShifts.reduce((total, shift) => {
        return total + differenceInHours(parseISO(shift.end_time), parseISO(shift.start_time));
      }, 0);

      const averageShiftDuration = allShifts.length > 0 ? totalHours / allShifts.length : 0;
      
      // Calculate utilization rate (percentage of possible hours used)
      const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate }).length;
      const possibleHours = taxisResult.data!.length * daysInMonth * 10; // Assume 10 hours per day max
      const utilizationRate = possibleHours > 0 ? (totalHours / possibleHours) * 100 : 0;

      setStats({
        totalShifts: allShifts.length,
        totalHours,
        averageShiftDuration: Math.round(averageShiftDuration * 10) / 10,
        utilizationRate: Math.round(utilizationRate),
      });
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const prepareShiftsPerDayData = () => {
    const startDate = startOfMonth(new Date(selectedYear, selectedMonth));
    const endDate = endOfMonth(new Date(selectedYear, selectedMonth));
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const shiftsPerDay = days.map(day => {
      const dayShifts = shifts.filter(shift => {
        const shiftDate = parseISO(shift.start_time);
        return format(shiftDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
      });
      return shiftsPerDay.length;
    });

    return {
      labels: days.map(day => format(day, 'MMM d')),
      datasets: [
        {
          label: 'Shifts per Day',
          data: shiftsPerDay,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1,
        },
      ],
    };
  };

  const prepareDriverStatsData = () => {
    const driverStats = drivers.map(driver => {
      const driverShifts = shifts.filter(shift => shift.driver_id === driver.id);
      const totalHours = driverShifts.reduce((total, shift) => {
        return total + differenceInHours(parseISO(shift.end_time), parseISO(shift.start_time));
      }, 0);
      return {
        driver,
        shifts: driverShifts.length,
        hours: totalHours,
      };
    }).sort((a, b) => b.hours - a.hours);

    const top5Drivers = driverStats.slice(0, 5);

    return {
      labels: top5Drivers.map(stat => `${stat.driver.first_name} ${stat.driver.last_name}`),
      datasets: [
        {
          label: 'Hours Worked',
          data: top5Drivers.map(stat => stat.hours),
          backgroundColor: [
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)',
          ],
        },
      ],
    };
  };

  const prepareTaxiUtilizationData = () => {
    const taxiStats = taxis.map(taxi => {
      const taxiShifts = shifts.filter(shift => shift.taxi_id === taxi.id);
      const totalHours = taxiShifts.reduce((total, shift) => {
        return total + differenceInHours(parseISO(shift.end_time), parseISO(shift.start_time));
      }, 0);
      return {
        taxi,
        hours: totalHours,
      };
    });

    return {
      labels: taxiStats.map(stat => stat.taxi.license_plate),
      datasets: [
        {
          label: 'Hours Used',
          data: taxiStats.map(stat => stat.hours),
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        },
      ],
    };
  };

  const prepareHourlyDistributionData = () => {
    const hourlyDistribution = Array(24).fill(0);
    
    shifts.forEach(shift => {
      const startHour = parseISO(shift.start_time).getHours();
      hourlyDistribution[startHour]++;
    });

    return {
      labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      datasets: [
        {
          label: 'Shifts Starting',
          data: hourlyDistribution,
          backgroundColor: 'rgba(153, 102, 255, 0.6)',
          borderColor: 'rgba(153, 102, 255, 1)',
          borderWidth: 1,
        },
      ],
    };
  };

  // Get top drivers
  const getTopDrivers = () => {
    const driverStats = drivers.map(driver => {
      const driverShifts = shifts.filter(shift => shift.driver_id === driver.id);
      const totalHours = driverShifts.reduce((total, shift) => {
        return total + differenceInHours(parseISO(shift.end_time), parseISO(shift.start_time));
      }, 0);
      return {
        driver,
        shifts: driverShifts.length,
        hours: totalHours,
      };
    }).sort((a, b) => b.hours - a.hours).slice(0, 5);

    return driverStats;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {t('analytics.title')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Month</InputLabel>
            <Select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value as number)}
              label="Month"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <MenuItem key={i} value={i}>
                  {format(new Date(2024, i, 1), 'MMMM')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Year</InputLabel>
            <Select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value as number)}
              label="Year"
            >
              {[2023, 2024, 2025].map(year => (
                <MenuItem key={year} value={year}>{year}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Schedule color="primary" />
                <Typography color="text.secondary" variant="subtitle2">
                  {t('analytics.totalShifts')}
                </Typography>
              </Box>
              <Typography variant="h3">{stats.totalShifts}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccessTime color="secondary" />
                <Typography color="text.secondary" variant="subtitle2">
                  Total Hours
                </Typography>
              </Box>
              <Typography variant="h3">{stats.totalHours}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Timeline color="success" />
                <Typography color="text.secondary" variant="subtitle2">
                  {t('analytics.averageDuration')}
                </Typography>
              </Box>
              <Typography variant="h3">{stats.averageShiftDuration}h</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUp color="warning" />
                <Typography color="text.secondary" variant="subtitle2">
                  {t('analytics.utilizationRate')}
                </Typography>
              </Box>
              <Typography variant="h3">{stats.utilizationRate}%</Typography>
              <LinearProgress
                variant="determinate"
                value={stats.utilizationRate}
                sx={{ mt: 1 }}
                color={stats.utilizationRate > 70 ? 'success' : stats.utilizationRate > 40 ? 'warning' : 'error'}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3}>
        {/* Shifts per Day */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Daily Shift Distribution
            </Typography>
            <Box sx={{ height: 300 }}>
              <Line
                data={prepareShiftsPerDayData()}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                  },
                }}
              />
            </Box>
          </Paper>
        </Grid>

        {/* Top Drivers */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              {t('analytics.topDrivers')}
            </Typography>
            <List>
              {getTopDrivers().map((stat, index) => (
                <ListItem key={stat.driver.id}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? '#cd7f32' : 'grey.400' }}>
                      {index === 0 ? <EmojiEvents /> : stat.driver.first_name[0]}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={`${stat.driver.first_name} ${stat.driver.last_name}`}
                    secondary={`${stat.hours} hours • ${stat.shifts} shifts`}
                  />
                  <Chip label={`#${index + 1}`} size="small" />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Taxi Utilization */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('analytics.taxiUtilization')}
            </Typography>
            <Box sx={{ height: 300 }}>
              <Bar
                data={prepareTaxiUtilizationData()}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                  },
                }}
              />
            </Box>
          </Paper>
        </Grid>

        {/* Hourly Distribution */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('analytics.peakHours')}
            </Typography>
            <Box sx={{ height: 300 }}>
              <Bar
                data={prepareHourlyDistributionData()}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                  },
                  scales: {
                    x: {
                      ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                      },
                    },
                  },
                }}
              />
            </Box>
          </Paper>
        </Grid>

        {/* Driver Hours Distribution */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Top 5 Drivers by Hours
            </Typography>
            <Box sx={{ height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Box sx={{ width: '80%', height: '80%' }}>
                <Doughnut
                  data={prepareDriverStatsData()}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'right',
                      },
                    },
                  }}
                />
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <DashboardLayout>
        <AdminAnalyticsContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}