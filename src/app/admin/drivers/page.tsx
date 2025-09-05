'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Email,
  PersonAdd,
  Warning,
  Check,
} from '@mui/icons-material';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/DashboardLayout';
import { driverService } from '@/services/driverService';
import { Profile, EmployeeType } from '@/lib/supabase/database.types';
import { enqueueSnackbar } from 'notistack';

interface DriverFormData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  employeeType: EmployeeType;
}

function AdminDriversContent() {
  const { t } = useTranslation();
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Profile | null>(null);
  const [driverToDelete, setDriverToDelete] = useState<Profile | null>(null);
  const [formData, setFormData] = useState<DriverFormData>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    employeeType: 'Vollzeit Mitarbeiter',
  });
  const [formErrors, setFormErrors] = useState<Partial<DriverFormData>>({});

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const data = await driverService.getDrivers();
      setDrivers(data);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      enqueueSnackbar(t('errors.generic'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Partial<DriverFormData> = {};
    
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email address';
    }
    
    if (!selectedDriver && (!formData.password || formData.password.length < 6)) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    if (!formData.firstName) {
      errors.firstName = 'First name is required';
    }
    
    if (!formData.lastName) {
      errors.lastName = 'Last name is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateDriver = () => {
    setSelectedDriver(null);
    setFormData({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      employeeType: 'Vollzeit Mitarbeiter',
    });
    setFormErrors({});
    setOpenDialog(true);
  };

  const handleEditDriver = (driver: Profile) => {
    setSelectedDriver(driver);
    setFormData({
      email: driver.email,
      password: '', // Don't populate password for edits
      firstName: driver.first_name,
      lastName: driver.last_name,
      employeeType: driver.employee_type,
    });
    setFormErrors({});
    setOpenDialog(true);
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      if (selectedDriver) {
        // Update existing driver
        await driverService.updateDriver(selectedDriver.id, {
          firstName: formData.firstName,
          lastName: formData.lastName,
          employeeType: formData.employeeType,
          email: formData.email,
        });
        enqueueSnackbar(t('drivers.updateSuccess'), { variant: 'success' });
      } else {
        // Create new driver
        await driverService.createDriver({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          employeeType: formData.employeeType,
        });
        enqueueSnackbar(t('drivers.createSuccess'), { variant: 'success' });
        enqueueSnackbar(t('drivers.emailSent'), { variant: 'info' });
      }
      
      setOpenDialog(false);
      fetchDrivers();
    } catch (error: any) {
      console.error('Error saving driver:', error);
      enqueueSnackbar(error.message || t('errors.generic'), { variant: 'error' });
    }
  };

  const handleDeleteClick = (driver: Profile) => {
    setDriverToDelete(driver);
    setOpenDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!driverToDelete) return;

    try {
      // Check if driver has active shifts
      const hasShifts = await driverService.hasActiveShifts(driverToDelete.id);
      
      if (hasShifts) {
        const confirmDelete = window.confirm(
          'This driver has active shifts. Deleting will remove all their shifts. Continue?'
        );
        if (!confirmDelete) {
          setOpenDeleteDialog(false);
          return;
        }
      }

      await driverService.deleteDriver(driverToDelete.id);
      enqueueSnackbar(t('drivers.deleteSuccess'), { variant: 'success' });
      setOpenDeleteDialog(false);
      fetchDrivers();
    } catch (error: any) {
      console.error('Error deleting driver:', error);
      enqueueSnackbar(error.message || t('errors.generic'), { variant: 'error' });
    }
  };

  const handleResetPassword = async (driver: Profile) => {
    try {
      await driverService.resetDriverPassword(driver.email);
      enqueueSnackbar(t('auth.passwordResetSent'), { variant: 'success' });
    } catch (error: any) {
      console.error('Error resetting password:', error);
      enqueueSnackbar(error.message || t('errors.generic'), { variant: 'error' });
    }
  };

  const getEmployeeTypeLabel = (type: EmployeeType) => {
    switch (type) {
      case 'Vollzeit Mitarbeiter':
        return t('drivers.fullTime');
      case 'Aushilfe':
        return t('drivers.partTime');
      case 'Sonstiges':
        return t('drivers.other');
      default:
        return type;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">
          {t('drivers.manageDrivers')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<PersonAdd />}
          onClick={handleCreateDriver}
        >
          {t('drivers.addDriver')}
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('common.fullName')}</TableCell>
              <TableCell>{t('common.email')}</TableCell>
              <TableCell>{t('drivers.employeeType')}</TableCell>
              <TableCell align="right">{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {drivers.map((driver) => (
              <TableRow key={driver.id}>
                <TableCell>
                  {driver.first_name} {driver.last_name}
                </TableCell>
                <TableCell>{driver.email}</TableCell>
                <TableCell>
                  <Chip
                    label={getEmployeeTypeLabel(driver.employee_type)}
                    size="small"
                    color={driver.employee_type === 'Vollzeit Mitarbeiter' ? 'primary' : 'default'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={t('auth.resetPassword')}>
                    <IconButton
                      size="small"
                      onClick={() => handleResetPassword(driver)}
                    >
                      <Email />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('common.edit')}>
                    <IconButton
                      size="small"
                      onClick={() => handleEditDriver(driver)}
                    >
                      <Edit />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('common.delete')}>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteClick(driver)}
                    >
                      <Delete />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedDriver ? t('drivers.editDriver') : t('drivers.addDriver')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label={t('common.email')}
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              error={!!formErrors.email}
              helperText={formErrors.email}
              fullWidth
              required
            />
            
            {!selectedDriver && (
              <TextField
                label={t('common.password')}
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                error={!!formErrors.password}
                helperText={formErrors.password || 'Min. 6 characters'}
                fullWidth
                required
              />
            )}
            
            <TextField
              label={t('common.firstName')}
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              error={!!formErrors.firstName}
              helperText={formErrors.firstName}
              fullWidth
              required
            />
            
            <TextField
              label={t('common.lastName')}
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              error={!!formErrors.lastName}
              helperText={formErrors.lastName}
              fullWidth
              required
            />
            
            <FormControl fullWidth>
              <InputLabel>{t('drivers.employeeType')}</InputLabel>
              <Select
                value={formData.employeeType}
                onChange={(e) => setFormData({ ...formData, employeeType: e.target.value as EmployeeType })}
                label={t('drivers.employeeType')}
              >
                <MenuItem value="Vollzeit Mitarbeiter">{t('drivers.fullTime')}</MenuItem>
                <MenuItem value="Aushilfe">{t('drivers.partTime')}</MenuItem>
                <MenuItem value="Sonstiges">{t('drivers.other')}</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} variant="contained">
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Warning color="error" />
            {t('drivers.deleteDriver')}
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('drivers.confirmDelete')}
          </DialogContentText>
          {driverToDelete && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {driverToDelete.first_name} {driverToDelete.last_name} ({driverToDelete.email})
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
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