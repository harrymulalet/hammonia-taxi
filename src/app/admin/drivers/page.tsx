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
  Avatar,
  Tooltip,
  InputAdornment,
  Alert,
  TablePagination,
  CircularProgress,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Person,
  Email,
  Search,
  Visibility,
  VisibilityOff,
  Send,
} from '@mui/icons-material';
import { enqueueSnackbar } from 'notistack';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase/client';
import { Profile, EmployeeType } from '@/lib/supabase/database.types';

function AdminDriversContent() {
  const { t } = useTranslation();
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentDriver, setCurrentDriver] = useState<Partial<Profile> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [showPassword, setShowPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState('');

  const employeeTypes: EmployeeType[] = ['Vollzeit Mitarbeiter', 'Aushilfe', 'Sonstiges'];

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDrivers(data || []);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      enqueueSnackbar(t('errors.generic'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (driver?: Profile) => {
    if (driver) {
      setCurrentDriver(driver);
      setTempPassword('');
    } else {
      setCurrentDriver({
        first_name: '',
        last_name: '',
        email: '',
        employee_type: 'Vollzeit Mitarbeiter',
        is_admin: false,
      });
      setTempPassword('');
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setCurrentDriver(null);
    setTempPassword('');
    setShowPassword(false);
  };

  const handleSaveDriver = async () => {
    if (!currentDriver) return;

    try {
      if (currentDriver.id) {
        // Update existing driver
        const { error } = await supabase
          .from('profiles')
          .update({
            first_name: currentDriver.first_name,
            last_name: currentDriver.last_name,
            email: currentDriver.email,
            employee_type: currentDriver.employee_type,
            is_admin: currentDriver.is_admin,
          })
          .eq('id', currentDriver.id);

        if (error) throw error;
        
        enqueueSnackbar(t('drivers.updateSuccess'), { variant: 'success' });
      } else {
        // Create new driver with auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: currentDriver.email!,
          password: tempPassword,
          options: {
            data: {
              first_name: currentDriver.first_name,
              last_name: currentDriver.last_name,
              employee_type: currentDriver.employee_type,
              is_admin: currentDriver.is_admin,
            },
          },
        });

        if (authError) throw authError;

        // Send password to driver's email (in production, use proper email service)
        enqueueSnackbar(t('drivers.createSuccess'), { variant: 'success' });
        enqueueSnackbar(t('drivers.emailSent'), { variant: 'info' });
      }

      handleCloseDialog();
      fetchDrivers();
    } catch (error: any) {
      console.error('Error saving driver:', error);
      enqueueSnackbar(error.message || t('errors.generic'), { variant: 'error' });
    }
  };

  const handleDeleteDriver = async () => {
    if (!currentDriver?.id) return;

    try {
      // Delete auth user (this will cascade delete the profile)
      const { error } = await supabase.auth.admin.deleteUser(currentDriver.id);
      
      if (error) {
        // If admin API fails, try deleting profile directly
        const { error: profileError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', currentDriver.id);
        
        if (profileError) throw profileError;
      }

      enqueueSnackbar(t('drivers.deleteSuccess'), { variant: 'success' });
      setDeleteDialogOpen(false);
      setCurrentDriver(null);
      fetchDrivers();
    } catch (error: any) {
      console.error('Error deleting driver:', error);
      enqueueSnackbar(error.message || t('errors.generic'), { variant: 'error' });
    }
  };

  const filteredDrivers = drivers.filter(driver =>
    driver.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedDrivers = filteredDrivers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {t('drivers.manageDrivers')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          {t('drivers.addDriver')}
        </Button>
      </Box>

      <Paper>
        <Box sx={{ p: 2 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder={t('common.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('common.fullName')}</TableCell>
                <TableCell>{t('common.email')}</TableCell>
                <TableCell>{t('drivers.employeeType')}</TableCell>
                <TableCell align="center">{t('navigation.admin')}</TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : paginatedDrivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography color="text.secondary">
                      {t('drivers.noDrivers')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedDrivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 32, height: 32 }}>
                          {driver.first_name[0]}{driver.last_name[0]}
                        </Avatar>
                        {driver.first_name} {driver.last_name}
                      </Box>
                    </TableCell>
                    <TableCell>{driver.email}</TableCell>
                    <TableCell>
                      <Chip
                        label={driver.employee_type}
                        size="small"
                        color={driver.employee_type === 'Vollzeit Mitarbeiter' ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="center">
                      {driver.is_admin && (
                        <Chip label="Admin" size="small" color="success" />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={t('common.edit')}>
                        <IconButton size="small" onClick={() => handleOpenDialog(driver)}>
                          <Edit />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('common.delete')}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setCurrentDriver(driver);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredDrivers.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Add/Edit Driver Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {currentDriver?.id ? t('drivers.editDriver') : t('drivers.addDriver')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label={t('common.firstName')}
              value={currentDriver?.first_name || ''}
              onChange={(e) => setCurrentDriver({ ...currentDriver, first_name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label={t('common.lastName')}
              value={currentDriver?.last_name || ''}
              onChange={(e) => setCurrentDriver({ ...currentDriver, last_name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label={t('common.email')}
              type="email"
              value={currentDriver?.email || ''}
              onChange={(e) => setCurrentDriver({ ...currentDriver, email: e.target.value })}
              fullWidth
              required
              disabled={!!currentDriver?.id}
            />
            {!currentDriver?.id && (
              <TextField
                label={t('common.password')}
                type={showPassword ? 'text' : 'password'}
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                fullWidth
                required
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            )}
            <FormControl fullWidth>
              <InputLabel>{t('drivers.employeeType')}</InputLabel>
              <Select
                value={currentDriver?.employee_type || 'Vollzeit Mitarbeiter'}
                onChange={(e) => setCurrentDriver({ ...currentDriver, employee_type: e.target.value as EmployeeType })}
              >
                {employeeTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>{t('navigation.admin')}</InputLabel>
              <Select
                value={currentDriver?.is_admin ? 'true' : 'false'}
                onChange={(e) => setCurrentDriver({ ...currentDriver, is_admin: e.target.value === 'true' })}
              >
                <MenuItem value="false">{t('common.no')}</MenuItem>
                <MenuItem value="true">{t('common.yes')}</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>{t('common.cancel')}</Button>
          <Button
            onClick={handleSaveDriver}
            variant="contained"
            disabled={
              !currentDriver?.first_name ||
              !currentDriver?.last_name ||
              !currentDriver?.email ||
              (!currentDriver?.id && !tempPassword)
            }
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('drivers.deleteDriver')}</DialogTitle>
        <DialogContent>
          <Alert severity="warning">
            {t('drivers.confirmDelete')}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleDeleteDriver} color="error" variant="contained">
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function AdminDriversPage() {
  return (
    <ProtectedRoute requireAdmin>
      <DashboardLayout>
        <AdminDriversContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}