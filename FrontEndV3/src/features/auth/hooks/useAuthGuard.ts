import { useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import type { SystemRole } from '../types/auth.types';

/**
 * Presentation-only guard state. Route/UI may use this to display loading,
 * sign-in prompts or access-denied views. Backend still enforces all rights.
 * Shop OWNER/STAFF permissions must be fetched for a specific shop from BE;
 * systemRole alone does not imply shop membership.
 */
export function useAuthGuard(requiredRole?: SystemRole) {
  const { status, user, isAuthenticated } = useAuth();
  return useMemo(() => {
    const loading = status === 'loading';
    const signedIn = isAuthenticated && user !== null;
    const allowed = signedIn && (!requiredRole || user.systemRole === requiredRole);
    return {
      loading,
      signedIn,
      allowed,
      needsLogin: !loading && !signedIn,
      forbidden: !loading && signedIn && !allowed,
    };
  }, [status, user, isAuthenticated, requiredRole]);
}