import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface RequireAuthProps {
  children: React.ReactNode;
}

/** Redirects to /login if not authenticated (no tenant). */
export function RequireAuth({ children }: RequireAuthProps) {
  const location = useLocation();
  const tenantId = useAuthStore((s) => s.tenantId);

  if (!tenantId) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
