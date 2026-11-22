import { useEffect, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from 'zitejs/auth';
import { Loader2 } from 'lucide-react';
import { getStoredUser } from '../lib/auth';

export default function AuthGate({ children, loginPath = '/login' }: { children: ReactNode; loginPath?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, isLoading: authLoading } = useAuth();
  const localUser = getStoredUser();

  // If server check has completed and returned null, do not trust stale localStorage
  const user = authUser || (authLoading ? localUser : null);
  const isLoading = authLoading && !user;

  useEffect(() => {
    if (!authLoading && !authUser) {
      // Server session is dead or expired: clean stale cache and redirect to login
      try {
        localStorage.removeItem('barcodehub_user');
        localStorage.removeItem('zite.auth.token');
        localStorage.removeItem('better-auth.session_token');
        delete (window as any)._ziteUsageToken;
      } catch {
        // ignore storage errors
      }
      const redirectUrl = encodeURIComponent(location.pathname + location.search);
      navigate(`${loginPath}?redirectUrl=${redirectUrl}`, { replace: true });
    }
  }, [authLoading, authUser, navigate, location, loginPath]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
