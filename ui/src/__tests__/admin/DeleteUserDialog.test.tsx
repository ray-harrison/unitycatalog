import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import DeleteUserDialog from '../../components/admin/DeleteUserDialog';

// Mock hooks
jest.mock('../../hooks/admin/useUsers', () => ({
  useDeleteUser: () => ({ mutateAsync: jest.fn().mockResolvedValue(undefined), isPending: false }),
}));

describe('DeleteUserDialog', () => {
  const setup = (props: Partial<React.ComponentProps<typeof DeleteUserDialog>> = {}) => {
    const queryClient = new QueryClient();
    const defaultProps = {
      open: true,
      onClose: jest.fn(),
      userId: 'user-123',
      userEmail: 'test@example.com',
      isLastOwner: false,
      onDeleted: jest.fn(),
      ...props,
    };
    return {
      ...defaultProps,
      ...render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DeleteUserDialog {...defaultProps} />
          </MemoryRouter>
        </QueryClientProvider>
      ),
    };
  };

  it('disables delete button until email confirmation matches', async () => {
    setup();
    const deleteButton = await screen.findByRole('button', { name: /delete user/i });
    expect(deleteButton).toBeDisabled();
    const input = screen.getByRole('textbox', { name: /confirm user email/i });
    await userEvent.type(input, 'wrong@example.com');
    expect(deleteButton).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, 'test@example.com');
    expect(deleteButton).toBeEnabled();
  });

  it('shows last owner warning and keeps disabled state', async () => {
    setup({ isLastOwner: true });
    const warning = await screen.findByText(/last METASTORE OWNER/i);
    expect(warning).toBeInTheDocument();
    const input = screen.getByRole('textbox', { name: /confirm user email/i });
    await userEvent.type(input, 'test@example.com');
    const deleteButton = screen.getByRole('button', { name: /delete user/i });
    expect(deleteButton).toBeDisabled();
  });

  it('calls onDeleted after successful mutation', async () => {
    const { onDeleted } = setup();
    const input = screen.getByRole('textbox', { name: /confirm user email/i });
    await userEvent.type(input, 'test@example.com');
    const deleteButton = screen.getByRole('button', { name: /delete user/i });
    await userEvent.click(deleteButton);
    // Mutation is async; allow microtasks to flush
    await screen.findByText(/Email matches/i); // dialog content still present momentarily
    expect(onDeleted).toHaveBeenCalled();
  });
});