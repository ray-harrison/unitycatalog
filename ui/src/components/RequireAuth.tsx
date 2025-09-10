import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMsalAuth } from '../context/msal-auth-context';
import { useAuth } from '../context/auth-context';
import { Spin } from 'antd';

interface RequireAuthProps {
  children: React.ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { isAuthenticated } = useMsalAuth();
  const { currentUser } = useAuth();
  const location = useLocation();

  // Check if authentication is enabled
  const authEnabled = 
    (process.env.REACT_APP_GOOGLE_AUTH_ENABLED || '').trim() === 'true' ||
    (process.env.REACT_APP_MS_AUTH_ENABLED || '').trim() === 'true';

  // If authentication is disabled and no user is present, allow access (bootstrap mode)
  if (!authEnabled && !currentUser) {
    return <>{children}</>;
  }

  // If we have a current user (from token exchange), allow access regardless of MSAL state
  if (currentUser) {
    return <>{children}</>;
  }

  // If authentication is enabled, check MSAL state
  if (authEnabled) {
    // Show loading while checking authentication status
    if (isAuthenticated && currentUser === undefined) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <Spin size="large" />
        </div>
      );
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated || !currentUser) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
  }

  // Render protected content
  return <>{children}</>;
}
