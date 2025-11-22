/**
 * Mock Data Factory
 * Generates consistent mock data for tests
 */

import { SecurableType, Privilege } from '../types/api/catalog.gen';
import type { UserListItem } from '../types/admin/user';

/**
 * Mock SCIM2 User Resource
 */
export function createMockUser(overrides: Partial<any> = {}) {
  return {
    id: '12345678-1234-1234-1234-123456789012',
    userName: 'test.user@example.com',
    emails: [
      {
        value: 'test.user@example.com',
        primary: true,
      },
    ],
    displayName: 'Test User',
    active: true,
    externalId: 'ext-12345',
    meta: {
      created: '2024-01-01T00:00:00Z',
      lastModified: '2024-01-01T00:00:00Z',
      resourceType: 'User',
    },
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    ...overrides,
  };
}

/**
 * Mock SCIM2 List Response
 */
export function createMockUsersListResponse(users: any[] = []) {
  return {
    totalResults: users.length,
    startIndex: 1,
    itemsPerPage: users.length,
    Resources: users,
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
  };
}

/**
 * Mock UserListItem (transformed for UI)
 */
export function createMockUserListItem(overrides: Partial<UserListItem> = {}): UserListItem {
  return {
    id: '12345678-1234-1234-1234-123456789012',
    email: 'test.user@example.com',
    displayName: 'Test User',
    status: 'Active',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    lastModified: new Date('2024-01-01T00:00:00Z'),
    photoUrl: undefined,
    ...overrides,
  };
}

/**
 * Mock Permission Assignment
 */
export function createMockPermission(overrides: Partial<any> = {}) {
  return {
    principal: 'test.user@example.com',
    privileges: [Privilege.CREATE_CATALOG],
    ...overrides,
  };
}

/**
 * Mock Permissions Response
 */
export function createMockPermissionsResponse(assignments: any[] = []) {
  return {
    privilege_assignments: assignments,
  };
}

/**
 * Common test users
 */
export const MOCK_ADMIN_USER = createMockUser({
  id: 'admin-id',
  userName: 'admin@example.com',
  emails: [{ value: 'admin@example.com', primary: true }],
  displayName: 'Admin User',
});

export const MOCK_REGULAR_USER = createMockUser({
  id: 'user-id',
  userName: 'user@example.com',
  emails: [{ value: 'user@example.com', primary: true }],
  displayName: 'Regular User',
});

/**
 * Mock error responses
 */
export const MOCK_403_ERROR = {
  response: {
    status: 403,
    data: {
      error_code: 'PERMISSION_DENIED',
      message: 'User does not have permission to perform this action',
    },
  },
  status: 403,
  message: 'Permission denied',
};

export const MOCK_401_ERROR = {
  response: {
    status: 401,
    data: {
      error_code: 'UNAUTHENTICATED',
      message: 'Authentication required',
    },
  },
  status: 401,
  message: 'Unauthenticated',
};

export const MOCK_404_ERROR = {
  response: {
    status: 404,
    data: {
      error_code: 'RESOURCE_NOT_FOUND',
      message: 'Resource not found',
    },
  },
  status: 404,
  message: 'Not found',
};

export const MOCK_409_ERROR = {
  response: {
    status: 409,
    data: {
      error_code: 'RESOURCE_ALREADY_EXISTS',
      message: 'Resource already exists',
    },
  },
  status: 409,
  message: 'Conflict',
};
