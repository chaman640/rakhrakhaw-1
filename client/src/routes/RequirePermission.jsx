import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, Button } from '@/components/ui';
import { Lock } from 'lucide-react';

/**
 * Staff URL me seedha type karke bhi andar na ghus jaye (Part 11).
 *
 * Server pehle hi 403 deta hai — ye sirf isliye hai ki page khul kar
 * "error" dikhane se behtar hai साफ बता dena ki ijazat nahi hai.
 */
export default function RequirePermission({ permission, children }) {
  const { can, loading, isWholesaler } = useAuth();

  if (loading) return null;
  if (!isWholesaler) return <Navigate to="/" replace />;
  if (can(permission)) return children;

  return (
    <Card className="mx-auto max-w-md text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Lock size={22} />
      </div>
      <h2 className="text-base font-semibold text-slate-900">Ye page aapke liye nahi khula</h2>
      <p className="mt-1 text-sm text-slate-500">
        Dukaan ke malik ne aapko is hisse ki ijazat nahi di hai. Zarurat ho to unse kahiye.
      </p>
      <Button className="mt-4" variant="secondary" onClick={() => window.history.back()}>
        Peeche jayein
      </Button>
    </Card>
  );
}
