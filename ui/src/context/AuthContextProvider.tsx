import React, { useState, useEffect, ReactNode } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { AccountInfo } from '@azure/msal-browser';
import { AuthContext, AuthContextValue } from './AuthContext';
import { msalConfig } from '../utils/msalConfig';

interface AuthContextProviderProps {
  children: ReactNode;
}

/**
 * Authentication context provider component.
 * Manages Azure AD authentication state using MSAL hooks.
 * Wrap your app with this component to enable authentication.
 */
export function AuthContextProvider({ children }: AuthContextProviderProps) {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [user, setUser] = useState<AccountInfo | null>(null);

  // Update user state when accounts change
  useEffect(() => {
    if (accounts.length > 0) {
      setUser(accounts[0]);
      setIsLoading(false);
    } else {
      setUser(null);
      setIsLoading(false);
    }
  }, [accounts]);

  /**
   * Initiate Azure AD login flow.
   * Uses popup method to avoid full page redirect.
   */
  const login = async () => {
    try {
      setError(null);
      setIsLoading(true);

      const loginRequest = {
        scopes: msalConfig.scopes,
        prompt: 'select_account', // Allow user to select account
      };

      await instance.loginPopup(loginRequest);
      // User state will be updated by useEffect when accounts change
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Login failed');
      setError(error);
      console.error('Azure AD login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout current user.
   * Clears local session and redirects to Azure AD logout.
   */
  const logout = async () => {
    try {
      setError(null);
      setIsLoading(true);

      const logoutRequest = {
        account: user,
        postLogoutRedirectUri: msalConfig.postLogoutRedirectUri,
      };

      await instance.logoutPopup(logoutRequest);
      setUser(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Logout failed');
      setError(error);
      console.error('Azure AD logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Get access token for API requests.
   * Attempts silent token acquisition first, falls back to popup if needed.
   */
  const getAccessToken = async (): Promise<string> => {
    try {
      setError(null);

      if (!user) {
        throw new Error('No authenticated user');
      }

      const tokenRequest = {
        scopes: msalConfig.scopes,
        account: user,
      };

      // Try silent token acquisition first
      try {
        const response = await instance.acquireTokenSilent(tokenRequest);
        return response.accessToken;
      } catch (silentError) {
        console.warn('Silent token acquisition failed, trying popup:', silentError);

        // Fall back to interactive popup
        const response = await instance.acquireTokenPopup(tokenRequest);
        return response.accessToken;
      }
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Token acquisition failed');
      setError(error);
      console.error('Azure AD token acquisition error:', error);
      throw error;
    }
  };

  const contextValue: AuthContextValue = {
    isAuthenticated,
    isLoading,
    user,
    error,
    login,
    logout,
    getAccessToken,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
