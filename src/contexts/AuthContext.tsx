'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { Profile } from '@/lib/supabase/database.types';
import { useRouter } from 'next/navigation';
import { enqueueSnackbar } from 'notistack';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        setProfile(null);
        return null;
      }
      
      setProfile(data);
      return data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Check active session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (session?.user) {
          setSession(session);
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log('Auth state changed:', event);
      
      switch (event) {
        case 'SIGNED_IN':
          if (session?.user) {
            setSession(session);
            setUser(session.user);
            const profileData = await fetchProfile(session.user.id);
            
            // Only navigate if we're still on the login page
            if (window.location.pathname === '/login' && profileData) {
              if (profileData.is_admin) {
                router.push('/admin/dashboard');
              } else {
                router.push('/driver/dashboard');
              }
            }
          }
          break;
          
        case 'SIGNED_OUT':
          setSession(null);
          setUser(null);
          setProfile(null);
          if (window.location.pathname !== '/login') {
            router.push('/login');
          }
          break;
          
        case 'TOKEN_REFRESHED':
        case 'USER_UPDATED':
          if (session?.user) {
            setSession(session);
            setUser(session.user);
            await fetchProfile(session.user.id);
          }
          break;
      }
      
      setLoading(false);
    });

    // Set up session refresh interval
    const refreshInterval = setInterval(async () => {
      if (!mounted) return;
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session refresh error:', error);
          // If session expired, clear state and redirect to login
          if (error.message?.includes('refresh_token') || error.message?.includes('expired')) {
            setSession(null);
            setUser(null);
            setProfile(null);
            if (window.location.pathname !== '/login') {
              router.push('/login');
            }
          }
        } else if (session) {
          // Refresh the session if it's about to expire
          const expiresAt = session.expires_at;
          if (expiresAt) {
            const expiresIn = expiresAt * 1000 - Date.now();
            // Refresh if less than 5 minutes remaining
            if (expiresIn < 5 * 60 * 1000) {
              const { data, error } = await supabase.auth.refreshSession();
              if (!error && data.session) {
                setSession(data.session);
                setUser(data.session.user);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error in refresh interval:', error);
      }
    }, 60000); // Check every minute

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [router]);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error('No user returned from sign in');
      }

      // Set session and user immediately
      setSession(data.session);
      setUser(data.user);

      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        throw new Error('Could not fetch user profile');
      }

      if (!profileData) {
        throw new Error('No profile found for user');
      }

      setProfile(profileData);
      enqueueSnackbar('Login successful', { variant: 'success' });
      
      // Navigate based on role
      setTimeout(() => {
        if (profileData.is_admin) {
          router.push('/admin/dashboard');
        } else {
          router.push('/driver/dashboard');
        }
      }, 100);
      
    } catch (error: any) {
      console.error('Sign in error:', error);
      setLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      setProfile(null);
      setSession(null);
      
      enqueueSnackbar('Logged out successfully', { variant: 'info' });
      router.push('/login');
    } catch (error: any) {
      console.error('Sign out error:', error);
      enqueueSnackbar(error.message || 'Logout failed', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const value = {
    user,
    profile,
    session,
    loading,
    isAdmin: profile?.is_admin || false,
    signIn,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}