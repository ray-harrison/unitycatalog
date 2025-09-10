import { useQuery } from '@tanstack/react-query';

interface BootstrapStatus {
  available: boolean;
  needsBootstrap: boolean;
  error?: string;
}

export const useBootstrapStatus = () => {
  return useQuery<BootstrapStatus>({
    queryKey: ['bootstrap-status'],
    queryFn: async (): Promise<BootstrapStatus> => {
      try {
        // Check bootstrap status using the correct endpoint
        const response = await fetch('/api/1.0/unity-control/admins/status/bootstrap-status');
        
        if (response.ok) {
          const status = await response.json();
          return { 
            available: status.bootstrapEnabled, 
            needsBootstrap: status.bootstrapEnabled && !status.hasAzureAdmin 
          };
        } else {
          return { available: false, needsBootstrap: false, error: 'Bootstrap status not available' };
        }
      } catch (error) {
        return { available: false, needsBootstrap: false, error: 'Bootstrap status check failed' };
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
