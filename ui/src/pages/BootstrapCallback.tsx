import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Result, Button, Typography, Spin } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const { Paragraph, Text } = Typography;

export function BootstrapCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [token, setToken] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Check URL parameters for success/error status
    const success = searchParams.get('success');
    const errorParam = searchParams.get('error');
    const tokenParam = searchParams.get('token');

    if (success === 'true' && tokenParam) {
      setStatus('success');
      setToken(tokenParam);
    } else if (errorParam) {
      setStatus('error');
      setError(errorParam);
    } else {
      // No clear success/error, assume error
      setStatus('error');
      setError('Bootstrap completion status unclear');
    }
  }, [searchParams]);

  const handleContinue = () => {
    // Navigate back to admin panel
    navigate('/admin');
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(token);
  };

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
        <div style={{ marginLeft: 16 }}>
          <Paragraph>Processing bootstrap completion...</Paragraph>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <Card>
        {status === 'success' ? (
          <Result
            icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            title="Bootstrap Completed Successfully!"
            subTitle="You now have OWNER privileges in Unity Catalog"
            extra={[
              <Button type="primary" key="continue" onClick={handleContinue}>
                Continue to Admin Panel
              </Button>
            ]}
          >
            <div style={{ textAlign: 'left', backgroundColor: '#f6f6f6', padding: 16, borderRadius: 6 }}>
              <Paragraph strong>Your Azure Access Token:</Paragraph>
              <div style={{ 
                backgroundColor: '#fff', 
                padding: 12, 
                borderRadius: 4, 
                border: '1px solid #d9d9d9',
                marginBottom: 12,
                wordBreak: 'break-all'
              }}>
                <Text code style={{ fontSize: 12 }}>{token}</Text>
              </div>
              <Button size="small" onClick={handleCopyToken}>
                Copy Token
              </Button>
              <div style={{ marginTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Save this token securely. You can use it for API access or generate new tokens from the Admin panel.
                </Text>
              </div>
            </div>
          </Result>
        ) : (
          <Result
            icon={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
            title="Bootstrap Failed"
            subTitle={error || 'An error occurred during the bootstrap process'}
            extra={[
              <Button type="primary" key="retry" onClick={() => navigate('/admin')}>
                Back to Admin Panel
              </Button>
            ]}
          />
        )}
      </Card>
    </div>
  );
}
