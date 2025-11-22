/**
 * React Query hooks for user management operations (SCIM2 API)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CLIENT } from '../../context/client';
import { route, isError, assertNever } from '../../utils/openapi';
import { UC_AUTH_API_PREFIX } from '../../utils/constants';
import type { paths as ControlApi } from '../../types/api/control.gen';
import type {
  PathParam,
  RequestBody,
  Route,
  SuccessResponseBody,
} from '../../utils/openapi';

/**
 * Hook to list all users (SCIM2 API)
 */
export function useListUsers() {
  return useQuery({
    queryKey: ['listUsers'],
    queryFn: async () => {
      const response = await (route as Route<ControlApi>)({
        client: CLIENT,
        request: {
          path: '/scim2/Users',
          method: 'get',
        },
        config: {
          baseURL: UC_AUTH_API_PREFIX,
        },
        errorMessage: 'Failed to list users',
      }).call();
      if (isError(response)) {
        return assertNever(response.data.status);
      }
      return response.data;
    },
  });
}

/**
 * Hook to get a single user by ID
 */
export interface UseGetUserArgs
  extends PathParam<ControlApi, '/scim2/Users/{id}', 'get'> {}

export function useGetUser({ id }: UseGetUserArgs) {
  return useQuery({
    queryKey: ['getUser', id],
    queryFn: async () => {
      const response = await (route as Route<ControlApi>)({
        client: CLIENT,
        request: {
          path: '/scim2/Users/{id}',
          method: 'get',
          params: {
            paths: {
              id,
            },
          },
        },
        config: {
          baseURL: UC_AUTH_API_PREFIX,
        },
        errorMessage: `Failed to fetch user ${id}`,
      }).call();
      if (isError(response)) {
        return assertNever(response.data.status);
      }
      return response.data;
    },
  });
}

/**
 * Hook to create a new user
 */
export interface CreateUserMutationParams {
  email: string;
  displayName: string;
  externalId?: string;
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      email,
      displayName,
      externalId,
    }: CreateUserMutationParams) => {
      const response = await (route as Route<ControlApi>)({
        client: CLIENT,
        request: {
          path: '/scim2/Users',
          method: 'post',
          params: {
            body: {
              displayName,
              externalId,
              emails: [
                {
                  value: email,
                  primary: true,
                },
              ],
            },
          },
        },
        config: {
          baseURL: UC_AUTH_API_PREFIX,
        },
        errorMessage: 'Failed to create user',
      }).call();
      if (isError(response)) {
        return assertNever(response.data.status);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listUsers'] });
    },
  });
}

/**
 * Hook to delete a user
 */
export interface UseDeleteUserArgs {
  id: string;
}

export function useDeleteUser({ id }: UseDeleteUserArgs) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const response = await (route as Route<ControlApi>)({
        client: CLIENT,
        request: {
          path: '/scim2/Users/{id}',
          method: 'delete',
          params: {
            paths: {
              id,
            },
          },
        },
        config: {
          baseURL: UC_AUTH_API_PREFIX,
        },
        errorMessage: 'Failed to delete user',
      }).call();
      if (isError(response)) {
        return assertNever(response.data.status);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listUsers'] });
      queryClient.invalidateQueries({ queryKey: ['getUser', id] });
    },
  });
}
