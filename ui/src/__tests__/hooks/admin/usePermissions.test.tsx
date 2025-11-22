/**
 * Tests for usePermissions hooks
 * Tests permission management operations (get, grant, revoke)
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useGetPermissions,
  useGrantPermission,
  useRevokePermission,
  useListPermissions,
} from '../../../hooks/admin/usePermissions';
import { createTestQueryClient } from '../../../test-utils/testUtils';
import {
  createMockPermission,
  createMockPermissionsResponse,
  MOCK_403_ERROR,
  MOCK_409_ERROR,
} from '../../../test-utils/mockData';
import { SecurableType, Privilege } from '../../../types/api/catalog.gen';

// Mock the route function
const mockRouteCall = jest.fn();
jest.mock('../../../utils/openapi', () => ({
  route: () => ({
    call: mockRouteCall,
  }),
  isError: jest.fn(),
  assertNever: jest.fn(),
}));

describe('usePermissions', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    mockRouteCall.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Wrapper component for tests
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('useGetPermissions', () => {
    it('should fetch permissions for a resource', async () => {
      const mockPermissions = [
        createMockPermission({ principal: 'user1@example.com', privileges: [Privilege.CREATE_CATALOG] }),
        createMockPermission({ principal: 'user2@example.com', privileges: [Privilege.USE_CATALOG] }),
      ];
      const mockResponse = createMockPermissionsResponse(mockPermissions);
      mockRouteCall.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(
        () =>
          useGetPermissions({
            resourceType: SecurableType.metastore,
            resourceName: 'metastore',
          }),
        { wrapper }
      );

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockResponse);
      expect(result.current.error).toBe(null);
      expect(mockRouteCall).toHaveBeenCalledTimes(1);
    });

    it('should handle errors when fetching permissions', async () => {
      mockRouteCall.mockRejectedValue(MOCK_403_ERROR);

      const { result } = renderHook(
        () =>
          useGetPermissions({
            resourceType: SecurableType.metastore,
            resourceName: 'metastore',
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it('should refetch permissions when requested', async () => {
      const mockPermissions = [
        createMockPermission({ principal: 'user@example.com' }),
      ];
      const mockResponse = createMockPermissionsResponse(mockPermissions);
      mockRouteCall.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(
        () =>
          useGetPermissions({
            resourceType: SecurableType.metastore,
            resourceName: 'metastore',
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockRouteCall).toHaveBeenCalledTimes(1);

      // Refetch
      result.current.refetch();

      await waitFor(() => {
        expect(mockRouteCall).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('useGrantPermission', () => {
    it('should grant permission successfully', async () => {
      mockRouteCall.mockResolvedValue({ data: undefined });

      const { result } = renderHook(
        () =>
          useGrantPermission({
            resourceType: SecurableType.metastore,
            resourceName: 'metastore',
          }),
        { wrapper }
      );

      expect(result.current.isPending).toBe(false);

      const grantData = {
        principal: 'user@example.com',
        privileges: [Privilege.CREATE_CATALOG],
      };

      result.current.mutate(grantData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockRouteCall).toHaveBeenCalledTimes(1);
    });

    it('should handle 409 duplicate permission', async () => {
      mockRouteCall.mockRejectedValue(MOCK_409_ERROR);

      const { result } = renderHook(
        () =>
          useGrantPermission({
            resourceType: SecurableType.metastore,
            resourceName: 'metastore',
          }),
        { wrapper }
      );

      const grantData = {
        principal: 'user@example.com',
        privileges: [Privilege.CREATE_CATALOG],
      };

      result.current.mutate(grantData);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should handle 403 permission denied', async () => {
      mockRouteCall.mockRejectedValue(MOCK_403_ERROR);

      const { result } = renderHook(
        () =>
          useGrantPermission({
            resourceType: SecurableType.metastore,
            resourceName: 'metastore',
          }),
        { wrapper }
      );

      const grantData = {
        principal: 'user@example.com',
        privileges: [Privilege.USE_CATALOG],
      };

      result.current.mutate(grantData);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should invalidate permissions query on success', async () => {
      mockRouteCall.mockResolvedValue({ data: undefined });

      const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(
        () =>
          useGrantPermission({
            resourceType: SecurableType.metastore,
            resourceName: 'metastore',
          }),
        { wrapper }
      );

      const grantData = {
        principal: 'user@example.com',
        privileges: [Privilege.CREATE_CATALOG],
      };

      result.current.mutate(grantData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should invalidate permissions query
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['getPermissions', SecurableType.metastore, 'metastore'],
      });
    });

    it('should grant multiple privileges at once', async () => {
      mockRouteCall.mockResolvedValue({ data: undefined });

      const { result } = renderHook(
        () =>
          useGrantPermission({
            resourceType: SecurableType.metastore,
            resourceName: 'metastore',
          }),
        { wrapper }
      );

      const grantData = {
        principal: 'user@example.com',
        privileges: [Privilege.CREATE_CATALOG, Privilege.USE_CATALOG, Privilege.CREATE_SCHEMA],
      };

      result.current.mutate(grantData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockRouteCall).toHaveBeenCalledTimes(1);
    });
  });

  describe('useRevokePermission', () => {
    it('should revoke permission successfully', async () => {
      mockRouteCall.mockResolvedValue({ data: undefined });

      const { result } = renderHook(
        () =>
          useRevokePermission({
            resourceType: SecurableType.metastore,
            resourceName: 'metastore',
          }),
        { wrapper }
      );

      expect(result.current.isPending).toBe(false);

      const revokeData = {
        principal: 'user@example.com',
        privileges: [Privilege.CREATE_CATALOG],
      };

      result.current.mutate(revokeData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockRouteCall).toHaveBeenCalledTimes(1);
    });

    it('should handle errors when revoking permission', async () => {
      const revokeError = new Error('Failed to revoke permission');
      mockRouteCall.mockRejectedValue(revokeError);

      const { result } = renderHook(
        () =>
          useRevokePermission({
            resourceType: SecurableType.metastore,
            resourceName: 'metastore',
          }),
        { wrapper }
      );

      const revokeData = {
        principal: 'user@example.com',
        privileges: [Privilege.CREATE_CATALOG],
      };

      result.current.mutate(revokeData);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should handle 403 permission denied on revoke', async () => {
      mockRouteCall.mockRejectedValue(MOCK_403_ERROR);

      const { result } = renderHook(
        () =>
          useRevokePermission({
            resourceType: SecurableType.metastore,
            resourceName: 'metastore',
          }),
        { wrapper }
      );

      const revokeData = {
        principal: 'user@example.com',
        privileges: [Privilege.USE_CATALOG],
      };

      result.current.mutate(revokeData);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should invalidate permissions query on success', async () => {
      mockRouteCall.mockResolvedValue({ data: undefined });

      const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(
        () =>
          useRevokePermission({
            resourceType: SecurableType.metastore,
            resourceName: 'metastore',
          }),
        { wrapper }
      );

      const revokeData = {
        principal: 'user@example.com',
        privileges: [Privilege.CREATE_CATALOG],
      };

      result.current.mutate(revokeData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should invalidate permissions query
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['getPermissions', SecurableType.metastore, 'metastore'],
      });
    });
  });

  describe('useListPermissions', () => {
    it('should list permissions for a principal', async () => {
      const mockPermissions = [
        createMockPermission({
          principal: 'user@example.com',
          privileges: [Privilege.CREATE_CATALOG],
        }),
        createMockPermission({
          principal: 'user@example.com',
          privileges: [Privilege.USE_CATALOG],
        }),
      ];
      const mockResponse = createMockPermissionsResponse(mockPermissions);
      mockRouteCall.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(
        () => useListPermissions('user@example.com'),
        { wrapper }
      );

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Hook transforms API response into array of permission objects
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0]).toMatchObject({
        securableType: SecurableType.metastore,
        securableName: 'metastore',
        privilege: Privilege.CREATE_CATALOG,
        principal: 'user@example.com',
      });
      expect(mockRouteCall).toHaveBeenCalledTimes(1);
    });

    it('should handle errors when listing permissions', async () => {
      mockRouteCall.mockRejectedValue(MOCK_403_ERROR);

      const { result } = renderHook(
        () => useListPermissions('user@example.com'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Hook catches errors and returns empty array
      expect(result.current.data).toEqual([]);
    });

    it('should use metastore as default resource', async () => {
      const mockResponse = createMockPermissionsResponse([]);
      mockRouteCall.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(
        () => useListPermissions('user@example.com'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify it queries metastore permissions and returns empty transformed array
      expect(result.current.data).toEqual([]);
    });
  });
});
