import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { UserSettings } from '@/lib/types';

// Temporary: Use mock store as fallback until API is implemented
import { store } from '@/lib/store';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      try {
        return await api.get<UserSettings>('/api/settings');
      } catch (error) {
        // Fallback to mock store if endpoint doesn't exist yet
        console.warn('Settings endpoint not implemented yet, using mock store');
        return store.getSettings();
      }
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<UserSettings>) => {
      try {
        return await api.put<UserSettings>('/api/settings', data);
      } catch (error) {
        // Fallback to mock store
        console.warn('Update settings endpoint not implemented yet, using mock store');
        return store.updateSettings(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}
