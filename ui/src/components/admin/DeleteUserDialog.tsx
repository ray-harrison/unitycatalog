import React, { useState, useEffect } from 'react';
import { Modal, Typography, Input, notification } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDeleteUser } from '../../hooks/admin/useUsers';

const { Text } = Typography;

interface DeleteUserDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  onDeleted?: () => void;
  isLastOwner?: boolean; // parent can provide last OWNER safeguard context
}

export function DeleteUserDialog({
  open,
  onClose,
  userId,
  userEmail,
  onDeleted,
  isLastOwner = false,
}: DeleteUserDialogProps) {
  const navigate = useNavigate();
  const deleteUserMutation = useDeleteUser({ id: userId });
  const [confirmValue, setConfirmValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  useEffect(() => {
    setCanDelete(confirmValue.trim() === userEmail && !isLastOwner);
  }, [confirmValue, userEmail, isLastOwner]);

  const resetAndClose = () => {
    setConfirmValue('');
    onClose();
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    setSubmitting(true);
    try {
      await deleteUserMutation.mutateAsync();
      notification.success({
        message: 'User Deleted',
        description: `Successfully deleted user ${userEmail}`,
        duration: 4,
      });
      if (onDeleted) onDeleted();
      resetAndClose();
      navigate('/admin/users');
    } catch (err: any) {
      if (isLastOwner) {
        notification.error({
          message: 'Cannot Delete Last Administrator',
          description: 'At least one METASTORE OWNER must remain. Assign ownership before deletion.',
          duration: 6,
        });
      } else if (err?.response?.status === 403 || err?.status === 403) {
        notification.error({
          message: 'Permission Denied',
          description: 'You do not have permission to delete this user.',
          duration: 5,
        });
      } else if (err?.response?.status === 401 || err?.status === 401) {
        notification.error({
          message: 'Authentication Required',
          description: 'Your session has expired. Please log in again.',
          duration: 5,
        });
      } else {
        notification.error({
          message: 'Deletion Failed',
          description: err?.message || 'An unexpected error occurred while deleting the user.',
          duration: 5,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <span>
          <ExclamationCircleOutlined style={{ marginRight: 8 }} />
          Delete User
        </span>
      }
      open={open}
      onCancel={resetAndClose}
      onOk={handleDelete}
      okButtonProps={{ danger: true, disabled: !canDelete }}
      confirmLoading={submitting}
      okText="Delete User"
      cancelText="Cancel"
      width={540}
      destroyOnClose
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          This action permanently removes the user and their catalog access. Type the email to confirm.
        </Text>
      </div>
      <div style={{ marginBottom: 8 }}>
        <Text strong>User Email:</Text> <Text code>{userEmail}</Text>
      </div>
      {isLastOwner && (
        <div style={{ marginBottom: 12 }}>
          <Text type="danger">This is the last METASTORE OWNER. Reassign ownership before deletion.</Text>
        </div>
      )}
      <Input
        placeholder={`Type ${userEmail} to confirm deletion`}
        aria-label="Confirm user email"
        value={confirmValue}
        onChange={(e) => setConfirmValue(e.target.value)}
        disabled={submitting}
      />
      <div style={{ marginTop: 8 }}>
        <Text type={canDelete ? 'success' : 'secondary'}>
          {canDelete
            ? 'Email matches. You may delete this user.'
            : 'Enter the exact email above to enable deletion.'}
        </Text>
      </div>
    </Modal>
  );
}

export default DeleteUserDialog;