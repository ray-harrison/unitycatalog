/**
 * Add User Dialog Component
 * Modal form for creating new users
 */

import React, { useState } from 'react';
import { Modal, Form, Input, notification, Typography } from 'antd';
import { UserAddOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useCreateUser } from '../../hooks/admin/useUsers';

const { Text } = Typography;

interface AddUserDialogProps {
  open: boolean;
  onClose: () => void;
}

interface AddUserFormValues {
  email: string;
  displayName: string;
  externalId?: string;
}

/**
 * RFC 5322 Email validation regex (simplified)
 */
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function AddUserDialog({ open, onClose }: AddUserDialogProps) {
  const [form] = Form.useForm<AddUserFormValues>();
  const navigate = useNavigate();
  const createUserMutation = useCreateUser();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (values: AddUserFormValues) => {
    setIsSubmitting(true);
    
    try {
      // Create user with SCIM2 API
      const newUser = await createUserMutation.mutateAsync({
        email: values.email,
        displayName: values.displayName,
        externalId: values.externalId,
      });

      // Show success notification
      notification.success({
        message: 'User Created',
        description: `Successfully created user ${values.displayName} (${values.email})`,
        duration: 4,
      });

      // Reset form and close dialog
      form.resetFields();
      onClose();

      // Navigate to new user's details page
      const userId = (newUser as any)?.id;
      if (userId) {
        navigate(`/admin/users/${userId}`);
      }
    } catch (error: any) {
      // Handle specific error cases
      if (error?.response?.status === 409 || error?.status === 409) {
        notification.error({
          message: 'User Already Exists',
          description: `A user with email ${values.email} already exists in the system.`,
          duration: 6,
        });
        // Highlight the email field
        form.setFields([
          {
            name: 'email',
            errors: ['This email is already registered'],
          },
        ]);
      } else if (error?.response?.status === 400 || error?.status === 400) {
        notification.error({
          message: 'Invalid User Data',
          description: error?.message || 'Please check the form and try again.',
          duration: 5,
        });
      } else if (error?.response?.status === 401 || error?.status === 401) {
        notification.error({
          message: 'Authentication Required',
          description: 'Your session has expired. Please log in again.',
          duration: 5,
        });
      } else if (error?.response?.status === 403 || error?.status === 403) {
        notification.error({
          message: 'Permission Denied',
          description: 'You do not have permission to create users.',
          duration: 5,
        });
      } else {
        // Generic error
        notification.error({
          message: 'Failed to Create User',
          description: error?.message || 'An unexpected error occurred. Please try again.',
          duration: 5,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={
        <span>
          <UserAddOutlined style={{ marginRight: 8 }} />
          Add New User
        </span>
      }
      open={open}
      onOk={() => form.submit()}
      onCancel={handleCancel}
      confirmLoading={isSubmitting}
      okText="Create User"
      cancelText="Cancel"
      width={520}
      destroyOnClose
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Create a new user account with access to Unity Catalog resources.
      </Text>
      
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
        validateTrigger={['onBlur', 'onChange']}
      >
        <Form.Item
          label="Email"
          name="email"
          rules={[
            { required: true, message: 'Email address is required' },
            {
              pattern: EMAIL_REGEX,
              message: 'Please enter a valid email address (e.g., user@company.com)',
            },
            {
              type: 'email',
              message: 'Email format is invalid',
            },
          ]}
          tooltip="Primary email address for the user"
          hasFeedback
        >
          <Input
            placeholder="user@company.com"
            autoFocus
            aria-label="User email address"
            aria-required="true"
          />
        </Form.Item>

        <Form.Item
          label="Display Name"
          name="displayName"
          rules={[
            { required: true, message: 'Display name is required' },
            { min: 2, message: 'Display name must be at least 2 characters long' },
            { max: 100, message: 'Display name must not exceed 100 characters' },
            {
              pattern: /^[a-zA-Z0-9\s\-_.]+$/,
              message: 'Display name can only contain letters, numbers, spaces, hyphens, underscores, and periods',
            },
          ]}
          tooltip="The name shown in the UI (e.g., John Doe)"
          hasFeedback
        >
          <Input
            placeholder="John Doe"
            aria-label="User display name"
            aria-required="true"
          />
        </Form.Item>

        <Form.Item
          label="External ID (Optional)"
          name="externalId"
          tooltip="External identifier from your identity provider (e.g., Azure AD object ID)"
          rules={[
            { max: 255, message: 'External ID must not exceed 255 characters' },
          ]}
        >
          <Input
            placeholder="external-user-id"
            aria-label="External identifier"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
