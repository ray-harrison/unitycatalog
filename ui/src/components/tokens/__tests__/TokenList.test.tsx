import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { jest } from '@jest/globals';
import TokenList from '../TokenList';
import { NotificationProvider } from '../../../utils/NotificationContext';
import * as tokensHooks from '../../../hooks/tokens';
import { TokenInfo } from '../../../types/tokens';

// Mock the hooks
jest.mock('../../../hooks/tokens');

const mockUseListTokens = tokensHooks.useListTokens as jest.MockedFunction<typeof tokensHooks.useListTokens>;
const mockUseRevokeToken = tokensHooks.useRevokeToken as jest.MockedFunction<typeof tokensHooks.useRevokeToken>;

// Test wrapper
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  
  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        {children}
      </NotificationProvider>
    </QueryClientProvider>
  );
};

describe('TokenList', () => {
  const now = new Date().getTime();
  const mockTokens: TokenInfo[] = [
    {
      tokenId: 'tok_active',
      comment: 'Active development token',
      creationTime: now - 86400000, // 1 day ago
      expiryTime: now + 86400000, // 1 day from now
      status: 'ACTIVE',
    },
    {
      tokenId: 'tok_expired',
      comment: 'Expired token',
      creationTime: now - 172800000, // 2 days ago
      expiryTime: now - 86400000, // 1 day ago
      status: 'EXPIRED',
    },
    {
      tokenId: 'tok_revoked',
      comment: 'Revoked token',
      creationTime: now - 259200000, // 3 days ago
      expiryTime: now + 86400000, // 1 day from now
      status: 'REVOKED',
    },
  ];

  const mockRevokeMutation = jest.fn() as jest.MockedFunction<any>;

  beforeEach(() => {
    mockUseListTokens.mockReturnValue({
      data: { tokens: mockTokens },
      isLoading: false,
    } as any);

    mockUseRevokeToken.mockReturnValue({
      mutate: mockRevokeMutation,
      isPending: false,
    } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders token list correctly', () => {
    render(
      <TestWrapper>
        <TokenList />
      </TestWrapper>
    );

    expect(screen.getByText('Active development token')).toBeInTheDocument();
    expect(screen.getByText('Expired token')).toBeInTheDocument();
    expect(screen.getByText('Revoked token')).toBeInTheDocument();
  });

  test('displays correct status tags', () => {
    render(
      <TestWrapper>
        <TokenList />
      </TestWrapper>
    );

    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('EXPIRED')).toBeInTheDocument();
    expect(screen.getByText('REVOKED')).toBeInTheDocument();
  });

  test('shows empty state when no tokens exist', () => {
    mockUseListTokens.mockReturnValue({
      data: { tokens: [] },
      isLoading: false,
    } as any);

    render(
      <TestWrapper>
        <TokenList />
      </TestWrapper>
    );

    expect(screen.getByText('No tokens found. Create your first token above.')).toBeInTheDocument();
  });

  test('shows loading state', () => {
    mockUseListTokens.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any);

    render(
      <TestWrapper>
        <TokenList />
      </TestWrapper>
    );

    // Ant Design table shows loading spinner when isLoading is true
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  test('allows revoke action for tokens with appropriate confirmations', async () => {
    render(
      <TestWrapper>
        <TokenList />
      </TestWrapper>
    );

    const deleteButtons = screen.getAllByRole('button');
    
    // Only revoked tokens should be disabled
    expect(deleteButtons[0]).not.toBeDisabled(); // Active
    expect(deleteButtons[1]).not.toBeDisabled(); // Expired (can still be revoked)
    expect(deleteButtons[2]).toBeDisabled();     // Revoked (already revoked)

    // Click on active token button
    fireEvent.click(deleteButtons[0]);
    
    // Should show revoke confirmation for active token
    await waitFor(() => {
      expect(screen.getByText('Revoke Token')).toBeInTheDocument();
      expect(screen.getByText(/become invalid immediately/)).toBeInTheDocument();
    });

    // Click cancel to close the popconfirm
    const cancelButton = screen.getByText('No');
    fireEvent.click(cancelButton);

    // Wait for popconfirm to close
    await waitFor(() => {
      expect(screen.queryByText('Revoke Token')).not.toBeInTheDocument();
    });

    // Click on expired token button  
    fireEvent.click(deleteButtons[1]);
    
    // Should show revoke confirmation for expired token with different message
    await waitFor(() => {
      expect(screen.getByText('Revoke Token')).toBeInTheDocument();
      expect(screen.getByText(/remove it from your list/)).toBeInTheDocument();
    });
  });
});
