/**
 * Permissions Tab Component
 * Displays and manages user permissions on securable objects
 */

import React, { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Spin,
  Skeleton,
  Result,
  Empty,
  Popconfirm,
  message,
} from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useGetPermissions, useRevokePermission } from '../../hooks/admin/usePermissions';
import { GrantPermissionDialog } from './GrantPermissionDialog';
import { SecurableType } from '../../types/api/catalog.gen';

const { Text } = Typography;

interface PermissionsTabProps {
  userId: string;
  userEmail: string;
}

interface PermissionRow {
  key: string;
  securableType: SecurableType;
  securableName: string;
  privilege: string;
}

export function PermissionsTab({ userId, userEmail }: PermissionsTabProps) {
  const [isGrantDialogOpen, setIsGrantDialogOpen] = useState(false);
  
  // Query metastore permissions for this user
  const { data: permissionsData, isLoading, error, refetch } = useGetPermissions({
    resourceType: SecurableType.metastore,
    resourceName: 'metastore',
  });

  const revokePermission = useRevokePermission({
    resourceType: SecurableType.metastore,
    resourceName: 'metastore',
  });

  // Transform permissions data to table rows
  const permissions: PermissionRow[] = React.useMemo(() => {
    if (!permissionsData?.privilege_assignments) return [];

    const rows: PermissionRow[] = [];
    const userAssignment = permissionsData.privilege_assignments.find(
      (assignment) => assignment.principal === userEmail
    );

    if (userAssignment?.privileges) {
      userAssignment.privileges.forEach((privilege) => {
        rows.push({
          key: `metastore-${privilege}`,
          securableType: SecurableType.metastore,
          securableName: 'metastore',
          privilege: privilege,
        });
      });
    }

    return rows;
  }, [permissionsData, userEmail]);

  const handleRevoke = async (permission: PermissionRow) => {
    try {
      await revokePermission.mutateAsync({
        principal: userEmail,
        privileges: [permission.privilege as any],
      });
      message.success(`Revoked ${permission.privilege} permission`);
      refetch();
    } catch (err: any) {
      message.error(err?.message || 'Failed to revoke permission');
    }
  };

  const columns: ColumnsType<PermissionRow> = [
    {
      title: 'Securable Type',
      dataIndex: 'securableType',
      key: 'securableType',
      render: (type: string) => <Tag color="blue">{type.toUpperCase()}</Tag>,
    },
    {
      title: 'Securable Name',
      dataIndex: 'securableName',
      key: 'securableName',
      render: (name: string) => <Text code>{name}</Text>,
    },
    {
      title: 'Privilege',
      dataIndex: 'privilege',
      key: 'privilege',
      render: (privilege: string) => <Tag color="green">{privilege}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Popconfirm
          title="Revoke Permission"
          description={`Are you sure you want to revoke ${record.privilege} on ${record.securableName}?`}
          onConfirm={() => handleRevoke(record)}
          okText="Revoke"
          cancelText="Cancel"
          okButtonProps={{ danger: true }}
        >
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            loading={revokePermission.isPending}
          >
            Revoke
          </Button>
        </Popconfirm>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div style={{ padding: '24px' }}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <Result
          status="error"
          title="Failed to Load Permissions"
          subTitle={
            <>
              <Text>{(error as any).message || 'An unexpected error occurred'}</Text>
              <br />
              <Text type="secondary">
                {String(error).includes('403') && 'You may not have permission to view permissions.'}
                {String(error).includes('401') && 'Your session may have expired.'}
              </Text>
            </>
          }
          extra={[
            <Button type="primary" key="retry" icon={<ReloadOutlined />} onClick={() => refetch()}>
              Retry
            </Button>,
          ]}
        />
      </div>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Text>
          Manage permissions for <Text strong>{userEmail}</Text>
        </Text>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            aria-label="Refresh permissions"
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsGrantDialogOpen(true)}
            aria-label="Grant new permission"
          >
            Grant Permission
          </Button>
        </Space>
      </div>

      {permissions.length > 0 ? (
        <Table
          columns={columns}
          dataSource={permissions}
          rowKey="key"
          pagination={{
            defaultPageSize: 25,
            showSizeChanger: true,
            pageSizeOptions: ['25', '50', '100'],
            showTotal: (total) => `Total ${total} permissions`,
          }}
        />
      ) : (
        <Empty 
          description={
            <Space direction="vertical">
              <Text>No explicit permissions found for this user</Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Note: If this user can access the admin panel, they have OWNER privileges 
                granted via bootstrap configuration. Explicit permissions will appear here 
                when granted through the UI.
              </Text>
            </Space>
          }
        />
      )}

      <GrantPermissionDialog
        open={isGrantDialogOpen}
        onClose={() => setIsGrantDialogOpen(false)}
        userEmail={userEmail}
        onSuccess={() => {
          setIsGrantDialogOpen(false);
          refetch();
        }}
      />
    </Space>
  );
}
