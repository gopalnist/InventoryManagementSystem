import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, LogIn } from 'lucide-react';
import { useAuthStore, TENANT_OPTIONS } from '../store/authStore';

export function Login() {
  const [tenantId, setTenantId] = useState<string>(TENANT_OPTIONS[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const setTenant = useAuthStore((s) => s.setTenant);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const tenant = TENANT_OPTIONS.find((t) => t.id === tenantId);
    if (!tenant) {
      setError('Please select a customer.');
      return;
    }
    setTenant(tenant.id, tenant.name);
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -right-40 -top-20 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
            <Package className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">IMS</h1>
          <p className="mt-1 text-sm text-slate-500">Inventory Management — sign in with your customer account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="tenant" className="block text-sm font-medium text-slate-700">
              Customer / Tenant
            </label>
            <select
              id="tenant"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            >
              {TENANT_OPTIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              You will only see reports and data for the selected customer.
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 font-semibold text-white shadow-lg hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <LogIn className="h-5 w-5" />
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
