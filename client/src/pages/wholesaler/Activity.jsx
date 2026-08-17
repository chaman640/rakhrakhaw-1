import { useCallback, useEffect, useState } from 'react';
import {
  History, FileText, Wallet, Package, Users, Truck, Undo2, UserCog, Link2,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatDateTime } from '@/lib/format';
import {
  PageHeader, Card, Badge, Spinner, EmptyState, Chips, Select, Input,
  Pagination, useToast,
} from '@/components/ui';
import { t } from '@/lib/i18n';

/**
 * KISNE KYA KIYA.
 *
 * Jab dukaan me sirf malik tha, is page ki zarurat nahi thi. Ab jab 5-6 log
 * ek hi data pe kaam karte hain, sabse zyada poochha jane wala sawal yahi
 * hota hai — "ye bill kisne mitaya?", "credit limit kisne badhayi?"
 *
 * Bina record ke iska jawab kabhi nahi milta aur shaq sab pe jata hai.
 */

const KIND = {
  invoice: { icon: FileText, tone: 'blue', label: 'Bill' },
  payment: { icon: Wallet, tone: 'green', label: 'Payment' },
  purchase: { icon: Truck, tone: 'amber', label: 'Purchase' },
  item: { icon: Package, tone: 'slate', label: 'Item' },
  party: { icon: Users, tone: 'brand', label: 'Party' },
  order: { icon: FileText, tone: 'blue', label: 'Order' },
  return: { icon: Undo2, tone: 'amber', label: 'Wapasi' },
  staff: { icon: UserCog, tone: 'red', label: 'Staff' },
};

/** `invoice.create` -> `invoice` */
const kindOf = (action) => String(action || '').split('.')[0];

// Mitane wale kaam alag dikhne chahiye — nazar sabse pehle wahin jani chahiye
const isDelete = (action) => /\.(delete|cancel|reject)$/.test(action || '');

const FILTERS = [
  { value: 'all', label: 'Sab' },
  { value: 'invoice', label: 'Bill' },
  { value: 'payment', label: 'Payment' },
  { value: 'item', label: 'Item' },
  { value: 'party', label: 'Party' },
  { value: 'staff', label: 'Staff' },
];

export default function Activity() {
  const toast = useToast();
  const { isScoped } = useAuth();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const [action, setAction] = useState('all');
  const [userId, setUserId] = useState('');
  const [staff, setStaff] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/activity', {
        params: { action, page, limit: 25, ...(userId ? { userId } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) },
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, userId, from, to, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [action, userId, from, to]);

  // Kis-kis ne kaam kiya — filter ke liye
  useEffect(() => {
    api.get('/staff')
      .then((r) => setStaff(r.data.staff || []))
      .catch(() => { /* jise staff dekhne ka haq nahi, uske liye ye filter hi nahi */ });
  }, []);

  return (
    <>
      <PageHeader
        title={t('Kaam ka record')}
        subtitle={isScoped
          ? 'Aapka kiya hua kaam'
          : 'Kisne kya kiya, kab kiya — sab yahan likha jata hai'}
      />

      <Card className="mb-5" padding={false}>
        <div className="space-y-3 p-4">
          <Chips value={action} onChange={setAction} options={FILTERS} />

          <div className="grid gap-3 sm:grid-cols-3">
            {!isScoped && staff.length > 1 && (
              <Select
                label={t('Kisne kiya')}
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder={t('Sab log')}
                options={staff.map((s) => ({ value: s._id, label: `${s.name} (${s.staffRoleLabel})` }))}
              />
            )}
            <Input label={t('Kab se')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input label={t('Kab tak')} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card padding={false}>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={24} /></div>
        ) : !rows.length ? (
          <EmptyState
            icon={History}
            title={t('Abhi koi record nahi')}
            message={t('Bill banega, paisa aayega ya koi setting badlegi — sab yahan likha jayega.')}
          />
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {rows.map((r) => {
                const kind = KIND[kindOf(r.action)] || { icon: History, tone: 'slate', label: '' };
                const Icon = kind.icon;
                const danger = isDelete(r.action);
                return (
                  <div key={r._id} className="flex gap-3 p-4">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      danger ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                      <Icon size={16} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800">{r.summary || r.action}</p>

                      <p className="mt-0.5 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">{r.userName || 'Koi'}</span>
                        {r.userRole && ` (${r.userRole})`}
                        {' · '}
                        {formatDateTime(r.createdAt)}
                      </p>

                      {/* Kya se kya hua — yahi asli kaam ki baat hai */}
                      {r.changes?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                          {r.changes.map((c, i) => (
                            <span key={i} className="text-xs text-slate-500">
                              {c.label || c.field}:{' '}
                              <span className="text-slate-400 line-through">{String(c.from ?? '—')}</span>
                              {' → '}
                              <span className="font-medium text-slate-700">{String(c.to ?? '—')}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {kind.label && (
                      <Badge tone={danger ? 'red' : kind.tone} className="hidden shrink-0 sm:inline-flex">
                        {kind.label}
                      </Badge>
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

      <p className="mt-3 text-xs text-slate-400">
        {t('Record apne aap banta hai — ise koi mita nahi sakta, malik bhi nahi.')}
      </p>
    </>
  );
}
