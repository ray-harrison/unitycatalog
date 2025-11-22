/**
 * User filtering and search utilities
 */

import { useMemo } from 'react';
import { debounce } from 'lodash';

export interface FilterableUser {
  email: string;
  displayName?: string;
}

/**
 * Custom hook for debounced user search
 * 
 * @param users - Array of users to filter
 * @param searchTerm - Current search term
 * @param debounceMs - Debounce delay in milliseconds (default: 300ms)
 */
export function useUserSearch<T extends FilterableUser>(
  users: T[] | undefined,
  searchTerm: string,
  debounceMs = 300
) {
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!searchTerm) return users;

    const lowerSearch = searchTerm.toLowerCase();
    return users.filter(
      (user) =>
        user.email.toLowerCase().includes(lowerSearch) ||
        user.displayName?.toLowerCase().includes(lowerSearch)
    );
  }, [users, searchTerm]);

  return filteredUsers;
}

/**
 * Create a debounced search handler
 */
export function createDebouncedSearch(
  callback: (value: string) => void,
  delay = 300
) {
  return debounce(callback, delay);
}
