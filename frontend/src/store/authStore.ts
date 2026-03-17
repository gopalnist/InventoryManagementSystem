import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const STORAGE_KEY = 'nourish-auth';

export interface TenantOption {
  id: string;
  name: string;
}

export const TENANT_OPTIONS: TenantOption[] = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'Nourishyou' },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Other Customer' },
];

interface AuthState {
  tenantId: string | null;
  tenantName: string | null;
  setTenant: (id: string, name: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      tenantId: null,
      tenantName: null,
      setTenant: (id: string, name: string) => set({ tenantId: id, tenantName: name }),
      logout: () => set({ tenantId: null, tenantName: null }),
      isAuthenticated: () => !!get().tenantId,
    }),
    { name: STORAGE_KEY }
  )
);
