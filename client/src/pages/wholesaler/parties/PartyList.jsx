import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Users, Truck, UserCheck, Ban, IndianRupee, Clock, ChevronRight, Tag,
} from 'lucide-react';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatMoney, formatPhone, formatDate } from '@/lib/format';
import {
  PageHeader, Card, StatCard, Button, Table, Badge, SearchInput, Chips,
  Pagination, EmptyState, useToast,
} from '@/components/ui';
import PartyFormModal from './PartyFormModal';
import InviteCard from './InviteCard';
import { cn } from '@/lib/cn';

const statusTone = { pending: 'amber', active: 'green', blocked: 'red' };
const statusLabel = { pending: 'Approval baaki', active: 'Active', blocked: 'Blocked' };

/** Retailers aur Suppliers dono isi component se chalte hain */
export default function PartyList({ type }) {
  const isRetailer = type === 'retailer';
  const toast = useToast();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [stats, setStats] = useState({ total: 0, pending: 0, active: 0, blocked: 0, totalDue: 0 });
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [formParty, setFormParty] = useState(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get('/parties/stats', { params: { type } });
      setStats(res.data);
    } catch { /* chup-chaap */ }
  }, [type]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/parties', { params: { type, status, q: debouncedQ, page, limit: 25 } });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, status, debouncedQ, page]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedQ, status]);

  function refreshAll() { load(); loadStats(); }

  async function changeStatus(party, next) {
    try {
      const res = await api.post(`/parties/${party._id}/status`, { status: next });
      toast.success(res.message);
      refreshAll();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const basePath = isRetailer ? '/retailers' : '/suppliers';

  const columns = [
    {
      key: 'name',
      header: isRetailer ? 'Retailer' : 'Supplier',
      render: (r) => (
        <button onClick={() => navigate(`${basePath}/${r._id}`)} className="text-left">
          <p className="font-medium text-slate-900">{r.shopName || r.name}</p>
          <p className="text-xs text-slate-500">{r.name} · {formatPhone(r.phone)}</p>
        </button>
      ),
    },
    ...(isRetailer ? [{
      key: 'status',
      header: 'Status',
      render: (r) => <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>,
    }] : []),
    {
      key: 'balance',
      header: isRetailer ? 'Udhaar' : 'Dena hai',
      align: 'right',
      render: (r) => (
        <span className={cn('tabular', r.balance > 0 ? 'font-medium text-amber-700' : 'text-slate-400')}>
          {r.balance ? formatMoney(r.balance) : '—'}
        </span>
      ),
    },
    ...(isRetailer ? [{
      key: 'customRateCount',
      header: 'Khaas rate',
      align: 'right',
      render: (r) => (r.customRateCount
        ? <Badge tone="brand">{r.customRateCount} item</Badge>
        : <span className="text-slate-400">—</span>),
    }] : []),
    { key: 'createdAt', header: 'Juda', render: (r) => formatDate(r.createdAt) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          {isRetailer && r.status !== 'active' && (
            <Button size="sm" variant="success" icon={UserCheck} onClick={() => changeStatus(r, 'active')}>
              Approve
            </Button>
          )}
          {isRetailer && r.status === 'active' && (
            <Button size="sm" variant="secondary" icon={Ban} onClick={() => changeStatus(r, 'blocked')}>
              Block
            </Button>
          )}
          <button
            onClick={() => navigate(`${basePath}/${r._id}`)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Kholein"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={isRetailer ? 'Retailers' : 'Suppliers'}
        subtitle={isRetailer
          ? 'Jo aapse maal lete hain — access, rate aur udhaar'
          : 'Jinse aap maal khareedte hain'}
        action={
          <Button icon={Plus} onClick={() => { setFormParty(null); setFormOpen(true); }}>
            {isRetailer ? 'Naya retailer' : 'Naya supplier'}
          </Button>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={isRetailer ? 'Kul retailers' : 'Kul suppliers'} value={stats.total}
          icon={isRetailer ? Users : Truck} tone="brand" />
        {isRetailer && <StatCard label="Approval baaki" value={stats.pending} icon={Clock} tone="amber" />}
        <StatCard label="Active" value={stats.active} icon={UserCheck} tone="green" />
        <StatCard label={isRetailer ? 'Kul udhaar' : 'Kul dena hai'} value={formatMoney(stats.totalDue)}
          icon={IndianRupee} tone={stats.totalDue > 0 ? 'amber' : 'green'} />
      </div>

      {isRetailer && (
        <div className="mb-5">
          <InviteCard compact />
        </div>
      )}

      <Card className="mb-5" padding={false}>
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <SearchInput value={q} onChange={setQ}
            placeholder="Naam, dukaan ya phone se dhundhein..." className="lg:w-80" />
          {isRetailer && (
            <Chips
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: 'Sab' },
                { value: 'pending', label: 'Approval baaki', count: stats.pending },
                { value: 'active', label: 'Active', count: stats.active },
                { value: 'blocked', label: 'Blocked', count: stats.blocked },
              ]}
            />
          )}
        </div>
      </Card>

      <Card padding={false}>
        {!loading && !rows.length ? (
          <EmptyState
            icon={isRetailer ? Users : Truck}
            title={debouncedQ || status !== 'all' ? 'Kuch nahi mila' : (isRetailer ? 'Abhi koi retailer nahi juda' : 'Abhi koi supplier nahi')}
            message={isRetailer
              ? 'Upar wala invite link WhatsApp pe bhejein — jo register karega wo yahan dikhega. Ya khud add kar lein.'
              : 'Jinse aap maal khareedte hain unhe add karein — Part 5 me purchase entry me kaam aayenge.'}
            action={
              <Button icon={Plus} onClick={() => { setFormParty(null); setFormOpen(true); }}>
                {isRetailer ? 'Retailer add karein' : 'Supplier add karein'}
              </Button>
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table columns={columns} rows={rows} loading={loading} />
            </div>

            <div className="md:hidden">
              {loading ? (
                <p className="py-12 text-center text-sm text-slate-400">Load ho raha hai...</p>
              ) : rows.map((r) => (
                <button
                  key={r._id}
                  onClick={() => navigate(`${basePath}/${r._id}`)}
                  className="flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left last:border-0"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                    {(r.shopName || r.name).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{r.shopName || r.name}</p>
                    <p className="truncate text-xs text-slate-500">{formatPhone(r.phone)}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {isRetailer && <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>}
                      {r.balance > 0 && <span className="tabular text-xs text-amber-700">{formatMoney(r.balance)}</span>}
                      {r.customRateCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-brand-700">
                          <Tag size={11} /> {r.customRateCount}
                        </span>
                      )}
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

      <PartyFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        party={formParty}
        type={type}
        onSaved={refreshAll}
      />
    </>
  );
}
