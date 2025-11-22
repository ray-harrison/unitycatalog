/**
 * Tests for useAdminAuth hook
 * Verifies admin privilege checking logic
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAdminAuth } from '../../../hooks/admin/useAdminAuth';
import { createTestQueryClient } from '../../../test-utils/testUtils';
import {
  createMockUsersListResponse,
  MOCK_ADMIN_USER,
  MOCK_403_ERROR,
} from '../../../test-utils/mockData';

// Mock the route function
const mockRouteCall = jest.fn();
jest.mock('../../../utils/openapi', () => ({
  route: () => ({
    call: mockRouteCall,
  }),
  isError: jest.fn(),
  assertNever: jest.fn(),
}));

// Mock the auth context
const mockUseAuth = jest.fn();
jest.mock('../../../context/auth-context', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('useAdminAuth', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    mockRouteCall.mockClear();
    mockUseAuth.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Wrapper component for tests
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('Admin privilege detection', () => {
    it('should detect admin privileges when list users succeeds', async () => {
      // Mock authenticated user
      mockUseAuth.mockReturnValue({
        currentUser: MOCK_ADMIN_USER,
      });

      // Mock successful API call
      const mockUsersResponse = createMockUsersListResponse([MOCK_ADMIN_USER]);
      mockRouteCall.mockResolvedValue(mockUsersResponse);

      const { result } = renderHook(() => useAdminAuth(), {
        wrapper,
      });

      // Initial state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.hasOwnerPrivilege).toBe(false);

      // Wait for query to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have admin privileges
      expect(result.current.hasOwnerPrivilege).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.userEmail).toBe('admin@example.com');
      expect(result.current.error).toBe(null);
    });

    it('should deny admin when list users returns 403', async () => {
      // Mock authenticated user
      mockUseAuth.mockReturnValue({
        currentUser: MOCK_ADMIN_USER,
      });

      // Mock API call that returns 403 (no admin privileges)
      mockRouteCall.mockRejectedValue(MOCK_403_ERROR);

      const { result } = renderHook(() => useAdminAuth(), {
        wrapper,
      });

      // Wait for query to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should NOT have admin privileges
      expect(result.current.hasOwnerPrivilege).toBe(false);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.userEmail).toBe('admin@example.com');
    });

    it('should return loading state while checking privileges', async () => {
      // Mock authenticated user
      mockUseAuth.mockReturnValue({
        currentUser: MOCK_ADMIN_USER,
      });

      // Mock slow API call
      let resolvePromise: (value: any) => void;
      const slowPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockRouteCall.mockReturnValue(slowPromise);

      const { result } = renderHook(() => useAdminAuth(), {
        wrapper,
      });

      // Should be loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.hasOwnerPrivilege).toBe(false);

      // Resolve the promise
      const mockUsersResponse = createMockUsersListResponse([MOCK_ADMIN_USER]);
      resolvePromise!(mockUsersResponse);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasOwnerPrivilege).toBe(true);
    });
  });

  describe('Unauthenticated users', () => {
    it('should not check privileges when user is not authenticated', async () => {
      // Mock no authenticated user
      mockUseAuth.mockReturnValue({
        currentUser: null,
      });

      const { result } = renderHook(() => useAdminAuth(), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.hasOwnerPrivilege).toBe(false);
      expect(result.current.userEmail).toBe(null);
      
      // API should not be called
      expect(mockRouteCall).not.toHaveBeenCalled();
    });
  });

  describe('User email extraction', () => {
    it('should extract user email from auth context', async () => {
      const customUser = {
        ...MOCK_ADMIN_USER,
        emails: [{ value: 'custom@example.com', primary: true }],
      };

      mockUseAuth.mockReturnValue({
        currentUser: customUser,
      });

      mockRouteCall.mockResolvedValue(createMockUsersListResponse([customUser]));

      const { result } = renderHook(() => useAdminAuth(), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.userEmail).toBe('custom@example.com');
    });

    it('should return null email when user has no email', async () => {
      const userWithoutEmail = {
        ...MOCK_ADMIN_USER,
        emails: [],
      };

      mockUseAuth.mockReturnValue({
        currentUser: userWithoutEmail,
      });

      mockRouteCall.mockResolvedValue(createMockUsersListResponse([userWithoutEmail]));

      const { result } = renderHook(() => useAdminAuth(), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.userEmail).toBe(null);
    });
  });
});
