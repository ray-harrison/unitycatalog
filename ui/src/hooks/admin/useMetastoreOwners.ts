/**
 * Hook to list principals with OWNER-level privileges on the metastore.
 *
 * Because the OpenAPI Privilege enum currently omits an explicit OWNER value,
 * we perform a relaxed string match on returned privilege strings containing
 * 'OWNER'. Backend responses that include values like 'METASTORE OWNER',
 * 'OWNER', or 'OWNERSHIP' will be captured. This is defensive and will not
 * throw if unknown privilege strings are encountered.
 */
import { useQuery } from '@tanstack/react-query';
import { CLIENT } from '../../context/client';
import { route, isError, assertNever } from '../../utils/openapi';
import type { paths as CatalogApi } from '../../types/api/catalog.gen';
import { SecurableType } from '../../types/api/catalog.gen';
import type { Route, SuccessResponseBody } from '../../utils/openapi';

interface MetastorePermissionsResponse extends SuccessResponseBody<CatalogApi, '/permissions/{securable_type}/{full_name}', 'get'> {}

export function useMetastoreOwners() {
  return useQuery<{ owners: string[] }>({
    queryKey: ['metastoreOwners'],
    queryFn: async () => {
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
        errorMessage: 'Failed to fetch metastore permissions',
      }).call();
      if (isError(response)) {
        return assertNever(response.data.status);
      }
      const data = response.data as MetastorePermissionsResponse;
      const owners = (data.privilege_assignments || [])
        .filter((assignment) => {
          const privileges = assignment.privileges || [];
          return privileges.some((p) => typeof p === 'string' && p.toUpperCase().includes('OWNER'));
        })
        .map((a) => a.principal || '')
        .filter((p) => p);
      return { owners };
    },
    staleTime: 0, // security sensitive
  });
}

/**
 * Convenience hook: determine if a given principal is the last metastore owner.
 */
export function useIsLastMetastoreOwner(principal: string | undefined) {
  const { data, isLoading, error } = useMetastoreOwners();
  const owners = data?.owners || [];
  const isLastOwner = !!principal && owners.length === 1 && owners[0] === principal;
  return { isLastOwner, owners, isLoading, error };
}