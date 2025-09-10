import React from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Tag, 
  Typography, 
  Popconfirm,
  Tooltip
} from 'antd';
import { DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useListTokens, useRevokeToken } from '../../hooks/tokens';
import { TokenInfo } from '../../types/tokens';

const { Text } = Typography;

export default function TokenList() {
  const { data: tokensData, isLoading } = useListTokens();
  const revokeTokenMutation = useRevokeToken();

  const handleRevoke = (tokenId: string) => {
    revokeTokenMutation.mutate(tokenId);
  };

  const getStatusTag = (status: TokenInfo['status'], expiryTime: number) => {
    const now = new Date().getTime();
    
    if (status === 'REVOKED') {
      return <Tag color="red">REVOKED</Tag>;
    }
    
    if (status === 'EXPIRED' || expiryTime <= now) {
      return <Tag color="orange">EXPIRED</Tag>;
    }
    
    return <Tag color="green">ACTIVE</Tag>;
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return <Text type="secondary">N/A</Text>;
    return new Date(timestamp).toLocaleString();
  };

  const columns = [
    {
      title: 'Description',
      dataIndex: 'comment',
      key: 'comment',
      render: (comment: string) => comment || <Text type="secondary">No description</Text>,
    },
    {
      title: 'Status',
      key: 'status',
      render: (record: TokenInfo) => getStatusTag(record.status, record.expiryTime),
    },
    {
      title: 'Created',
      dataIndex: 'creationTime',
      key: 'creationTime',
      render: formatDate,
    },
    {
      title: 'Expires',
      dataIndex: 'expiryTime',
      key: 'expiryTime',
      render: (expiryTime: number) => {
        const now = new Date().getTime();
        const isExpired = expiryTime <= now;
        
        return (
          <Text type={isExpired ? 'secondary' : undefined}>
            {formatDate(expiryTime)}
          </Text>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: TokenInfo) => {
        const canRevoke = record.status === 'ACTIVE' && record.expiryTime > new Date().getTime();
        
        return (
          <Space>
            <Popconfirm
              title="Revoke Token"
              description="Are you sure you want to revoke this token? This action cannot be undone."
              onConfirm={() => handleRevoke(record.tokenId)}
              okText="Revoke"
              cancelText="Cancel"
              icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
              disabled={!canRevoke}
            >
              <Tooltip title={canRevoke ? "Revoke Token" : "Cannot revoke expired or already revoked tokens"}>
                <Button 
                  danger 
                  icon={<DeleteOutlined />}
                  disabled={!canRevoke}
                  loading={revokeTokenMutation.isPending && revokeTokenMutation.variables === record.tokenId}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <Table
      dataSource={tokensData?.tokens || []}
      columns={columns}
      loading={isLoading}
      rowKey="tokenId"
      pagination={{ 
        pageSize: 10,
        showSizeChanger: true,
        showQuickJumper: true,
      }}
      locale={{
        emptyText: 'No tokens found. Create your first token above.',
      }}
    />
  );
}
