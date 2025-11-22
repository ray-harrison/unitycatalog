/**
 * User Details Page
 * Displays user information and allows managing permissions
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Button,
  Space,
  Typography,
  Tag,
  Spin,
  Skeleton,
  Result,
  Alert,
  Modal,
  message,
  Tabs,
} from 'antd';
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useGetUser } from '../../hooks/admin/useUsers';
import { PermissionsTab } from '../../components/admin/PermissionsTab';
import DeleteUserDialog from '../../components/admin/DeleteUserDialog';
import { useIsLastMetastoreOwner } from '../../hooks/admin/useMetastoreOwners';

const { Title, Text } = Typography;

export function UserDetails() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { data: user, isLoading, error, refetch } = useGetUser({ id: userId || '' });
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  // Compute primary email early (may be undefined while loading)
  const primaryEmail = (user as any)?.emails?.find((e: any) => e.primary)?.value || (user as any)?.emails?.[0]?.value;
  const { isLastOwner } = useIsLastMetastoreOwner(primaryEmail);

  if (isLoading) {
    return (
      <div style={{ padding: '24px' }}>
        <Skeleton.Button active style={{ width: 100, marginBottom: 24 }} />
        <Card>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div style={{ padding: '24px' }}>
        <Result
          status="error"
          title="Failed to Load User"
          subTitle={
            <>
              <Text>{error ? (error as any).message : 'User not found'}</Text>
              <br />
              <Text type="secondary">
                {String(error).includes('403') && 'You may not have permission to view this user.'}
                {String(error).includes('401') && 'Your session may have expired. Please log in again.'}
                {String(error).includes('404') && 'The requested user was not found.'}
              </Text>
            </>
          }
          extra={[
            <Button type="primary" key="retry" icon={<ReloadOutlined />} onClick={() => refetch()}>
              Retry
            </Button>,
            <Button key="back" onClick={() => navigate('/admin/users')}>
              Back to Users
            </Button>,
          ]}
        />
      </div>
    );
  }

  const userAny = user as any; // Workaround for type issues
  const displayPrimaryEmail = primaryEmail || 'N/A';
  const isActive = userAny.active !== false;

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/admin/users')}
            >
              Back to Users
            </Button>
            <Title level={2} style={{ margin: 0 }}>
              {(user as any).displayName}
            </Title>
            <Tag color={isActive ? 'green' : 'red'}>
              {isActive ? 'Active' : 'Disabled'}
            </Tag>
          </Space>
          <Space>
            <Button icon={<EditOutlined />} disabled>
              Edit User
            </Button>
            <Button
              icon={<DeleteOutlined />}
              danger
              onClick={() => setIsDeleteOpen(true)}
            >
              Delete User
            </Button>
          </Space>
        </div>

        {/* User Information Card */}
        <Card title="User Information">
          <Descriptions column={2} bordered>
            <Descriptions.Item label="Display Name">
              {userAny.displayName}
            </Descriptions.Item>
            <Descriptions.Item label="User ID">{userAny.id}</Descriptions.Item>
            <Descriptions.Item label="Primary Email">
              {primaryEmail}
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={isActive ? 'green' : 'red'}>
                {isActive ? 'Active' : 'Disabled'}
              </Tag>
            </Descriptions.Item>
            {userAny.externalId && (
              <Descriptions.Item label="External ID" span={2}>
                {userAny.externalId}
              </Descriptions.Item>
            )}
            {userAny.meta?.created && (
              <Descriptions.Item label="Created">
                {new Date(userAny.meta.created).toLocaleString()}
              </Descriptions.Item>
            )}
            {userAny.meta?.lastModified && (
              <Descriptions.Item label="Last Modified">
                {new Date(userAny.meta.lastModified).toLocaleString()}
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        {/* Tabs for Permissions and other details */}
        <Card>
          <Tabs
            defaultActiveKey="permissions"
            items={[
              {
                key: 'permissions',
                label: 'Permissions',
                children: <PermissionsTab userId={userId || ''} userEmail={displayPrimaryEmail} />,
              },
            ]}
          />
        </Card>
      </Space>
      <DeleteUserDialog
        open={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        userId={userId || ''}
        userEmail={displayPrimaryEmail}
        isLastOwner={isLastOwner}
        onDeleted={() => navigate('/admin/users')}
      />
    </div>
  );
}
