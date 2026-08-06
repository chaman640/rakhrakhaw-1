import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Wallet, Plus, IndianRupee, Calendar, Clock, Trash2, Check, X,
  Banknote, Smartphone, Landmark, FileCheck,
} from 'lucide-react';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatMoney, formatDate } from '@/lib/format';
import {
  PageHeader, Card, CardHeader, StatCard, Button, Table, Badge, SearchInput,
  Chips, Input, Pagination, EmptyState, Modal, Textarea, ConfirmModal, useToast,
} from '@/components/ui';
import PaymentFormModal from './payments/PaymentFormModal';

const MODE_ICON = { CASH: Banknote, UPI: Smartphone, BANK: Landmark, CHEQUE: FileCheck };
const statusTone = { pending: 'amber', confirmed: 'green', failed: 'red' };
const statusLabel = { pending: 'Confirm karna hai', confirmed: 'Ho gaya', failed: 'Reject' };

export default function Payments() {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState([]);
  const [pending, setPending] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [direction, setDirection] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/payments', {
        params: {
          q: debouncedQ, status, direction,
          from: from || undefined, to: to || undefined, page, limit: 25,
        },
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, status, direction, from, to, page]);

  const loadSide = useCallback(() => {
    api.get('/payments/stats').then((r) => setStats(r.data)).catch(() => {});
    api.get('/payments', { params: { status: 'pending', limit: 20 } })
      .then((r) => setPending(r.data)).catch(() => {});
  }, []);

  useEffect(() => { loadSide(); }, [loadSide]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedQ, status, direction, from, to]);
  useEffect(() => {
    // URL me ?status=pending aaye (notification se) to filter set ho jaye
    const s = searchParams.get('status');
    if (s && s !== status) setStatus(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const refreshAll = () => { load(); loadSide(); };

  async function confirm(p) {
    setBusy(true);
    try {
      const res = await api.post(`/payments/${p._id}/confirm`);
      toast.success(res.message);
      refreshAll();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function doReject() {
    setBusy(true);
    try {
      const res = await api.post(`/payments/${rejecting._id}/reject`, { reason: rejectReason.trim() });
      toast.success(res.message);
      setRejecting(null); setRejectReason('');
      refreshAll();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    setBusy(true);
    try {
      const res = await api.delete(`/payments/${deleting._id}`);
      toast.success(res.message);
      setDeleting(null);
      refreshAll();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    {
      key: 'paymentNo', header: 'Payment',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.paymentNo}</p>
          <p className="text-xs text-slate-500">{formatDate(r.date)}</p>
        </div>
      ),
    },
    {
      key: 'party', header: 'Party',
      render: (r) => (
        <button
          onClick={() => navigate(`${r.party?.type === 'supplier' ? '/suppliers' : '/retailers'}/${r.partyId}?tab=khata`)}
          className="text-left text-brand-700 underline-offset-2 hover:underline"
        >
          {r.party?.name || '—'}
        </button>
      ),
    },
    {
      key: 'mode', header: 'Kaise',
      render: (r) => {
        const Icon = MODE_ICON[r.mode] || Banknote;
        return (
          <span className="flex items-center gap-1.5 text-slate-600">
            <Icon size={14} /> {r.mode}
            {r.reference && <span className="text-xs text-slate-400">· {r.reference}</span>}
          </span>
        );
      },
    },
    {
      key: 'amount', header: 'Amount', align: 'right',
      render: (r) => (
        <span className={r.direction === 'IN' ? 'font-medium text-emerald-700' : 'font-medium text-red-600'}>
          {r.direction === 'IN' ? '+' : '−'}{formatMoney(r.amount)}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: (r) => <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>,
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          {r.status === 'pending' && (
            <>
              <button onClick={() => confirm(r)} disabled={busy}
                className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                aria-label={`${r.paymentNo} confirm karein`}>
                <Check size={16} />
              </button>
              <button onClick={() => setRejecting(r)}
                className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                aria-label={`${r.paymentNo} reject karein`}>
                <X size={16} />
              </button>
            </>
          )}
          <button onClick={() => setDeleting(r)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
            aria-label={`${r.paymentNo} delete karein`}>
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Cash, UPI, bank — paisa aane-jaane ka poora record"
        action={<Button icon={Plus} onClick={() => setFormOpen(true)}>Paisa entry</Button>}
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Aaj aaya" value={formatMoney(stats.todayAmount || 0)} icon={IndianRupee}
          tone="green" sub={`${stats.todayCount || 0} payment`} />
        <StatCard label="Is mahine" value={formatMoney(stats.monthAmount || 0)} icon={Calendar}
          tone="brand" sub={`${stats.monthCount || 0} payment`} />
        <StatCard label="Confirm karna hai" value={stats.pendingCount || 0} icon={Clock}
          tone={stats.pendingCount > 0 ? 'amber' : 'green'} sub={formatMoney(stats.pendingAmount || 0)} />
        <StatCard label="Kul entry" value={meta.total || 0} icon={Wallet} tone="brand" />
      </div>

      {/* ---- Pending queue: retailer ne UPI bheja, confirm karna hai ---- */}
      {pending.length > 0 && (
        <Card className="mb-5 border-amber-200 bg-amber-50/40">
          <CardHeader
            title={`${pending.length} payment confirm karna hai`}
            subtitle="Retailer ne bheja hai — apna account check karke haan/na karein"
          />
          <div className="space-y-2">
            {pending.map((p) => (
              <div key={p._id}
                className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    {p.party?.name} — {formatMoney(p.amount)}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {p.mode} · {formatDate(p.date)}
                    {p.reference && ` · UTR ${p.reference}`}
                    {p.note && ` · ${p.note}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="success" icon={Check} loading={busy}
                    onClick={() => confirm(p)}>Mil gaya</Button>
                  <Button size="sm" variant="secondary" icon={X}
                    onClick={() => setRejecting(p)}>Nahi mila</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-5" padding={false}>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <SearchInput value={q} onChange={setQ} placeholder="Payment no, party, UTR..."
            className="w-full sm:w-56" />
          <Chips value={status}
            onChange={(v) => { setStatus(v); setSearchParams(v === 'all' ? {} : { status: v }); }}
            options={[
              { value: 'all', label: 'Sab' },
              { value: 'pending', label: 'Pending' },
              { value: 'confirmed', label: 'Confirm' },
              { value: 'failed', label: 'Reject' },
            ]} />
          <Chips value={direction} onChange={setDirection}
            options={[
              { value: 'all', label: 'Dono' },
              { value: 'IN', label: 'Aaya' },
              { value: 'OUT', label: 'Diya' },
            ]} />
          <div className="w-36"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="w-36"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      </Card>

      <Card padding={false}>
        {!loading && !rows.length ? (
          <EmptyState
            icon={Wallet}
            title="Abhi koi payment nahi"
            message="Retailer se paisa mile ya supplier ko dein — yahin entry karein, khata apne aap update ho jayega."
            action={<Button icon={Plus} onClick={() => setFormOpen(true)}>Pehli entry</Button>}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table columns={columns} rows={rows} loading={loading} />
            </div>
            <div className="md:hidden">
              {loading ? <p className="py-12 text-center text-sm text-slate-400">Load ho raha hai...</p>
                : rows.map((r) => {
                  const Icon = MODE_ICON[r.mode] || Banknote;
                  return (
                    <div key={r._id} className="border-b border-slate-100 p-4 last:border-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{r.party?.name || r.paymentNo}</p>
                          <p className="flex items-center gap-1.5 truncate text-xs text-slate-500">
                            <Icon size={11} /> {r.paymentNo} · {formatDate(r.date)}
                          </p>
                          <div className="mt-1.5">
                            <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>
                          </div>
                        </div>
                        <span className={`tabular shrink-0 font-semibold ${
                          r.direction === 'IN' ? 'text-emerald-700' : 'text-red-600'}`}>
                          {r.direction === 'IN' ? '+' : '−'}{formatMoney(r.amount)}
                        </span>
                      </div>
                      {r.status === 'pending' && (
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" variant="success" onClick={() => confirm(r)} loading={busy}>Mil gaya</Button>
                          <Button size="sm" variant="secondary" onClick={() => setRejecting(r)}>Nahi mila</Button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total}
              limit={meta.limit} onChange={setPage} />
          </>
        )}
      </Card>

      <PaymentFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={refreshAll} />

      <Modal
        open={!!rejecting}
        onClose={() => { setRejecting(null); setRejectReason(''); }}
        title="Payment reject karein?"
        description={rejecting ? `${rejecting.party?.name} ne ${formatMoney(rejecting.amount)} bheja bataya tha` : ''}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setRejecting(null); setRejectReason(''); }}>
              Rehne dein
            </Button>
            <Button variant="danger" onClick={doReject} loading={busy}>Reject karein</Button>
          </>
        }
      >
        <Textarea
          label="Kya wajah batayein"
          rows={3}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Jaise: account me paisa nahi aaya"
          hint="Retailer ko yahi message jayega"
        />
      </Modal>

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        loading={busy}
        title={deleting ? `${deleting.paymentNo} delete karein?` : ''}
        message="Khata wapas pehle jaisa ho jayega aur bill dobara udhaar dikhne lagega. Ye wapas nahi hota."
        confirmLabel="Haan, delete karein"
      />
    </>
  );
}
