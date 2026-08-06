import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Pencil, UserCheck, Ban, Trash2, Phone, MapPin, FileText,
  IndianRupee, ShoppingCart, Tag, LogIn,
} from 'lucide-react';
import api from '@/lib/api';
import { formatMoney, formatPhone, formatDate, formatDateTime } from '@/lib/format';
import {
  Card, CardHeader, Button, Badge, Tabs, Spinner, ConfirmModal, StatCard, useToast,
} from '@/components/ui';
import PartyFormModal from './PartyFormModal';
import RatesTab from './RatesTab';
import PartyPurchasesTab from './PartyPurchasesTab';
import PartyOrdersTab from './PartyOrdersTab';
import PartyKhataTab from './PartyKhataTab';

const statusTone = { pending: 'amber', active: 'green', blocked: 'red' };
const statusLabel = { pending: 'Approval baaki', active: 'Active', blocked: 'Blocked' };

export default function PartyDetail({ type }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isRetailer = type === 'retailer';

  const [party, setParty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || 'detail');
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/parties/${id}`);
      setParty(res.data);
    } catch (err) {
      toast.error(err.message);
      navigate(isRetailer ? '/retailers' : '/suppliers', { replace: true });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(next) {
    try {
      const res = await api.post(`/parties/${id}/status`, { status: next });
      toast.success(res.message);
      setParty(res.data);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await api.delete(`/parties/${id}`);
      toast.success(res.message);
      if (res.data.deleted) navigate(isRetailer ? '/retailers' : '/suppliers', { replace: true });
      else { setConfirmDelete(false); load(); }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20 text-slate-400"><Spinner size={28} /></div>;
  }
  if (!party) return null;

  const addr = [party.address?.line1, party.address?.city, party.address?.state, party.address?.pincode]
    .filter(Boolean).join(', ');

  return (
    <>
      <button
        onClick={() => navigate(isRetailer ? '/retailers' : '/suppliers')}
        className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} /> {isRetailer ? 'Saare retailers' : 'Saare suppliers'}
      </button>

      {/* ---- Header ---- */}
      <Card className="mb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">
              {(party.shopName || party.name).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold text-slate-900">
                  {party.shopName || party.name}
                </h1>
                {isRetailer && <Badge tone={statusTone[party.status]}>{statusLabel[party.status]}</Badge>}
              </div>
              <p className="mt-0.5 text-sm text-slate-500">{party.name}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                <span className="flex items-center gap-1.5"><Phone size={14} /> {formatPhone(party.phone)}</span>
                {addr && <span className="flex items-center gap-1.5"><MapPin size={14} /> {addr}</span>}
                {party.gstin && <span className="flex items-center gap-1.5"><FileText size={14} /> {party.gstin}</span>}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditOpen(true)}>Edit</Button>
            {isRetailer && party.status !== 'active' && (
              <Button size="sm" variant="success" icon={UserCheck} onClick={() => changeStatus('active')}>Approve</Button>
            )}
            {isRetailer && party.status === 'active' && (
              <Button size="sm" variant="secondary" icon={Ban} onClick={() => changeStatus('blocked')}>Block</Button>
            )}
            <Button size="sm" variant="danger" icon={Trash2} onClick={() => setConfirmDelete(true)}>Delete</Button>
          </div>
        </div>

        {party.notes && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{party.notes}</p>
        )}
      </Card>

      {/* ---- Stats ---- */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={isRetailer ? 'Udhaar baaki' : 'Dena hai'} value={formatMoney(party.balance)}
          icon={IndianRupee} tone={party.balance > 0 ? 'amber' : 'green'}
          sub={party.creditLimit ? `Limit ${formatMoney(party.creditLimit)}` : 'Koi limit nahi'} />
        <StatCard label="Orders" value={party.orderCount || 0} icon={ShoppingCart} tone="brand" />
        <StatCard label="Bills" value={party.invoiceCount || 0} icon={FileText} tone="brand" />
        {isRetailer && (
          <StatCard label="Khaas rate" value={party.customRateCount || 0} icon={Tag}
            tone={party.customRateCount ? 'green' : 'brand'} sub="items pe" />
        )}
      </div>

      {/* ---- Tabs ---- */}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'detail', label: 'Detail' },
          ...(isRetailer ? [{ value: 'rates', label: 'Rate', count: party.customRateCount }] : []),
          { value: 'khata', label: 'Khata' },
          { value: 'orders', label: isRetailer ? 'Orders' : 'Purchases' },
        ]}
      />

      {tab === 'detail' && <DetailTab party={party} isRetailer={isRetailer} />}
      {tab === 'rates' && (
        <RatesTab
          partyId={party._id}
          partyName={party.shopName || party.name}
          onRatesChanged={load}
        />
      )}
      {tab === 'khata' && <PartyKhataTab party={party} onChanged={load} />}
      {tab === 'orders' && (isRetailer
        ? <PartyOrdersTab partyId={party._id} partyName={party.shopName || party.name} />
        : <PartyPurchasesTab supplierId={party._id} supplierName={party.shopName || party.name} />
      )}

      <PartyFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        party={party}
        type={type}
        onSaved={load}
      />

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        loading={busy}
        title={`${party.name} ko delete karein?`}
        message="Agar iska koi order, bill ya payment hai to delete nahi hoga — sirf block ho jayega, taaki purane record kharab na hon."
        confirmLabel="Haan, delete karein"
      />
    </>
  );
}

function DetailTab({ party, isRetailer }) {
  const rows = [
    ['Vyakti ka naam', party.name],
    ['Dukaan ka naam', party.shopName || '—'],
    ['Phone', formatPhone(party.phone)],
    ['Email', party.email || '—'],
    ['GSTIN', party.gstin || '—'],
    ['Address', [party.address?.line1, party.address?.city].filter(Boolean).join(', ') || '—'],
    ['State', party.address?.state ? `${party.address.state} (${party.address.stateCode})` : '—'],
    ['Pincode', party.address?.pincode || '—'],
    ['Purana hisaab', formatMoney(party.openingBalance || 0)],
    ['Credit limit', party.creditLimit ? formatMoney(party.creditLimit) : 'Koi limit nahi'],
    ['Juda', formatDate(party.createdAt)],
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Poori detail" />
        <dl className="divide-y divide-slate-100">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5 text-sm">
              <dt className="text-slate-500">{k}</dt>
              <dd className="text-right font-medium text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {isRetailer && (
        <Card>
          <CardHeader title="App ka account" subtitle="Invite link se bana hua login" />
          {party.linkedUser ? (
            <dl className="divide-y divide-slate-100">
              <div className="flex justify-between gap-4 py-2.5 text-sm">
                <dt className="text-slate-500">Login naam</dt>
                <dd className="font-medium text-slate-900">{party.linkedUser.name}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5 text-sm">
                <dt className="text-slate-500">Login number</dt>
                <dd className="font-medium text-slate-900">{formatPhone(party.linkedUser.phone)}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5 text-sm">
                <dt className="text-slate-500">Aakhri baar aaya</dt>
                <dd className="font-medium text-slate-900">
                  {party.linkedUser.lastLoginAt ? formatDateTime(party.linkedUser.lastLoginAt) : 'Abhi tak nahi'}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5 text-sm">
                <dt className="text-slate-500">Login chalu hai</dt>
                <dd>
                  <Badge tone={party.linkedUser.isActive ? 'green' : 'red'}>
                    {party.linkedUser.isActive ? 'Haan' : 'Nahi'}
                  </Badge>
                </dd>
              </div>
            </dl>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <LogIn size={20} />
              </div>
              <p className="text-sm font-medium text-slate-900">Abhi app pe nahi aaya</p>
              <p className="mt-1 max-w-xs text-sm text-slate-500">
                Isne invite link se account nahi banaya hai. Link WhatsApp pe bhej dein — isi
                phone number se register karne par ye entry apne aap jud jayegi.
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
