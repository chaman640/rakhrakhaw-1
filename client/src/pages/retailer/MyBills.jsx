import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, ChevronRight, ArrowLeft, Printer, IndianRupee, TriangleAlert } from 'lucide-react';
import api from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/format';
import {
  PageHeader, Card, StatCard, Table, Badge, Button, Chips, Pagination,
  EmptyState, Spinner, useToast,
} from '@/components/ui';
import InvoicePrint from '@/components/invoice/InvoicePrint';

const payTone = { unpaid: 'red', partial: 'amber', paid: 'green' };
const payLabel = { unpaid: 'Dena hai', partial: 'Kuch diya', paid: 'Poora diya' };

export function MyBills() {
  const toast = useToast();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/my-bills', { params: { paymentStatus, page, limit: 25 } });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentStatus, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [paymentStatus]);

  const totalDue = rows.reduce((s, r) => s + (r.dueAmount || 0), 0);

  const columns = [
    {
      key: 'invoiceNo', header: 'Bill',
      render: (r) => (
        <button onClick={() => navigate(`/my-bills/${r._id}`)} className="text-left">
          <p className="font-medium text-slate-900">{r.invoiceNo}</p>
          <p className="text-xs text-slate-500">{formatDate(r.invoiceDate)}</p>
        </button>
      ),
    },
    { key: 'grandTotal', header: 'Kul', align: 'right', render: (r) => formatMoney(r.grandTotal) },
    {
      key: 'dueAmount', header: 'Baaki', align: 'right',
      render: (r) => (r.dueAmount > 0
        ? <span className="tabular font-medium text-amber-700">{formatMoney(r.dueAmount)}</span>
        : <span className="text-slate-400">—</span>),
    },
    {
      key: 'paymentStatus', header: 'Status',
      render: (r) => <Badge tone={payTone[r.paymentStatus]}>{payLabel[r.paymentStatus]}</Badge>,
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (r) => (
        <button onClick={() => navigate(`/my-bills/${r._id}`)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Kholein">
          <ChevronRight size={18} />
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Mere bills" subtitle="Wholesaler ke bheje hue saare bill" />

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <StatCard label="Is page ke bills" value={meta.total} icon={FileText} tone="brand" />
        <StatCard label="Is page ka baaki" value={formatMoney(totalDue)} icon={TriangleAlert}
          tone={totalDue > 0 ? 'amber' : 'green'} />
      </div>

      <Card className="mb-5" padding={false}>
        <div className="p-4">
          <Chips value={paymentStatus} onChange={setPaymentStatus}
            options={[
              { value: 'all', label: 'Sab' },
              { value: 'unpaid', label: 'Dena hai' },
              { value: 'partial', label: 'Kuch diya' },
              { value: 'paid', label: 'Poora diya' },
            ]} />
        </div>
      </Card>

      <Card padding={false}>
        {!loading && !rows.length ? (
          <EmptyState icon={FileText} title="Abhi koi bill nahi"
            message="Jab wholesaler maal dega tab bill yahan aa jayega." />
        ) : (
          <>
            <div className="hidden md:block">
              <Table columns={columns} rows={rows} loading={loading} />
            </div>
            <div className="md:hidden">
              {loading ? <p className="py-12 text-center text-sm text-slate-400">Load ho raha hai...</p>
                : rows.map((r) => (
                  <button key={r._id} onClick={() => navigate(`/my-bills/${r._id}`)}
                    className="flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{r.invoiceNo}</p>
                      <p className="text-xs text-slate-500">{formatDate(r.invoiceDate)}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Badge tone={payTone[r.paymentStatus]}>{payLabel[r.paymentStatus]}</Badge>
                        <span className="tabular text-sm font-medium text-slate-900">
                          {formatMoney(r.grandTotal)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-slate-300" />
                  </button>
                ))}
            </div>
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total}
              limit={meta.limit} onChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}

export function MyBillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/my-bills/${id}`)
      .then((r) => setInvoice(r.data))
      .catch((err) => { toast.error(err.message); navigate('/my-bills', { replace: true }); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <div className="flex justify-center py-20 text-slate-400"><Spinner size={28} /></div>;
  if (!invoice) return null;

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => navigate('/my-bills')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} /> Mere saare bills
        </button>
        <div className="flex gap-2">
          {invoice.dueAmount > 0 && (
            <Button variant="secondary" size="sm" icon={IndianRupee} disabled>
              Payment karein
            </Button>
          )}
          <Button size="sm" icon={Printer} onClick={() => window.print()}>Print / PDF</Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <InvoicePrint invoice={invoice} />
      </div>
    </>
  );
}
