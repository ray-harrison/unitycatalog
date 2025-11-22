/**
 * Tests for user filtering and search utilities
 * Tests search filtering and debounced search functionality
 */

import { renderHook } from '@testing-library/react';
import { useUserSearch, createDebouncedSearch } from '../../../utils/admin/userFilters';

describe('User Filters Utilities', () => {
  describe('useUserSearch', () => {
    const mockUsers = [
      { email: 'alice@example.com', displayName: 'Alice Smith' },
      { email: 'bob@example.com', displayName: 'Bob Jones' },
      { email: 'charlie@test.com', displayName: 'Charlie Brown' },
      { email: 'diana@example.com', displayName: 'Diana Prince' },
      { email: 'eve@test.com' }, // No display name
    ];

    it('should return all users when search term is empty', () => {
      const { result } = renderHook(() =>
        useUserSearch(mockUsers, '')
      );

      expect(result.current).toHaveLength(5);
      expect(result.current).toEqual(mockUsers);
    });

    it('should return empty array when users is undefined', () => {
      const { result } = renderHook(() =>
        useUserSearch(undefined, 'alice')
      );

      expect(result.current).toEqual([]);
    });

    it('should filter users by email (case-insensitive)', () => {
      const { result } = renderHook(() =>
        useUserSearch(mockUsers, 'alice')
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].email).toBe('alice@example.com');
    });

    it('should filter users by email with uppercase search', () => {
      const { result } = renderHook(() =>
        useUserSearch(mockUsers, 'ALICE')
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].email).toBe('alice@example.com');
    });

    it('should filter users by display name (case-insensitive)', () => {
      const { result } = renderHook(() =>
        useUserSearch(mockUsers, 'smith')
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].displayName).toBe('Alice Smith');
    });

    it('should filter users by display name with uppercase search', () => {
      const { result } = renderHook(() =>
        useUserSearch(mockUsers, 'SMITH')
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].displayName).toBe('Alice Smith');
    });

    it('should filter users by partial email match', () => {
      const { result } = renderHook(() =>
        useUserSearch(mockUsers, '@example.com')
      );

      expect(result.current).toHaveLength(3);
      expect(result.current.map(u => u.email)).toEqual([
        'alice@example.com',
        'bob@example.com',
        'diana@example.com',
      ]);
    });

    it('should filter users by partial display name match', () => {
      const { result } = renderHook(() =>
        useUserSearch(mockUsers, 'brown')
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].displayName).toBe('Charlie Brown');
    });

    it('should return multiple matches', () => {
      const { result } = renderHook(() =>
        useUserSearch(mockUsers, 'test.com')
      );

      expect(result.current).toHaveLength(2);
      expect(result.current.map(u => u.email)).toEqual([
        'charlie@test.com',
        'eve@test.com',
      ]);
    });

    it('should return empty array when no matches found', () => {
      const { result } = renderHook(() =>
        useUserSearch(mockUsers, 'nonexistent')
      );

      expect(result.current).toEqual([]);
    });

    it('should handle users without display names', () => {
      const { result } = renderHook(() =>
        useUserSearch(mockUsers, 'eve')
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].email).toBe('eve@test.com');
      expect(result.current[0].displayName).toBeUndefined();
    });

    it('should match on either email or display name', () => {
      const { result: result1 } = renderHook(() =>
        useUserSearch(mockUsers, 'bob')
      );
      expect(result1.current).toHaveLength(1);

      const { result: result2 } = renderHook(() =>
        useUserSearch(mockUsers, 'jones')
      );
      expect(result2.current).toHaveLength(1);
    });

    it('should recompute when search term changes', () => {
      const { result, rerender } = renderHook(
        ({ searchTerm }) => useUserSearch(mockUsers, searchTerm),
        { initialProps: { searchTerm: 'alice' } }
      );

      expect(result.current).toHaveLength(1);

      rerender({ searchTerm: 'bob' });
      expect(result.current).toHaveLength(1);
      expect(result.current[0].email).toBe('bob@example.com');
    });

    it('should recompute when users array changes', () => {
      const { result, rerender } = renderHook(
        ({ users }) => useUserSearch(users, 'alice'),
        { initialProps: { users: mockUsers } }
      );

      expect(result.current).toHaveLength(1);

      const newUsers = [
        { email: 'alice@new.com', displayName: 'Alice New' },
      ];
      rerender({ users: newUsers });
      expect(result.current).toHaveLength(1);
      expect(result.current[0].email).toBe('alice@new.com');
    });

    it('should handle empty users array', () => {
      const { result } = renderHook(() =>
        useUserSearch([], 'alice')
      );

      expect(result.current).toEqual([]);
    });

    it('should use custom debounce delay', () => {
      const { result } = renderHook(() =>
        useUserSearch(mockUsers, 'alice', 500)
      );

      // Should work the same regardless of debounce setting
      expect(result.current).toHaveLength(1);
      expect(result.current[0].email).toBe('alice@example.com');
    });
  });

  describe('createDebouncedSearch', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('should debounce function calls', () => {
      const callback = jest.fn();
      const debouncedFn = createDebouncedSearch(callback, 300);

      debouncedFn('test1');
      debouncedFn('test2');
      debouncedFn('test3');

      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(300);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('test3');
    });

    it('should use default delay of 300ms', () => {
      const callback = jest.fn();
      const debouncedFn = createDebouncedSearch(callback);

      debouncedFn('test');

      jest.advanceTimersByTime(299);
      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should use custom delay', () => {
      const callback = jest.fn();
      const debouncedFn = createDebouncedSearch(callback, 500);

      debouncedFn('test');

      jest.advanceTimersByTime(499);
      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should reset timer on new calls', () => {
      const callback = jest.fn();
      const debouncedFn = createDebouncedSearch(callback, 300);

      debouncedFn('test1');
      jest.advanceTimersByTime(200);

      debouncedFn('test2');
      jest.advanceTimersByTime(200);

      debouncedFn('test3');
      jest.advanceTimersByTime(200);

      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('test3');
    });

    it('should handle multiple debounced calls over time', () => {
      const callback = jest.fn();
      const debouncedFn = createDebouncedSearch(callback, 300);

      debouncedFn('first');
      jest.advanceTimersByTime(300);
      expect(callback).toHaveBeenCalledWith('first');

      debouncedFn('second');
      jest.advanceTimersByTime(300);
      expect(callback).toHaveBeenCalledWith('second');

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should pass correct value to callback', () => {
      const callback = jest.fn();
      const debouncedFn = createDebouncedSearch(callback, 300);

      const searchValue = 'alice@example.com';
      debouncedFn(searchValue);

      jest.advanceTimersByTime(300);

      expect(callback).toHaveBeenCalledWith(searchValue);
    });
  });
});
