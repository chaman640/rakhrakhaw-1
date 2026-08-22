import { useCallback, useEffect, useState } from 'react';
import { t } from '@/lib/i18n';
import { useNavigate } from 'react-router-dom';
import { FileText, ChevronRight, Store, ShoppingCart, IndianRupee, Clock } from 'lucide-react';
import api from '@/lib/api';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { formatMoney, formatDate } from '@/lib/format';
import {
  PageHeader, Card, StatCard, Button, Table, Badge, Chips,
  Pagination, EmptyState, SkeletonRows, useToast } from
'@/components/ui';

export const STATUS_TONE = {
  PLACED: 'blue', PACKED: 'amber', READY: 'brand', DELIVERED: 'green', CANCELLED: 'red'
};
export const STATUS_LABEL = {
  PLACED: 'Bheja gaya', PACKED: 'Pack ho raha hai', READY: 'Tayyar hai',
  DELIVERED: 'Mil gaya', CANCELLED: 'Cancel'
};

export default function MyOrders() {
  const toast = useToast();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState({ total: 0, chalu: 0, amount: 0 });
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (chupChaap = false) => {
    // `chupChaap` — apne aap taaza hote waqt skeleton mat dikhao (useAutoRefresh.js)
    if (!chupChaap) setLoading(true);
    try {
      const res = await api.get('/my-orders', { params: { status, page, limit: 20 } });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page]);

  useEffect(() => {
    api.get('/my-orders/summary').then((r) => setSummary(r.data)).catch(() => {});
  }, []);
  useEffect(() => {load();}, [load]);
  // Bina refresh dabaye screen khud taaza — wajah useAutoRefresh.js me
  useAutoRefresh(load);
  useEffect(() => {setPage(1);}, [status]);

  const columns = [
  {
    key: 'orderNo',
    header: 'Order',
    render: (r) =>
    <button onClick={() => navigate(`/my-orders/${r._id}`)} className="text-left">
          <p className="font-medium text-slate-900">{r.orderNo}</p>
          <p className="text-xs text-slate-500">{formatDate(r.orderDate || r.createdAt)}</p>
        </button>

  },
  { key: 'itemCount', header: 'Items', align: 'right', render: (r) => r.itemCount },
  { key: 'itemsTotal', header: 'Kul', align: 'right', render: (r) => formatMoney(r.itemsTotal) },
  {
    key: 'status', header: 'Status',
    render: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
  },
  {
    key: 'actions', header: '', align: 'right',
    render: (r) =>
    <button onClick={() => navigate(`/my-orders/${r._id}`)}
    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label={t("Kholein")}>
          <ChevronRight size={18} />
        </button>

  }];


  return (
    <>
      <PageHeader
        title={t("My Orders")}
        subtitle={t("Aapke bheje hue saare order")}
        action={<Button icon={Store} variant="secondary" onClick={() => navigate('/shop')}>{t("Catalog")}</Button>} />
      

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard label={t("Kul orders")} value={summary.total} icon={FileText} tone="brand" />
        <StatCard label={t("Chal rahe hain")} value={summary.chalu} icon={Clock} tone="amber" />
        <StatCard label={t("Kul keemat")} value={formatMoney(summary.amount)} icon={IndianRupee} tone="green" />
      </div>

      <Card className="mb-5" padding={false}>
        <div className="p-4">
          <Chips value={status} onChange={setStatus}
          options={[
          { value: 'all', label: 'Sab' },
          { value: 'PLACED', label: 'Bheja gaya' },
          { value: 'PACKED', label: 'Pack ho raha' },
          { value: 'READY', label: 'Tayyar' },
          { value: 'DELIVERED', label: 'Mil gaya' }]
          } />
        </div>
      </Card>

      <Card padding={false}>
        {!loading && !rows.length ?
        <EmptyState
          icon={ShoppingCart}
          title={status === 'all' ? 'Abhi koi order nahi kiya' : 'Is status me koi order nahi'}
          message={t("Catalog se saman chun kar apna pehla order bhej dein.")}
          action={<Button icon={Store} onClick={() => navigate('/shop')}>{t("Catalog kholein")}</Button>} /> :


        <>
            <div className="hidden md:block">
              <Table columns={columns} rows={rows} loading={loading} />
            </div>
            <div className="md:hidden">
              {loading ? <SkeletonRows /> :
            rows.map((r) =>
            <button key={r._id} onClick={() => navigate(`/my-orders/${r._id}`)}
            className="flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{r.orderNo}</p>
                      <p className="text-xs text-slate-500">{t("{a0} · {a1} item", { a0:
                    formatDate(r.orderDate || r.createdAt), a1: r.itemCount })}
                </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                        <span className="tabular text-sm font-medium text-slate-900">
                          {formatMoney(r.itemsTotal)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-slate-300" />
                  </button>
            )}
            </div>
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total}
          limit={meta.limit} onChange={setPage} />
          </>
        }
      </Card>
    </>);

}
