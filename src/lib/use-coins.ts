import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getCoins } from './coins.functions';
import { useAuth } from './use-auth';

export function useCoins() {
  const { user } = useAuth();
  const fetchCoins = useServerFn(getCoins);
  return useQuery({ queryKey: ['coins', user?.id], queryFn: () => fetchCoins(), enabled: Boolean(user), retry: false });
}