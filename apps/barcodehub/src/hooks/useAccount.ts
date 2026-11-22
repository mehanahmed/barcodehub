import { useQuery } from '@tanstack/react-query';
import { getMyAccount } from 'zitejs/api';

export interface Account {
  isAdmin: boolean;
  noAdminsYet: boolean;
  tenant: null | {
    id: string; companyName: string; slug: string; logo: string | null; website: string; phone: string;
    address: string; gs1CompanyPrefix: string; status: string; subscriptionEnds: string | null;
  };
  package: null | { id: string; name: string; productLimit: number; analyticsEnabled: boolean; isFree: boolean };
  productCount: number;
  expired: boolean;
  atLimit: boolean;
}

export function useAccount() {
  return useQuery({
    queryKey: ['account'],
    queryFn: async () => (await getMyAccount({})).account as Account,
    retry: (failureCount, error) => {
      const msg = (error as Error)?.message || '';
      if (msg.includes('401') || msg.includes('UNAUTHORIZED')) return false;
      return failureCount < 1;
    },
  });
}
