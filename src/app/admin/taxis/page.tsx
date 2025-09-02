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
  FormControlLabel,
  Switch,
  Alert,
  Tooltip,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  DirectionsCar,
  Search,
  CheckCircle,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { enqueueSnackbar } from 'notistack';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase/client';
import { Taxi } from '@/lib/supabase/database.types';

function AdminTaxisContent() {
  const { t } = useTranslation();
  const [taxis, setTaxis] = useState<Taxi[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentTaxi, setCurrentTaxi] = useState<Partial<Taxi> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [licensePlateError, setLicensePlateError] = useState('');

  useEffect(() => {
    fetchTaxis();
  }, []);

  const fetchTaxis = async () => {
    try {
      const { data, error } = await supabase
        .from('taxis')
        .select('*')
        .order('license_plate', { ascending: true });

      if (error) throw error;
      setTaxis(data || []);
    } catch (error) {
      console.error('Error fetching taxis:', error);
      enqueueSnackbar(t('errors.generic'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const validateLicensePlate = (plate: string): boolean => {
    // German license plate format: HH-XX 123
    const regex = /^[A-Z]{1,3}-[A-Z]{1,2}\s?\d{1,4}$/;
    return regex.test(plate.toUpperCase());
  };

  const handleOpenDialog = (taxi?: Taxi) => {
    if (taxi) {
      setCurrentTaxi(taxi);
    } else {
      setCurrentTaxi({
        license_plate: '',
        is_active: true,
      });
    }
    setLicensePlateError('');
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setCurrentTaxi(null);
    setLicensePlateError('');
  };

  const handleSaveTaxi = async () => {
    if (!currentTaxi) return;

    // Validate license plate
    if (!validateLicensePlate(currentTaxi.license_plate || '')) {
      setLicensePlateError(t('taxis.plateFormat'));
      return;
    }

    try {
      const licensePlate = currentTaxi.license_plate?.toUpperCase();

      if (currentTaxi.id) {
        // Update existing taxi
        const { error } = await supabase
          .from('taxis')
          .update({
            license_plate: licensePlate,
            is_active: currentTaxi.is_active,
          })
          .eq('id', currentTaxi.id);

        if (error) throw error;
        enqueueSnackbar(t('taxis.updateSuccess'), { variant: 'success' });
      } else {
        // Create new taxi
        const { error } = await supabase
          .from('taxis')
          .insert({
            license_plate: licensePlate,
            is_active: currentTaxi.is_active,
          });

        if (error) throw error;
        enqueueSnackbar(t('taxis.createSuccess'), { variant: 'success' });
      }

      handleCloseDialog();
      fetchTaxis();
    } catch (error: any) {
      console.error('Error saving taxi:', error);
      if (error.code === '23505') {
        setLicensePlateError('This license plate already exists');
      } else {
        enqueueSnackbar(error.message || t('errors.generic'), { variant: 'error' });
      }
    }
  };

  const handleDeleteTaxi = async () => {
    if (!currentTaxi?.id) return;

    try {
      const { error } = await supabase
        .from('taxis')
        .delete()
        .eq('id', currentTaxi.id);

      if (error) throw error;

      enqueueSnackbar(t('taxis.deleteSuccess'), { variant: 'success' });
      setDeleteDialogOpen(false);
      setCurrentTaxi(null);
      fetchTaxis();
    } catch (error: any) {
      console.error('Error deleting taxi:', error);
      if (error.code === '23503') {
        enqueueSnackbar('Cannot delete taxi with existing shifts', { variant: 'error' });
      } else {
        enqueueSnackbar(error.message || t('errors.generic'), { variant: 'error' });
      }
    }
  };

  const handleToggleStatus = async (taxi: Taxi) => {
    try {
      const { error } = await supabase
        .from('taxis')
        .update({ is_active: !taxi.is_active })
        .eq('id', taxi.id);

      if (error) throw error;

      enqueueSnackbar(
        taxi.is_active ? 'Taxi deactivated' : 'Taxi activated',
        { variant: 'success' }
      );
      fetchTaxis();
    } catch (error: any) {
      console.error('Error toggling taxi status:', error);
      enqueueSnackbar(error.message || t('errors.generic'), { variant: 'error' });
    }
  };

  const filteredTaxis = taxis.filter(taxi =>
    taxi.license_plate.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {t('taxis.manageTaxis')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          {t('taxis.addTaxi')}
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
                <TableCell>{t('taxis.licensePlate')}</TableCell>
                <TableCell align="center">{t('taxis.status')}</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Last Updated</TableCell>
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
              ) : filteredTaxis.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography color="text.secondary">
                      No taxis found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTaxis.map((taxi) => (
                  <TableRow key={taxi.id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <DirectionsCar color="primary" />
                        <Typography variant="subtitle1" fontWeight="medium">
                          {taxi.license_plate}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={taxi.is_active ? t('taxis.active') : t('taxis.inactive')}
                        color={taxi.is_active ? 'success' : 'default'}
                        size="small"
                        icon={taxi.is_active ? <CheckCircle /> : <CancelIcon />}
                      />
                    </TableCell>
                    <TableCell>
                      {format(parseISO(taxi.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {format(parseISO(taxi.updated_at), 'MMM d, yyyy HH:mm')}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={taxi.is_active ? 'Deactivate' : 'Activate'}>
                        <IconButton
                          size="small"
                          onClick={() => handleToggleStatus(taxi)}
                        >
                          {taxi.is_active ? <CancelIcon /> : <CheckCircle />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('common.edit')}>
                        <IconButton size="small" onClick={() => handleOpenDialog(taxi)}>
                          <Edit />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('common.delete')}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setCurrentTaxi(taxi);
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
      </Paper>

      {/* Add/Edit Taxi Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {currentTaxi?.id ? t('taxis.editTaxi') : t('taxis.addTaxi')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label={t('taxis.licensePlate')}
              value={currentTaxi?.license_plate || ''}
              onChange={(e) => {
                setCurrentTaxi({ ...currentTaxi, license_plate: e.target.value.toUpperCase() });
                setLicensePlateError('');
              }}
              fullWidth
              required
              error={!!licensePlateError}
              helperText={licensePlateError || t('taxis.plateFormat')}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <DirectionsCar />
                  </InputAdornment>
                ),
              }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={currentTaxi?.is_active || false}
                  onChange={(e) => setCurrentTaxi({ ...currentTaxi, is_active: e.target.checked })}
                />
              }
              label={t('taxis.active')}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>{t('common.cancel')}</Button>
          <Button
            onClick={handleSaveTaxi}
            variant="contained"
            disabled={!currentTaxi?.license_plate}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('taxis.deleteTaxi')}</DialogTitle>
        <DialogContent>
          <Alert severity="warning">
            {t('taxis.confirmDelete')}
          </Alert>
          <Typography variant="body2" sx={{ mt: 2 }}>
            License Plate: <strong>{currentTaxi?.license_plate}</strong>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleDeleteTaxi} color="error" variant="contained">
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function AdminTaxisPage() {
  return (
    <ProtectedRoute requireAdmin>
      <DashboardLayout>
        <AdminTaxisContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}