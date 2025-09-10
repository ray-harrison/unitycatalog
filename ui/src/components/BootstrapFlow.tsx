import React, { useState } from 'react';
import { Card, Button, Alert, Typography, Steps, Spin, Input } from 'antd';
import { LoadingOutlined, CloudOutlined, CopyOutlined } from '@ant-design/icons';
import { useAuth } from '../context/auth-context';

const { Title, Paragraph, Text } = Typography;
const { Step } = Steps;
const { TextArea } = Input;

interface BootstrapFlowProps {
  onComplete?: () => void;
}

type BootstrapStep = 'start' | 'redirecting' | 'waiting' | 'token-input' | 'exchanging' | 'completed' | 'error';

export const BootstrapFlow: React.FC<BootstrapFlowProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState<BootstrapStep>('start');
  const [error, setError] = useState<string>('');
  const [azureToken, setAzureToken] = useState<string>('');
  const { loginWithToken } = useAuth();

  const handleStartBootstrap = async () => {
    try {
      setError('');
      setCurrentStep('redirecting');
      
      const response = await fetch('/api/1.0/unity-control/auth/azure-login/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        throw new Error(`Failed to start bootstrap: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Open Azure authentication in a new window/tab
      const authWindow = window.open(data.authorization_url, 'azure-auth', 'width=600,height=700');
      
      setCurrentStep('waiting');
      
      // Monitor the auth window
      const checkClosed = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkClosed);
          setCurrentStep('token-input');
        }
      }, 1000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to start bootstrap process');
      setCurrentStep('error');
    }
  };

    const handleTokenSubmit = async () => {
    try {
      setCurrentStep('exchanging');
      setError('');

      // Step 1: Exchange Azure token for Unity Catalog token using bootstrap endpoint
      const response = await fetch('/api/1.0/unity-control/auth/bootstrap/token-exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${azureToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Token exchange failed: ${response.status}`);
      }

      const tokenData = await response.json();
      console.log('Bootstrap token exchange successful:', tokenData);

      // Step 2: Login with the Unity Catalog token
      await loginWithToken(tokenData.access_token);
      
      setCurrentStep('completed');
    } catch (err) {
      console.error('Bootstrap token exchange error:', err);
      setError(err instanceof Error ? err.message : 'Bootstrap token exchange failed');
      setCurrentStep('error');
    }
  };

  const extractTokenFromJson = () => {
    try {
      const parsed = JSON.parse(azureToken);
      if (parsed.access_token) {
        setAzureToken(parsed.access_token);
      } else {
        setError('No access_token found in JSON. Please copy just the token value.');
      }
    } catch (e) {
      setError('Invalid JSON. Please copy just the token value, not the entire JSON.');
    }
  };

  const getStepStatus = (step: number) => {
    if (currentStep === 'error') return 'error';
    if (currentStep === 'start' && step === 0) return 'process';
    if (currentStep === 'redirecting' && step <= 1) return 'process';
    if (currentStep === 'waiting' && step <= 1) return 'process';
    if (currentStep === 'token-input' && step <= 2) return 'process';
    if (currentStep === 'exchanging' && step <= 3) return 'process';
    if (currentStep === 'completed' && step <= 4) return 'finish';
    return 'wait';
  };

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <CloudOutlined style={{ fontSize: 48, color: '#0078d4', marginBottom: 16 }} />
          <Title level={2}>Claim Admin Privileges</Title>
          <Paragraph>
            This Unity Catalog instance needs an initial administrator. 
            You can claim admin privileges using your Azure AD credentials.
          </Paragraph>
        </div>

        <Steps direction="vertical" size="small" style={{ marginBottom: 32 }}>
          <Step
            title="Initialize Bootstrap"
            description="Start the admin claiming process"
            status={getStepStatus(0)}
            icon={currentStep === 'redirecting' && <LoadingOutlined />}
          />
          <Step
            title="Azure Authentication"
            description="Authenticate with your Azure AD account"
            status={getStepStatus(1)}
          />
          <Step
            title="Copy Token"
            description="Copy the Azure token from the popup"
            status={getStepStatus(2)}
            icon={currentStep === 'token-input' && <LoadingOutlined />}
          />
          <Step
            title="Exchange Token"
            description="Exchange Azure token for Unity Catalog session"
            status={getStepStatus(3)}
            icon={currentStep === 'exchanging' && <LoadingOutlined />}
          />
          <Step
            title="Bootstrap Complete"
            description="Receive OWNER privileges in Unity Catalog"
            status={getStepStatus(4)}
          />
        </Steps>

        {currentStep === 'start' && (
          <div style={{ textAlign: 'center' }}>
            <Button
              type="primary"
              size="large"
              icon={<CloudOutlined />}
              onClick={handleStartBootstrap}
              style={{ minWidth: 200 }}
            >
              Start Bootstrap Process
            </Button>
            <div style={{ marginTop: 16, color: '#666' }}>
              <Paragraph type="secondary">
                You will be redirected to Azure AD to authenticate. 
                After successful authentication, you'll be granted OWNER privileges.
              </Paragraph>
            </div>
          </div>
        )}

        {currentStep === 'redirecting' && (
          <div style={{ textAlign: 'center' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Paragraph>Redirecting to Azure AD authentication...</Paragraph>
            </div>
          </div>
        )}

        {currentStep === 'waiting' && (
          <div style={{ textAlign: 'center' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Paragraph>Complete authentication in the popup window...</Paragraph>
              <Paragraph type="secondary">After authentication, close the popup to continue.</Paragraph>
            </div>
          </div>
        )}

        {currentStep === 'token-input' && (
          <div>
            <Alert
              type="info"
              message="Copy Azure Token"
              description="Copy the access_token value from the JSON response in the popup window and paste it below."
              style={{ marginBottom: 16 }}
            />
            <div style={{ marginBottom: 16 }}>
              <Text strong>Azure Token:</Text>
              <TextArea
                rows={4}
                value={azureToken}
                onChange={(e) => setAzureToken(e.target.value)}
                placeholder="Paste the access_token value here (or the entire JSON response)"
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <Button 
                type="default" 
                icon={<CopyOutlined />}
                onClick={extractTokenFromJson}
                style={{ marginRight: 8 }}
              >
                Extract from JSON
              </Button>
              <Button 
                type="primary" 
                onClick={handleTokenSubmit}
                disabled={!azureToken.trim()}
              >
                Exchange Token
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'exchanging' && (
          <div style={{ textAlign: 'center' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Paragraph>Exchanging Azure token for Unity Catalog session...</Paragraph>
            </div>
          </div>
        )}

        {currentStep === 'completed' && (
          <div style={{ textAlign: 'center' }}>
            <Alert
              type="success"
              message="Bootstrap Completed Successfully!"
              description={
                <div>
                  <Paragraph>
                    You now have OWNER privileges in Unity Catalog and are logged in.
                  </Paragraph>
                  <Button type="primary" onClick={() => onComplete && onComplete()}>
                    Continue to Admin Panel
                  </Button>
                </div>
              }
              showIcon
            />
          </div>
        )}

        {currentStep === 'error' && (
          <Alert
            type="error"
            message="Bootstrap Failed"
            description={error}
            showIcon
            action={
              <Button size="small" onClick={() => setCurrentStep('start')}>
                Try Again
              </Button>
            }
          />
        )}

        <div style={{ marginTop: 24, padding: 16, backgroundColor: '#f6f6f6', borderRadius: 6 }}>
          <Typography.Text strong>Important Notes:</Typography.Text>
          <ul style={{ marginTop: 8, marginBottom: 0 }}>
            <li>Only users from allowed domains can claim admin privileges</li>
            <li>Bootstrap is typically available only for new Unity Catalog instances</li>
            <li>You will receive OWNER role equivalent to the legacy local admin</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};
