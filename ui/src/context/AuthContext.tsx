import { createContext } from 'react';
import { AccountInfo } from '@azure/msal-browser';

/**
 * Authentication context value interface.
 * Provides authentication state and methods to child components.
 */
export interface AuthContextValue {
  /** Whether the user is authenticated */
  isAuthenticated: boolean;

  /** Whether authentication is in progress */
  isLoading: boolean;

  /** Authenticated user information (null if not authenticated) */
  user: AccountInfo | null;

  /** Authentication error (null if no error) */
  error: Error | null;

  /**
   * Initiate login flow.
   * Opens popup or redirects to Azure AD login page.
   */
  login: () => Promise<void>;

  /**
   * Logout the current user.
   * Clears local session and optionally redirects to Azure AD logout.
   */
  logout: () => Promise<void>;

  /**
   * Get access token for API requests.
   * Attempts silent token acquisition, falls back to interactive login if needed.
   *
   * @returns Access token string
   * @throws Error if token acquisition fails
   */
  getAccessToken: () => Promise<string>;
}

/**
 * Default context value (used before provider is mounted).
 */
const defaultContextValue: AuthContextValue = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  error: null,
  login: async () => {
    throw new Error('AuthContext not initialized. Wrap app with AuthContextProvider.');
  },
  logout: async () => {
    throw new Error('AuthContext not initialized. Wrap app with AuthContextProvider.');
  },
  getAccessToken: async () => {
    throw new Error('AuthContext not initialized. Wrap app with AuthContextProvider.');
  },
};

/**
 * Authentication context for Azure AD authentication.
 * Use with useContext(AuthContext) or the useAzureAuth hook.
 */
export const AuthContext = createContext<AuthContextValue>(defaultContextValue);
