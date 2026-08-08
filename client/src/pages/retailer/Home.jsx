import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store, ShoppingCart, Receipt, BookOpen, ChevronRight, Package,
  TruckIcon, CircleCheck, Bell,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatMoney, formatDate } from '@/lib/format';
import { Card, CardHeader, Button, Badge, Spinner, useToast } from '@/components/ui';

const STATUS_LABEL = {
  PLACED: 'Bheja hai', PACKED: 'Pack ho raha', READY: 'Tayyar hai',
  DELIVERED: 'Mil gaya', CANCELLED: 'Cancel',
};
const STATUS_TONE = {
  PLACED: 'blue', PACKED: 'amber', READY: 'brand', DELIVERED: 'green', CANCELLED: 'red',
};

export default function RetailerHome() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user, business } = useAuth();

  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/dashboard');
      setD(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex justify-center py-24 text-slate-400"><Spinner size={28} /></div>;
  }
  if (!d) return null;

  const due = d.balance;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Namaste, {user?.name?.split(' ')[0] || 'ji'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{business?.name} se juda hua</p>
      </div>

      {/* ---- Udhaar ---- */}
      <Card className={`mb-5 ${due > 0.01 ? 'border-amber-200 bg-amber-50/50' : 'border-emerald-200 bg-emerald-50/40'}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-600">
              {due > 0.01 ? 'Aapko dena hai' : due < -0.01 ? 'Advance jama hai' : 'Hisaab barabar hai'}
            </p>
            <p className={`mt-1 text-3xl font-semibold ${
              due > 0.01 ? 'text-amber-700' : due < -0.01 ? 'text-emerald-700' : 'text-slate-500'}`}>
              {formatMoney(Math.abs(due))}
            </p>
            {d.overLimit && (
              <p className="mt-1 text-xs font-medium text-red-600">
                Credit limit {formatMoney(d.creditLimit)} paar ho gayi
              </p>
            )}
          </div>
          <Button icon={BookOpen} onClick={() => navigate('/my-khata')}>Khata dekhein</Button>
        </div>
      </Card>

      {/* ---- Quick tiles ---- */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Chalu orders" value={d.orders.running} icon={ShoppingCart} tone="brand"
          sub={d.orders.ready ? `${d.orders.ready} tayyar hai` : 'Sab theek'}
          onClick={() => navigate('/my-orders')} />
        <Tile label="Is mahine kharida" value={formatMoney(d.monthSpend)} icon={Receipt} tone="brand"
          sub={`${d.monthBills} bill`} onClick={() => navigate('/my-bills')} />
        <Tile label="Kul order" value={d.orders.delivered} icon={CircleCheck} tone="green"
          sub="Mil chuke" onClick={() => navigate('/my-orders')} />
        <Tile label="Naye alert" value={d.unread} icon={Bell} tone={d.unread ? 'amber' : 'brand'}
          sub={d.unread ? 'Padh lijiye' : 'Kuch naya nahi'} onClick={() => navigate('/notifications')} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ---- Baaki bill ---- */}
        <Card padding={false}>
          <CardHeader className="p-5 pb-0" title="Ye bill baaki hain"
            action={<Button size="sm" variant="ghost" onClick={() => navigate('/my-bills')}>Sab</Button>} />
          {!d.openInvoices?.length ? (
            <p className="px-5 pb-6 pt-2 text-sm text-slate-400">Koi bill baaki nahi — sab clear hai</p>
          ) : (
            <div className="mt-2">
              {d.openInvoices.map((inv) => (
                <button key={inv._id} onClick={() => navigate(`/my-bills/${inv._id}`)}
                  className="flex w-full items-center gap-3 border-t border-slate-100 p-4 text-left hover:bg-slate-50">
                  <Receipt size={16} className="shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{inv.invoiceNo}</p>
                    <p className="text-xs text-slate-500">{formatDate(inv.invoiceDate)}</p>
                  </div>
                  <span className="tabular shrink-0 text-sm font-semibold text-amber-700">
                    {formatMoney(inv.dueAmount)}
                  </span>
                  <ChevronRight size={15} className="shrink-0 text-slate-300" />
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* ---- Recent orders ---- */}
        <Card padding={false}>
          <CardHeader className="p-5 pb-0" title="Pichhle orders"
            action={<Button size="sm" variant="ghost" onClick={() => navigate('/my-orders')}>Sab</Button>} />
          {!d.recentOrders?.length ? (
            <div className="px-5 pb-6 pt-2">
              <p className="text-sm text-slate-400">Abhi tak koi order nahi</p>
              <Button className="mt-3" icon={Store} onClick={() => navigate('/shop')}>
                Catalog dekhein
              </Button>
            </div>
          ) : (
            <div className="mt-2">
              {d.recentOrders.map((o) => (
                <button key={o._id} onClick={() => navigate(`/my-orders/${o._id}`)}
                  className="flex w-full items-center gap-3 border-t border-slate-100 p-4 text-left hover:bg-slate-50">
                  <TruckIcon size={16} className="shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{o.orderNo}</p>
                    <p className="text-xs text-slate-500">{formatDate(o.createdAt)}</p>
                  </div>
                  <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                  <span className="tabular shrink-0 text-sm font-medium text-slate-900">
                    {formatMoney(o.itemsTotal)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button icon={Store} onClick={() => navigate('/shop')}>Naya order karein</Button>
        <Button variant="secondary" icon={Package} onClick={() => navigate('/cart')}>Cart</Button>
      </div>
    </>
  );
}

function Tile({ label, value, sub, icon: Icon, tone, onClick }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700', green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <Card className="transition-colors hover:border-brand-300">
      <button onClick={onClick} className="flex w-full items-center gap-4 text-left">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm text-slate-500">{label}</p>
          <p className="mt-0.5 text-xl font-semibold text-slate-900">{value}</p>
          {sub && <p className="truncate text-xs text-slate-400">{sub}</p>}
        </div>
      </button>
    </Card>
  );
}
