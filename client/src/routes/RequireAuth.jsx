import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Spinner from '@/components/ui/Spinner';

/**
 * Role-based route guard.
 *
 * roles      — ['wholesaler'] ya ['retailer']; khali chhodo to dono allowed
 * allowUnapproved — pending/blocked retailer bhi is page ko dekh sakta hai
 */
export default function RequireAuth({ roles, allowUnapproved = false, children }) {
  const { user, loading, isApproved } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400">
        <Spinner size={28} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles?.length && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'retailer' ? '/shop' : '/dashboard'} replace />;
  }

  // Retailer approve nahi hua to sirf pending screen dikhegi
  if (!allowUnapproved && !isApproved) {
    return <Navigate to="/pending" replace />;
  }

  return children;
}
