import { Configuration, LogLevel } from '@azure/msal-browser';

/**
 * MSAL (Microsoft Authentication Library) configuration for Azure AD authentication.
 * Loads configuration from environment variables (REACT_APP_MS_* prefix).
 */

export interface MsalConfig {
  enabled: boolean;
  clientId: string;
  authority: string;
  redirectUri: string;
  postLogoutRedirectUri?: string;
  scopes: string[];
}

/**
 * Load MSAL configuration from environment variables.
 * Environment variables must be prefixed with REACT_APP_ to be accessible in React.
 *
 * @returns MsalConfig object with Azure AD settings
 */
export function loadMsalConfig(): MsalConfig {
  return {
    enabled: process.env.REACT_APP_MS_AUTH_ENABLED === 'true',
    clientId: process.env.REACT_APP_MS_CLIENT_ID || '',
    authority: process.env.REACT_APP_MS_AUTHORITY || '',
    redirectUri: process.env.REACT_APP_MS_REDIRECT_URI || window.location.origin,
    postLogoutRedirectUri:
      process.env.REACT_APP_MS_POST_LOGOUT_REDIRECT_URI ||
      process.env.REACT_APP_MS_REDIRECT_URI ||
      window.location.origin,
    scopes: process.env.REACT_APP_MS_SCOPES
      ? process.env.REACT_APP_MS_SCOPES.split(',').map((s) => s.trim())
      : [],
  };
}

/**
 * Validate MSAL configuration to ensure required fields are present.
 *
 * @param config MSAL configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateMsalConfig(config: MsalConfig): void {
  if (!config.enabled) {
    return; // Skip validation if auth is disabled
  }

  if (!config.clientId || config.clientId.trim() === '') {
    throw new Error(
      'Azure AD Client ID is required. Set REACT_APP_MS_CLIENT_ID environment variable.'
    );
  }

  // Validate client ID format (UUID)
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(config.clientId)) {
    throw new Error(
      `Invalid Azure AD Client ID format: ${config.clientId}. Expected UUID format.`
    );
  }

  if (!config.authority || config.authority.trim() === '') {
    throw new Error(
      'Azure AD Authority URL is required. Set REACT_APP_MS_AUTHORITY environment variable.'
    );
  }

  // Validate authority URL format
  if (
    !config.authority.startsWith('https://login.microsoftonline.com/')
  ) {
    throw new Error(
      `Invalid Azure AD Authority URL: ${config.authority}. Must start with https://login.microsoftonline.com/`
    );
  }

  if (!config.redirectUri || config.redirectUri.trim() === '') {
    throw new Error(
      'Redirect URI is required. Set REACT_APP_MS_REDIRECT_URI environment variable.'
    );
  }

  if (config.scopes.length === 0) {
    console.warn(
      'No OAuth scopes configured. Set REACT_APP_MS_SCOPES environment variable. ' +
        'Example: "api://your-server-client-id/Catalog.Read,api://your-server-client-id/Catalog.Write"'
    );
  }
}

/**
 * Create MSAL browser configuration from MsalConfig.
 *
 * @param config MSAL configuration
 * @returns MSAL Configuration object for PublicClientApplication
 */
export function createMsalConfiguration(config: MsalConfig): Configuration {
  return {
    auth: {
      clientId: config.clientId,
      authority: config.authority,
      redirectUri: config.redirectUri,
      postLogoutRedirectUri: config.postLogoutRedirectUri,
      navigateToLoginRequestUrl: true,
    },
    cache: {
      cacheLocation: 'sessionStorage', // Use sessionStorage to avoid issues with multiple tabs
      storeAuthStateInCookie: false, // Set to true if you have issues with IE11 or Edge
    },
    system: {
      loggerOptions: {
        loggerCallback: (level, message, containsPii) => {
          if (containsPii) {
            return; // Don't log PII
          }
          switch (level) {
            case LogLevel.Error:
              console.error(message);
              return;
            case LogLevel.Warning:
              console.warn(message);
              return;
            case LogLevel.Info:
              console.info(message);
              return;
            case LogLevel.Verbose:
              console.debug(message);
              return;
          }
        },
        logLevel: LogLevel.Warning,
      },
    },
  };
}

/**
 * Get the loaded and validated MSAL configuration.
 * Call this at application startup to ensure configuration is valid.
 *
 * @returns Validated MsalConfig object
 * @throws Error if configuration is invalid and auth is enabled
 */
export function getMsalConfig(): MsalConfig {
  const config = loadMsalConfig();
  validateMsalConfig(config);
  return config;
}

// Export default configuration instance
export const msalConfig = getMsalConfig();

/**
 * MSAL login request configuration.
 * Specifies the scopes to request during login.
 */
export const loginRequest = {
  scopes: msalConfig.scopes.length > 0 ? msalConfig.scopes : ['openid', 'profile', 'email'],
};
