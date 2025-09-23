import React from 'react';
import { 
  Table, 
  Button, 
  Tag, 
  Typography, 
  Popconfirm,
  Tooltip
} from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
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
      render: (_: any, record: TokenInfo) => {
        const isExpired = record.expiryTime * 1000 < Date.now();
        const isRevoked = record.status === 'REVOKED';
        const isActive = record.status === 'ACTIVE' && !isExpired;

        // Since backend only has "revoke" action, use consistent language
        const actionText = isActive ? "Revoke Token" : "Revoke Token";
        const tooltipText = isActive ? "Revoke active token" : "Revoke token";
        const confirmDescription = isActive 
          ? "Are you sure you want to revoke this token? It will become invalid immediately."
          : isExpired 
            ? "Are you sure you want to revoke this expired token? This will remove it from your list."
            : "Are you sure you want to revoke this token? It will become invalid immediately.";

        return (
          <Popconfirm
            title={actionText}
            description={confirmDescription}
            onConfirm={() => handleRevoke(record.tokenId)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title={tooltipText}>
              <Button
                type="text"
                icon={<DeleteOutlined />}
                size="small"
                disabled={isRevoked} // Only disable if already revoked
              />
            </Tooltip>
          </Popconfirm>
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
