import React from 'react';
import { Tabs, Alert, Typography, Spin } from 'antd';
import { UserOutlined, SafetyOutlined } from '@ant-design/icons';
import { UsersTab } from '../components/admin/UsersTab';
import { PermissionsTab } from '../components/admin/PermissionsTab';
import { BootstrapFlow } from '../components/BootstrapFlow';
import { useAdminStatus } from '../hooks/adminStatus';
import { useBootstrapStatus } from '../hooks/bootstrap';

const { Title } = Typography;

export function AdminPanel() {
  const { data: adminStatus, isLoading: adminLoading, refetch: refetchAdminStatus } = useAdminStatus();
  const { data: bootstrapStatus, isLoading: bootstrapLoading, refetch: refetchBootstrapStatus } = useBootstrapStatus();
  
  // Show loading while checking status
  if (adminLoading || bootstrapLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Typography.Text>Checking admin privileges...</Typography.Text>
        </div>
      </div>
    );
  }
  
  // User has admin privileges - show full admin panel
  if (adminStatus?.isAdmin) {
    const tabItems = [
      {
        key: 'users',
        label: (
          <span>
            <UserOutlined />
            Users
          </span>
        ),
        children: <UsersTab />,
        disabled: !adminStatus.canManageUsers,
      },
      {
        key: 'permissions',
        label: (
          <span>
            <SafetyOutlined />
            Permissions
          </span>
        ),
        children: <PermissionsTab />,
        disabled: !adminStatus.canManagePermissions,
      },
    ];

    return (
      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        <Title level={2}>Admin Panel</Title>
        <Tabs items={tabItems} defaultActiveKey="users" />
      </div>
    );
  }
  
  // Bootstrap is available - show bootstrap flow
  if (bootstrapStatus?.available && bootstrapStatus?.needsBootstrap) {
    return (
      <BootstrapFlow 
        onComplete={async () => {
          // Refresh both admin status and bootstrap status after successful bootstrap
          console.log('Bootstrap completed, refreshing statuses...');
          await Promise.all([
            refetchAdminStatus(),
            refetchBootstrapStatus()
          ]);
          console.log('Status refresh completed');
        }} 
      />
    );
  }
  
  // No admin access and no bootstrap available - show access denied
  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Alert
        type="error"
        message="Admin Access Required"
        description={
          <div>
            <p>You need administrative privileges to access this panel.</p>
            <p><strong>To get admin access:</strong></p>
            <ul>
              <li>Contact your Unity Catalog administrator to grant you OWNER role privileges</li>
              <li>If you have an admin token, ensure you're logged in with the correct Azure account</li>
              <li>Check that your Unity Catalog server has proper admin role configuration</li>
            </ul>
            <p><em>Note: Only users with OWNER role or explicit admin tokens can manage users and permissions.</em></p>
            {bootstrapStatus?.error && (
              <p><strong>Bootstrap Status:</strong> {bootstrapStatus.error}</p>
            )}
          </div>
        }
        showIcon
      />
    </div>
  );
}
