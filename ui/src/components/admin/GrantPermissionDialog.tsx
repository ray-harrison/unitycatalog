/**
 * Grant Permission Dialog Component
 * Allows granting permissions to a user on a securable object
 */

import React from 'react';
import { Modal, Form, Select, message, Typography, Alert } from 'antd';
import { SafetyOutlined } from '@ant-design/icons';
import { useGrantPermission } from '../../hooks/admin/usePermissions';
import { SecurableType, Privilege } from '../../types/api/catalog.gen';

const { Option } = Select;
const { Text } = Typography;

interface GrantPermissionDialogProps {
  open: boolean;
  onClose: () => void;
  userEmail: string;
  onSuccess: () => void;
}

export function GrantPermissionDialog({
  open,
  onClose,
  userEmail,
  onSuccess,
}: GrantPermissionDialogProps) {
  const [form] = Form.useForm();
  
  // For now, we only support metastore permissions
  const grantPermission = useGrantPermission({
    resourceType: SecurableType.metastore,
    resourceName: 'metastore',
  });

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      await grantPermission.mutateAsync({
        principal: userEmail,
        privileges: [values.privilege],
      });

      message.success({
        content: `Successfully granted ${values.privilege} to ${userEmail}`,
        duration: 4,
      });
      form.resetFields();
      onSuccess();
    } catch (err: any) {
      if (err?.response?.status === 409 || err?.status === 409) {
        message.warning({
          content: 'This permission already exists for the user',
          duration: 4,
        });
        form.resetFields();
        onSuccess(); // Still refresh to show current state
      } else if (err?.response?.status === 403 || err?.status === 403) {
        message.error({
          content: 'You do not have permission to grant privileges',
          duration: 5,
        });
      } else if (err?.response?.status === 401 || err?.status === 401) {
        message.error({
          content: 'Your session has expired. Please log in again.',
          duration: 5,
        });
      } else if (err.errorFields) {
        // Form validation error - don't show message
      } else {
        message.error({
          content: err?.message || 'Failed to grant permission. Please try again.',
          duration: 5,
        });
      }
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  // Get available privileges for metastore
  const availablePrivileges = [
    Privilege.CREATE_CATALOG,
    Privilege.USE_CATALOG,
    Privilege.CREATE_SCHEMA,
    Privilege.USE_SCHEMA,
  ];

  // Get privilege descriptions
  const privilegeDescriptions: Record<string, string> = {
    [Privilege.CREATE_CATALOG]: 'Allows creating new catalogs in the metastore',
    [Privilege.USE_CATALOG]: 'Allows accessing and using catalogs',
    [Privilege.CREATE_SCHEMA]: 'Allows creating schemas within catalogs',
    [Privilege.USE_SCHEMA]: 'Allows accessing and using schemas',
  };

  return (
    <Modal
      title={
        <span>
          <SafetyOutlined style={{ marginRight: 8 }} />
          Grant Permission
        </span>
      }
      open={open}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={grantPermission.isPending}
      okText="Grant Permission"
      cancelText="Cancel"
      width={550}
      destroyOnClose
    >
      <Alert
        message="Granting Metastore Permission"
        description={
          <>
            You are granting a permission to <Text strong>{userEmail}</Text> on the Unity Catalog metastore.
            This will allow the user to perform the selected action on the metastore and its child resources.
          </>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
      >
        <Form.Item label="Securable Type" initialValue={SecurableType.metastore}>
          <Select disabled aria-label="Securable type">
            <Option value={SecurableType.metastore}>METASTORE</Option>
          </Select>
        </Form.Item>

        <Form.Item label="Securable Name" initialValue="metastore">
          <Select disabled aria-label="Securable name">
            <Option value="metastore">metastore</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Privilege"
          name="privilege"
          rules={[{ required: true, message: 'Please select a privilege to grant' }]}
          tooltip="The permission level to grant to the user"
          hasFeedback
        >
          <Select
            placeholder="Select privilege to grant"
            aria-label="Select privilege"
            aria-required="true"
            showSearch
            optionFilterProp="children"
          >
            {availablePrivileges.map((privilege) => (
              <Option key={privilege} value={privilege} title={privilegeDescriptions[privilege]}>
                <div>
                  <div><Text strong>{privilege}</Text></div>
                  <div><Text type="secondary" style={{ fontSize: 12 }}>{privilegeDescriptions[privilege]}</Text></div>
                </div>
              </Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
}
