import { useContext } from 'react';
import { AuthContext, AuthContextValue } from '../context/AuthContext';

/**
 * Custom hook to access Azure AD authentication context.
 * Provides authentication state and methods (login, logout, getAccessToken).
 *
 * Must be used within a component wrapped by AuthContextProvider.
 *
 * @returns Authentication context value
 * @throws Error if used outside AuthContextProvider
 */
export function useAzureAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAzureAuth must be used within AuthContextProvider');
  }

  return context;
}
