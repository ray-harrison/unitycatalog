/**
 * Admin authentication hook
 * Verifies user has OWNER privilege on the metastore
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/auth-context';
import { CLIENT } from '../../context/client';
import { route } from '../../utils/openapi';
import { UC_AUTH_API_PREFIX } from '../../utils/constants';
import type { paths as ControlApi } from '../../types/api/control.gen';
import type { Route } from '../../utils/openapi';
import type { AdminAuthState } from '../../types/admin/user';

/**
 * Hook to check if current user has admin privileges
 * Admin = OWNER privilege on metastore (verified by attempting to list users)
 * 
 * Note: We check admin privileges by attempting to call the list users API,
 * which requires METASTORE OWNER privilege. If the call succeeds, the user
 * has admin privileges. If it returns 403/401, they don't.
 */
export function useAdminAuth(): AdminAuthState {
  const { currentUser } = useAuth();
  
  // Try to list users - this requires METASTORE OWNER privilege
  const {
    data: usersData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['adminCheck'],
    queryFn: async () => {
      try {
        const response = await (route as Route<ControlApi>)({
          client: CLIENT,
          request: {
            path: '/scim2/Users',
            method: 'get',
          },
          config: {
            baseURL: UC_AUTH_API_PREFIX,
          },
          errorMessage: 'Failed to check admin privileges',
        }).call();
        return { success: true, data: response };
      } catch (err: any) {
        // Catch 403/401 errors
        return { success: false, status: err?.response?.status || err?.status || 500 };
      }
    },
    enabled: !!currentUser,
    retry: false,
    staleTime: 0,
  });

  const hasOwnerPrivilege = useMemo(() => {
    if (!currentUser || !usersData) return false;
    
    // If successful, user has OWNER privilege
    return usersData.success === true;
  }, [currentUser, usersData]);

  return {
    isAuthenticated: !!currentUser,
    userEmail: currentUser?.emails?.[0]?.value || null,
    hasOwnerPrivilege,
    isLoading,
    error: error instanceof Error ? error : null,
  };
}
