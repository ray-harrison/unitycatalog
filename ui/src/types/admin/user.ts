/**
 * UI-specific domain types for user management
 */

import type { FilterableUser } from '../../utils/admin/userFilters';

export interface UserListItem extends FilterableUser {
  id: string;
  email: string;  // Primary email from emails array
  displayName: string;
  status: 'Active' | 'Disabled';
  createdAt: Date;
  lastModified: Date;
  photoUrl?: string;
}

export interface AdminAuthState {
  isAuthenticated: boolean;
  userEmail: string | null;
  hasOwnerPrivilege: boolean;
  isLoading: boolean;
  error: Error | null;
}
