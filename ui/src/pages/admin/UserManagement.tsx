/**
 * User Management page
 * Displays list of all users with search and pagination
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Table, Tag, Typography, Input, Skeleton, Result, Alert } from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useListUsers } from '../../hooks/admin/useUsers';
import { useUserSearch } from '../../utils/admin/userFilters';
import type { UserListItem } from '../../types/admin/user';
import type { ColumnsType } from 'antd/es/table';
import type { components } from '../../types/api/control.gen';
import { AddUserDialog } from '../../components/admin/AddUserDialog';

const { Title, Text } = Typography;

/**
 * Transform UserResource from API to UserListItem for display
 */
function transformUserToListItem(userResource: components['schemas']['UserResource']): UserListItem {
  const primaryEmail = userResource.emails?.find((e) => e.primary)?.value || '';
  
  return {
    id: userResource.id || '',
    email: primaryEmail,
    displayName: userResource.displayName || '',
    status: userResource.active ? 'Active' : 'Disabled',
    createdAt: new Date(userResource.meta?.created || Date.now()),
    lastModified: new Date(userResource.meta?.lastModified || Date.now()),
    photoUrl: userResource.photos?.[0]?.value,
  };
}

export default function UserManagement() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  
  // Fetch all users
  const { data: usersResponse, isLoading, error, refetch } = useListUsers();
  
  // Transform to UserListItem format
  const users = useMemo(() => {
    const resources = (usersResponse as any)?.Resources as components['schemas']['UserResource'][] | undefined;
    if (!resources) return [];
    return resources.map(transformUserToListItem);
  }, [usersResponse]);
  
  // Apply search filter
  const filteredUsers = useUserSearch(users, searchTerm) as UserListItem[];
  
  // Table columns configuration
  const columns: ColumnsType<UserListItem> = [
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      sorter: (a, b) => a.email.localeCompare(b.email),
      defaultSortOrder: 'ascend',
      render: (email: string) => <Text strong>{email}</Text>,
    },
    {
      title: 'Display Name',
      dataIndex: 'displayName',
      key: 'displayName',
      sorter: (a, b) => a.displayName.localeCompare(b.displayName),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: 'Active' | 'Disabled') => (
        <Tag color={status === 'Active' ? 'green' : 'red'}>
          {status}
        </Tag>
      ),
      filters: [
        { text: 'Active', value: 'Active' },
        { text: 'Disabled', value: 'Disabled' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: Date) => new Date(date).toLocaleDateString(),
      sorter: (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    },
  ];

  // Loading state with skeleton
  if (isLoading) {
    return (
      <div style={{ padding: '24px' }}>
        <Skeleton.Input active style={{ width: 200, marginBottom: 24 }} />
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  // Error state with retry
  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <Result
          status="error"
          title="Failed to Load Users"
          subTitle={
            <>
              <Text>{error instanceof Error ? error.message : 'An unexpected error occurred'}</Text>
              <br />
              <Text type="secondary">
                {String(error).includes('403') && 'You may not have permission to view users.'}
                {String(error).includes('401') && 'Your session may have expired. Please log in again.'}
                {String(error).includes('404') && 'The user management API endpoint was not found.'}
              </Text>
            </>
          }
          extra={[
            <Button type="primary" key="retry" icon={<ReloadOutlined />} onClick={() => refetch()}>
              Retry
            </Button>,
            <Button key="back" onClick={() => navigate('/')}>
              Back to Home
            </Button>,
          ]}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <Title level={2} style={{ margin: 0 }}>User Management</Title>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} aria-label="Refresh user list">
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsAddUserDialogOpen(true)}
            aria-label="Add new user"
          >
            Add User
          </Button>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search by email or display name..."
          prefix={<SearchOutlined />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: 400 }}
          allowClear
          aria-label="Search users"
        />
      </div>

      {/* No results message */}
      {filteredUsers.length === 0 && searchTerm && (
        <Alert
          message="No users found"
          description={`No users match the search term "${searchTerm}". Try a different search.`}
          type="info"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      {/* User Table */}
      <Table
        dataSource={filteredUsers}
        columns={columns}
        rowKey="id"
        onRow={(record) => ({
          onClick: () => navigate(`/admin/users/${record.id}`),
          style: { cursor: 'pointer' },
          tabIndex: 0,
          onKeyPress: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              navigate(`/admin/users/${record.id}`);
            }
          },
          role: 'button',
          'aria-label': `View details for ${record.email}`,
        })}
        pagination={{
          defaultPageSize: 50,
          showSizeChanger: true,
          pageSizeOptions: ['25', '50', '100', '200'],
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} users`,
        }}
        locale={{
          emptyText: 'No users found. Click "Add User" to create the first user.',
        }}
      />

      {/* Add User Dialog */}
      <AddUserDialog
        open={isAddUserDialogOpen}
        onClose={() => setIsAddUserDialogOpen(false)}
      />
    </div>
  );
}
