/**
 * React Query hooks for permission management operations
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CLIENT } from '../../context/client';
import { route, isError, assertNever } from '../../utils/openapi';
import type { paths as CatalogApi } from '../../types/api/catalog.gen';
import {
  SecurableType,
  Privilege,
} from '../../types/api/catalog.gen';
import type { Route, SuccessResponseBody } from '../../utils/openapi';

/**
 * Hook to get permissions for a resource
 */
export interface UseGetPermissionsArgs {
  resourceType: SecurableType;
  resourceName: string;
}

export function useGetPermissions({
  resourceType,
  resourceName,
}: UseGetPermissionsArgs) {
  return useQuery<
    SuccessResponseBody<
      CatalogApi,
      '/permissions/{securable_type}/{full_name}',
      'get'
    >
  >({
    queryKey: ['getPermissions', resourceType, resourceName],
    queryFn: async () => {
      const response = await (route as Route<CatalogApi>)({
        client: CLIENT,
        request: {
          path: '/permissions/{securable_type}/{full_name}',
          method: 'get',
          params: {
            paths: {
              securable_type: resourceType,
              full_name: resourceName,
            },
          },
        },
        errorMessage: 'Failed to fetch permissions',
      }).call();
      if (isError(response)) {
        return assertNever(response.data.status);
      }
      return response.data;
    },
    staleTime: 0, // Always fresh - permissions are security-critical
  });
}

/**
 * Hook to grant permissions to a user
 */
export interface UseGrantPermissionArgs {
  resourceType: SecurableType;
  resourceName: string;
}

export interface GrantPermissionParams {
  principal: string;
  privileges: Privilege[];
}

export function useGrantPermission({
  resourceType,
  resourceName,
}: UseGrantPermissionArgs) {
  const queryClient = useQueryClient();

  return useMutation<
    SuccessResponseBody<
      CatalogApi,
      '/permissions/{securable_type}/{full_name}',
      'patch'
    >,
    Error,
    GrantPermissionParams
  >({
    mutationFn: async ({ principal, privileges }: GrantPermissionParams) => {
      const response = await (route as Route<CatalogApi>)({
        client: CLIENT,
        request: {
          path: '/permissions/{securable_type}/{full_name}',
          method: 'patch',
          params: {
            paths: {
              securable_type: resourceType,
              full_name: resourceName,
            },
            body: {
              changes: [
                {
                  principal,
                  add: privileges,
                  remove: [],
                },
              ],
            },
          },
        },
        errorMessage: 'Failed to grant permission',
      }).call();
      if (isError(response)) {
        return assertNever(response.data.status);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['getPermissions', resourceType, resourceName],
      });
    },
  });
}

/**
 * Hook to revoke permissions from a user
 */
export interface UseRevokePermissionArgs {
  resourceType: SecurableType;
  resourceName: string;
}

export interface RevokePermissionParams {
  principal: string;
  privileges: Privilege[];
}

export function useRevokePermission({
  resourceType,
  resourceName,
}: UseRevokePermissionArgs) {
  const queryClient = useQueryClient();

  return useMutation<
    SuccessResponseBody<
      CatalogApi,
      '/permissions/{securable_type}/{full_name}',
      'patch'
    >,
    Error,
    RevokePermissionParams
  >({
    mutationFn: async ({ principal, privileges }: RevokePermissionParams) => {
      const response = await (route as Route<CatalogApi>)({
        client: CLIENT,
        request: {
          path: '/permissions/{securable_type}/{full_name}',
          method: 'patch',
          params: {
            paths: {
              securable_type: resourceType,
              full_name: resourceName,
            },
            body: {
              changes: [
                {
                  principal,
                  add: [],
                  remove: privileges,
                },
              ],
            },
          },
        },
        errorMessage: 'Failed to revoke permission',
      }).call();
      if (isError(response)) {
        return assertNever(response.data.status);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['getPermissions', resourceType, resourceName],
      });
    },
  });
}

/**
 * Hook to list all permissions for a specific user (principal)
 */
export function useListPermissions(principal: string) {
  return useQuery({
    queryKey: ['listPermissions', principal],
    queryFn: async () => {
      const permissions: Array<{
        securableType: SecurableType;
        securableName: string;
        privilege: Privilege;
        principal: string;
      }> = [];

      // Query metastore permissions
      try {
        const response = await (route as Route<CatalogApi>)({
          client: CLIENT,
          request: {
            path: '/permissions/{securable_type}/{full_name}',
            method: 'get',
            params: {
              paths: {
                securable_type: SecurableType.metastore,
                full_name: 'metastore',
              },
            },
          },
          errorMessage: 'Failed to list permissions',
        }).call();

        if (!isError(response)) {
          const userAssignments = response.data.privilege_assignments?.filter(
            (assignment) => assignment.principal === principal
          ) || [];

          userAssignments.forEach((assignment) => {
            assignment.privileges?.forEach((privilege) => {
              permissions.push({
                securableType: SecurableType.metastore,
                securableName: 'metastore',
                privilege: privilege as Privilege,
                principal,
              });
            });
          });
        }
      } catch (err) {
        console.error('Error fetching permissions:', err);
      }

      return permissions;
    },
    staleTime: 0,
  });
}
