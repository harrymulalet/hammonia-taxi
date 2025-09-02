'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  InputAdornment,
  Alert,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Save,
  Visibility,
  VisibilityOff,
  Person,
  Lock,
  Language,
  Notifications,
  DarkMode,
  Email,
} from '@mui/icons-material';
import { enqueueSnackbar } from 'notistack';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { EmployeeType } from '@/lib/supabase/database.types';

function SettingsContent() {
  const { t, i18n } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  
  // Profile settings
  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [lastName, setLastName] = useState(profile?.last_name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [employeeType, setEmployeeType] = useState<EmployeeType>(profile?.employee_type || 'Vollzeit Mitarbeiter');
  
  // Password settings
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Preferences
  const [language, setLanguage] = useState(i18n.language);
  const [darkMode, setDarkMode] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);

  const employeeTypes: EmployeeType[] = ['Vollzeit Mitarbeiter', 'Aushilfe', 'Sonstiges'];

  const handleSaveProfile = async () => {
    if (!profile) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          email,
          employee_type: employeeType,
        })
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
      enqueueSnackbar('Profile updated successfully', { variant: 'success' });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      enqueueSnackbar(error.message || t('errors.generic'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      enqueueSnackbar('Passwords do not match', { variant: 'error' });
      return;
    }

    if (newPassword.length < 6) {
      enqueueSnackbar('Password must be at least 6 characters', { variant: 'error' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      enqueueSnackbar('Password changed successfully', { variant: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      enqueueSnackbar(error.message || t('errors.generic'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    i18n.changeLanguage(newLanguage);
    localStorage.setItem('language', newLanguage);
    enqueueSnackbar('Language changed successfully', { variant: 'success' });
  };

  const handleSavePreferences = () => {
    // Save preferences to localStorage (in production, save to database)
    localStorage.setItem('darkMode', darkMode.toString());
    localStorage.setItem('emailNotifications', emailNotifications.toString());
    localStorage.setItem('pushNotifications', pushNotifications.toString());
    
    enqueueSnackbar('Preferences saved successfully', { variant: 'success' });
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t('settings.title')}
      </Typography>

      <Grid container spacing={3}>
        {/* Settings Navigation */}
        <Grid item xs={12} md={3}>
          <Paper>
            <List>
              <ListItem
                button
                selected={activeTab === 'profile'}
                onClick={() => setActiveTab('profile')}
              >
                <Person sx={{ mr: 2 }} />
                <ListItemText primary="Profile" />
              </ListItem>
              <ListItem
                button
                selected={activeTab === 'password'}
                onClick={() => setActiveTab('password')}
              >
                <Lock sx={{ mr: 2 }} />
                <ListItemText primary="Password" />
              </ListItem>
              <ListItem
                button
                selected={activeTab === 'preferences'}
                onClick={() => setActiveTab('preferences')}
              >
                <Language sx={{ mr: 2 }} />
                <ListItemText primary="Preferences" />
              </ListItem>
            </List>
          </Paper>
        </Grid>

        {/* Settings Content */}
        <Grid item xs={12} md={9}>
          {activeTab === 'profile' && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Profile Settings
              </Typography>
              <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label={t('common.firstName')}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={loading}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label={t('common.lastName')}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={loading}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label={t('common.email')}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Email />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>{t('drivers.employeeType')}</InputLabel>
                    <Select
                      value={employeeType}
                      onChange={(e) => setEmployeeType(e.target.value as EmployeeType)}
                      disabled={loading}
                    >
                      {employeeTypes.map((type) => (
                        <MenuItem key={type} value={type}>
                          {type}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                {profile?.is_admin && (
                  <Grid item xs={12}>
                    <Alert severity="info">
                      You have administrator privileges
                    </Alert>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<Save />}
                      onClick={handleSaveProfile}
                      disabled={loading}
                    >
                      Save Profile
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          )}

          {activeTab === 'password' && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Change Password
              </Typography>
              <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Current Password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={loading}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            edge="end"
                          >
                            {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="New Password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                    helperText="Minimum 6 characters"
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            edge="end"
                          >
                            {showNewPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Confirm New Password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    error={confirmPassword !== '' && confirmPassword !== newPassword}
                    helperText={confirmPassword !== '' && confirmPassword !== newPassword ? 'Passwords do not match' : ''}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            edge="end"
                          >
                            {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<Lock />}
                      onClick={handleChangePassword}
                      disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                    >
                      Change Password
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          )}

          {activeTab === 'preferences' && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Preferences
              </Typography>
              <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>
                    Language
                  </Typography>
                  <FormControl fullWidth>
                    <Select
                      value={language}
                      onChange={(e) => handleLanguageChange(e.target.value)}
                      startAdornment={
                        <InputAdornment position="start">
                          <Language />
                        </InputAdornment>
                      }
                    >
                      <MenuItem value="en">English</MenuItem>
                      <MenuItem value="de">Deutsch</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>
                    Appearance
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={darkMode}
                        onChange={(e) => setDarkMode(e.target.checked)}
                        icon={<DarkMode />}
                        checkedIcon={<DarkMode />}
                      />
                    }
                    label="Dark Mode (Coming Soon)"
                    disabled
                  />
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>
                    Notifications
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="Email Notifications"
                        secondary="Receive shift reminders and updates via email"
                      />
                      <ListItemSecondaryAction>
                        <Switch
                          checked={emailNotifications}
                          onChange={(e) => setEmailNotifications(e.target.checked)}
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Push Notifications"
                        secondary="Receive browser notifications for shift changes"
                      />
                      <ListItemSecondaryAction>
                        <Switch
                          checked={pushNotifications}
                          onChange={(e) => setPushNotifications(e.target.checked)}
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                  </List>
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<Save />}
                      onClick={handleSavePreferences}
                    >
                      Save Preferences
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <SettingsContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}