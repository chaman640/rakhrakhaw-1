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

  /*
    Galat darwaze pe aa gaya — ghar bhej do.

    Pehle retailer ko `/shop` (catalog) pe bheja jata tha. Ab har kharidaar ke
    paas kai dukaanein ho sakti hain, aur jab tak koi dukaan chuni na ho catalog
    ka koi matlab hi nahi banta — wo khali page dikhata. `/home` dono ke liye
    theek hai: wahan se aage ka rasta khud dikh jata hai.
  */
  if (roles?.length && !roles.includes(user.role)) {
    return <Navigate to="/home" replace />;
  }

  // Retailer approve nahi hua to sirf pending screen dikhegi
  if (!allowUnapproved && !isApproved) {
    return <Navigate to="/pending" replace />;
  }

  return children;
}
