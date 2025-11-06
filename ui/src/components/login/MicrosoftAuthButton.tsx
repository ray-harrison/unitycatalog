import React, { useCallback } from 'react';
import { Button } from 'antd';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../../utils/msalConfig';

interface MicrosoftAuthButtonProps {
  onMicrosoftSignIn: (idToken: string) => void;
}

/**
 * Microsoft/Azure AD sign-in button component.
 * Uses MSAL library to initiate popup-based authentication flow.
 */
export default function MicrosoftAuthButton({
  onMicrosoftSignIn,
}: MicrosoftAuthButtonProps) {
  const { instance } = useMsal();

  const handleLogin = useCallback(async () => {
    try {
      // Initiate popup-based login
      const response = await instance.loginPopup(loginRequest);

      if (response && response.idToken) {
        // Pass the ID token to the callback
        onMicrosoftSignIn(response.idToken);
      }
    } catch (error) {
      console.error('Microsoft sign-in error:', error);
    }
  }, [instance, onMicrosoftSignIn]);

  return (
    <Button
      style={{
        width: 240,
        height: 40,
        backgroundColor: '#2F2F2F',
        color: 'white',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
      }}
      onClick={handleLogin}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="21"
        height="21"
        viewBox="0 0 21 21"
      >
        <rect x="1" y="1" width="9" height="9" fill="#f25022" />
        <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
        <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
        <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
      </svg>
      Sign in with Microsoft
    </Button>
  );
}
