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

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        }
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        console.log('Auth state changed:', event);
        
        // Handle different auth events
        if (event === 'SIGNED_IN') {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            await fetchProfile(session.user.id);
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
          router.push('/login');
        } else if (event === 'TOKEN_REFRESHED') {
          setSession(session);
          setUser(session?.user ?? null);
        } else if (event === 'USER_UPDATED') {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            await fetchProfile(session.user.id);
          }
        }
        
        setLoading(false);
      }
    });

    // Set up session refresh interval
    const refreshInterval = setInterval(async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Session refresh error:', error);
        // If session expired, redirect to login
        if (error.message.includes('refresh_token') || error.message.includes('expired')) {
          router.push('/login');
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
    }, 60000); // Check every minute

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [router]);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        await fetchProfile(data.user.id);
        enqueueSnackbar('Login successful', { variant: 'success' });
        
        // Redirect based on role
        if (profile?.is_admin) {
          router.push('/admin/dashboard');
        } else {
          router.push('/driver/dashboard');
        }
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      enqueueSnackbar(error.message || 'Login failed', { variant: 'error' });
      throw error;
    }
  };

  const signOut = async () => {
    try {
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