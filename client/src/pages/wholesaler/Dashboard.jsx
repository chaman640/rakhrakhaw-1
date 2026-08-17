import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IndianRupee, TrendingUp, TrendingDown, ShoppingCart, Package, Wallet,
  TriangleAlert, ArrowRight, Plus, FileText, UserCheck, Clock, BookOpen,
  Receipt, Truck, CircleAlert,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatMoney, formatQty, formatDateTime } from '@/lib/format';
import {
  Card, CardHeader, Button, Badge, Spinner, TrendChart, useToast,
} from '@/components/ui';
import { t } from '@/lib/i18n';

const ACTIVITY_ICON = { invoice: Receipt, order: ShoppingCart, payment: Wallet };

export default function Dashboard() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user, business, can } = useAuth();

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

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Subah bakhair' : hour < 17 ? 'Namaste' : 'Shubh sandhya';

  const todo = [
    d.todo?.newOrders > 0 && {
      label: `${d.todo?.newOrders} naya order`, sub: t('Pack karna hai'),
      icon: ShoppingCart, tone: 'brand', to: '/orders', perm: 'orders',
    },
    d.todo?.pendingPayments > 0 && {
      label: `${d.todo?.pendingPayments} payment`, sub: t('Confirm karna hai'),
      icon: Clock, tone: 'amber', to: '/payments?status=pending', perm: 'khata',
    },
    d.todo?.pendingRetailers > 0 && {
      label: `${d.todo?.pendingRetailers} retailer`, sub: t('Approve karna hai'),
      icon: UserCheck, tone: 'blue', to: '/retailers', perm: 'parties',
    },
    d.todo?.lowStock > 0 && {
      label: `${d.todo?.lowStock} item kam`, sub: t('Mangwa lein'),
      icon: TriangleAlert, tone: 'red', to: '/reports?tab=stock&filter=low', perm: 'reports',
    },
  ].filter(Boolean).filter((row) => !row.perm || can(row.perm));

  return (
    <>
      {/* ---- Greeting ---- */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          {greet}, {user?.name?.split(' ')[0] || 'Bhai'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {business?.name} · {new Date().toLocaleDateString('en-IN', {
            weekday: 'long', day: 'numeric', month: 'long',
          })}
        </p>
      </div>

      {/* ---- Aaj kya karna hai ---- */}
      {todo.length > 0 && (
        <Card className="mb-5 border-brand-200 bg-brand-50/40">
          <CardHeader title={t('Aaj ye dekh lijiye')} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {todo.map((row) => (
              <button key={row.label} onClick={() => navigate(row.to)}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-brand-300 focus-ring">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  { brand: 'bg-brand-50 text-brand-700', amber: 'bg-amber-50 text-amber-700',
                    blue: 'bg-blue-50 text-blue-700', red: 'bg-red-50 text-red-700' }[row.tone]}`}>
                  <row.icon size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{t(row.label)}</p>
                  <p className="truncate text-xs text-slate-500">{row.sub}</p>
                </div>
                <ArrowRight size={15} className="shrink-0 text-slate-300" />
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* ---- Aaj ke number ---- */}
      {/* Jis staff ko ijazat nahi, server uska hissa bhejta hi nahi — isliye har jagah check */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {d.sale && (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-slate-500">{t('Aaj ki sale')}</p>
              {/* Hero number — proportional figures, tabular nahi */}
              <p className="mt-1 text-3xl font-semibold text-slate-900">{formatMoney(d.sale.today)}</p>
              <p className="mt-1 text-xs text-slate-400">{d.sale.todayBills} bill</p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <IndianRupee size={20} />
            </div>
          </div>
          {d.sale.changePct !== null && (
            <p className={`mt-3 flex items-center gap-1 text-xs font-medium ${
              d.sale.changePct >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {d.sale.changePct >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {Math.abs(d.sale.changePct)}% <span className="font-normal text-slate-400">{t('kal se')}</span>
            </p>
          )}
        </Card>
        )}

        {d.sale && (
          <StatBox label={t('Is mahine')} value={formatMoney(d.sale.month)} sub={`${d.sale.monthBills} bill`}
            icon={FileText} tone="brand" onClick={() => navigate('/invoices')} />
        )}
        {d.collection && (
          <StatBox label={t('Aaj paisa aaya')} value={formatMoney(d.collection.today)}
            sub={`Mahine me ${formatMoney(d.collection.month)}`}
            icon={Wallet} tone="green" onClick={() => navigate('/payments')} />
        )}
        {d.khata && (
          <StatBox label={t('Udhaar baaki')} value={formatMoney(d.khata.receivable)}
            sub={`${d.khata.activeRetailers} active retailer`} icon={BookOpen}
            tone={d.khata.receivable > 0 ? 'amber' : 'green'} onClick={() => navigate('/khata')} />
        )}
      </div>

      {/* ---- Chart + orders ---- */}
      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        {d.trend && (
          <Card className="lg:col-span-2">
            <TrendChart data={d.trend} height={240} />
          </Card>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
          {d.orders && (
          <Card>
            <CardHeader title={t('Orders')}
              action={<Button size="sm" variant="ghost" onClick={() => navigate('/orders')}>{t('Sab')}</Button>} />
            <div className="space-y-2.5">
              <OrderLine label={t('Naye')} value={d.orders.new} tone="blue" />
              <OrderLine label={t('Pack ho rahe')} value={d.orders.packed} tone="amber" />
              <OrderLine label={t('Tayyar hain')} value={d.orders.ready} tone="brand" />
              <OrderLine label={t('De diye')} value={d.orders.delivered} tone="green" />
            </div>
          </Card>
          )}

          {d.stock && (
          <Card>
            <CardHeader title={t('Stock')}
              action={<Button size="sm" variant="ghost" onClick={() => navigate('/items')}>{t('Items')}</Button>} />
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">{t('Kul item')}</dt>
                <dd className="font-medium text-slate-900">{d.stock.items}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">{t('Stock ki keemat')}</dt>
                <dd className="tabular font-medium text-slate-900">{formatMoney(d.stock.value)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">{t('Kam bache')}</dt>
                <dd className={`font-medium ${d.stock.low ? 'text-amber-700' : 'text-slate-900'}`}>{d.stock.low}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">{t('Khatam')}</dt>
                <dd className={`font-medium ${d.stock.outOfStock ? 'text-red-600' : 'text-slate-900'}`}>{d.stock.outOfStock}</dd></div>
            </dl>
          </Card>
          )}
        </div>
      </div>

      {/* ---- Kam stock ---- */}
      {d.stock?.lowItems?.length > 0 && (
        <Card className="mb-5 border-amber-200">
          <CardHeader title={t('Ye khatam hone wale hain')} subtitle={t('Supplier ko phone kar dijiye')}
            action={<Button size="sm" variant="secondary" icon={Truck}
              onClick={() => navigate('/purchases/new')}>{t('Purchase')}</Button>} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {d.stock.lowItems.map((i) => (
              <div key={i._id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  i.stockQty <= 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
                  {i.stockQty <= 0 ? <CircleAlert size={15} /> : <Package size={15} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{i.name}</p>
                  <p className="text-xs text-slate-500">
                    {i.stockQty <= 0 ? 'Khatam' : `${formatQty(i.stockQty, i.unit)} bacha`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ---- Top items / retailers / activity ---- */}
      <div className="grid gap-5 lg:grid-cols-3">
        {d.topItems && (
        <Card>
          <CardHeader title={t('Sabse zyada bike')} subtitle={t('Is mahine')} />
          {!d.topItems.length ? <Empty text="Abhi koi sale nahi" /> : (
            <ol className="space-y-3">
              {d.topItems.map((row, i) => (
                <li key={row._id} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{row.name}</p>
                    <p className="text-xs text-slate-500">{formatQty(row.qty, row.unit)}</p>
                  </div>
                  <span className="tabular shrink-0 text-sm font-medium text-slate-900">
                    {formatMoney(row.amount)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        )}

        {d.topRetailers && (
        <Card>
          <CardHeader title={t('Top retailers')} subtitle={t('Is mahine')} />
          {!d.topRetailers.length ? <Empty text="Abhi koi bill nahi" /> : (
            <ol className="space-y-3">
              {d.topRetailers.map((row, i) => (
                <li key={row._id}>
                  <button onClick={() => navigate(`/retailers/${row._id}?tab=khata`)}
                    className="flex w-full items-center gap-3 text-left">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{row.name}</p>
                      <p className="text-xs text-slate-500">{row.bills} bill</p>
                    </div>
                    <span className="tabular shrink-0 text-sm font-medium text-slate-900">
                      {formatMoney(row.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </Card>
        )}

        <Card>
          <CardHeader title={t('Abhi abhi kya hua')} />
          {!d.activity?.length ? <Empty text="Kuch nahi hua abhi tak" /> : (
            <ul className="space-y-3">
              {d.activity?.map((a, i) => {
                const Icon = ACTIVITY_ICON[a.type] || FileText;
                return (
                  <li key={i}>
                    <button onClick={() => navigate(a.link)}
                      className="flex w-full items-start gap-3 text-left">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <Icon size={13} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-slate-900">{a.title}</p>
                        <p className="truncate text-xs text-slate-500">{a.subtitle}</p>
                        <p className="text-xs text-slate-400">{formatDateTime(a.at)}</p>
                      </div>
                      <span className={`tabular shrink-0 text-sm font-medium ${
                        a.type === 'payment' && a.direction === 'IN' ? 'text-emerald-700' : 'text-slate-900'}`}>
                        {formatMoney(a.amount)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* ---- Quick actions (mobile pe kaam ke) ---- */}
      <div className="mt-5 flex flex-wrap gap-2">
        {can('invoices') && <Button icon={Plus} onClick={() => navigate('/invoices/new')}>{t('Naya bill')}</Button>}
        {can('purchases') && (
          <Button variant="secondary" icon={Truck} onClick={() => navigate('/purchases/new')}>{t('Purchase')}</Button>
        )}
        {can('khata') && (
          <Button variant="secondary" icon={Wallet} onClick={() => navigate('/payments')}>{t('Paisa entry')}</Button>
        )}
        {can('items') && (
          <Button variant="secondary" icon={Package} onClick={() => navigate('/items')}>{t('Items')}</Button>
        )}
      </div>
    </>
  );
}

function StatBox({ label, value, sub, icon: Icon, tone, onClick }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700', green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700',
  };
  return (
    // Poora card clickable hai (Card khud handle karta hai) — andar dobara button
    // rakhne se click do baar chalta tha
    <Card className="transition-colors hover:border-brand-300" onClick={onClick}>
      <div className="flex w-full items-start justify-between gap-3 text-left">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
          {sub && <p className="mt-1 truncate text-xs text-slate-400">{sub}</p>}
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon size={20} />
        </div>
      </div>
    </Card>
  );
}

function OrderLine({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-slate-600">
        <Badge tone={tone}>{value}</Badge> {label}
      </span>
    </div>
  );
}

const Empty = ({ text }) => <p className="py-6 text-center text-sm text-slate-400">{text}</p>;
