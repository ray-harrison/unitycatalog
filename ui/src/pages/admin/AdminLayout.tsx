/**
 * Admin layout component
 * Wrapper for admin pages that enforces OWNER privilege
 */

import React from 'react';
import { Outlet } from 'react-router-dom';
import { Result, Spin } from 'antd';
import { useAdminAuth } from '../../hooks/admin/useAdminAuth';

export function AdminLayout() {
  const { hasOwnerPrivilege, isLoading } = useAdminAuth();

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="Checking admin privileges..." />
      </div>
    );
  }

  // Show 403 error if authenticated but not OWNER
  if (!hasOwnerPrivilege) {
    return (
      <Result
        status="403"
        title="403 Forbidden"
        subTitle="You do not have permission to access the admin panel. OWNER privilege on the metastore is required."
      />
    );
  }

  // Render admin content for authorized users
  return <Outlet />;
}
