import React, { useEffect, ReactNode } from 'react';
import { PublicClientApplication, EventType } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig, createMsalConfiguration } from '../utils/msalConfig';

interface AzureAuthProviderProps {
  children: ReactNode;
}

// Initialize MSAL instance
const msalInstance = new PublicClientApplication(createMsalConfiguration(msalConfig));

/**
 * Azure AD authentication provider component.
 * Initializes MSAL PublicClientApplication and handles OAuth redirects.
 * Must wrap the entire app (or authenticated portions) to enable Azure AD authentication.
 */
export function AzureAuthProvider({ children }: AzureAuthProviderProps) {
  useEffect(() => {
    // Handle redirect promise on page load
    // This completes the OAuth flow after redirect from Azure AD
    msalInstance
      .handleRedirectPromise()
      .then((response) => {
        if (response) {
          console.log('Azure AD redirect successful:', response.account?.username);
        }
      })
      .catch((error) => {
        console.error('Azure AD redirect error:', error);
      });

    // Register event callbacks for debugging
    const callbackId = msalInstance.addEventCallback((event) => {
      if (event.eventType === EventType.LOGIN_SUCCESS) {
        console.log('Azure AD login success');
      } else if (event.eventType === EventType.LOGIN_FAILURE) {
        console.error('Azure AD login failure:', event.error);
      } else if (event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS) {
        console.log('Azure AD token acquired');
      } else if (event.eventType === EventType.ACQUIRE_TOKEN_FAILURE) {
        console.error('Azure AD token acquisition failed:', event.error);
      }
    });

    // Cleanup callback on unmount
    return () => {
      if (callbackId) {
        msalInstance.removeEventCallback(callbackId);
      }
    };
  }, []);

  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
}
