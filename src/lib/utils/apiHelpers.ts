import { supabase } from '@/lib/supabase/client';

/**
 * Wrapper for Supabase queries with automatic session refresh
 */
export async function withSessionRefresh<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  // First attempt
  let result = await queryFn();
  
  // If we get an auth error, try refreshing the session
  if (result.error?.message?.includes('JWT') || 
      result.error?.message?.includes('token') ||
      result.error?.status === 401) {
    
    console.log('Session error detected, attempting refresh...');
    
    // Try to refresh the session
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError) {
      console.error('Session refresh failed:', refreshError);
      // Return original error if refresh fails
      return result;
    }
    
    if (refreshData.session) {
      console.log('Session refreshed successfully');
      // Retry the original query
      result = await queryFn();
    }
  }
  
  return result;
}

/**
 * Check if user is still authenticated and refresh if needed
 */
export async function checkAndRefreshSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error || !session) {
    // Try to refresh
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError || !refreshData.session) {
      // Session is truly expired, redirect to login
      window.location.href = '/login';
      return null;
    }
    
    return refreshData.session;
  }
  
  // Check if session is about to expire (less than 5 minutes)
  const expiresAt = session.expires_at;
  if (expiresAt) {
    const expiresIn = expiresAt * 1000 - Date.now();
    if (expiresIn < 5 * 60 * 1000) {
      // Proactively refresh
      const { data: refreshData } = await supabase.auth.refreshSession();
      return refreshData.session || session;
    }
  }
  
  return session;
}

/**
 * Supabase query wrapper with error handling
 */
export async function safeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  options?: {
    retries?: number;
    onError?: (error: any) => void;
  }
): Promise<{ data: T | null; error: any; success: boolean }> {
  const maxRetries = options?.retries ?? 1;
  let lastError = null;
  
  for (let i = 0; i < maxRetries; i++) {
    const result = await withSessionRefresh(queryFn);
    
    if (!result.error) {
      return { ...result, success: true };
    }
    
    lastError = result.error;
    
    // Don't retry for certain errors
    if (result.error?.code === 'PGRST116' || // RLS violation
        result.error?.code === '23505' || // Unique constraint
        result.error?.code === '23503') { // Foreign key violation
      break;
    }
    
    // Wait before retrying
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  
  if (options?.onError) {
    options.onError(lastError);
  }
  
  return { data: null, error: lastError, success: false };
}