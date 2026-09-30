import { useState } from 'react';
import { Truck, Printer, Pencil } from 'lucide-react';
import api from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import {
  Card, CardHeader, Button, Input, Modal, useToast,
} from '@/components/ui';
import { t } from '@/lib/i18n';

const FIELDS = [['vehicleNo', 'Vehicle no.'], ['transporter', 'Transporter'], ['lrNo', 'LR / docket no.'], ['driverName', 'Driver name'], ['driverPhone', 'Driver phone'], ['packages', 'Packages / boxes']];

/** Dispatch details → delivery challan. Printing the page prints the challan once it has a number. */
export default function DispatchCard({ order, onSaved, onPrint }) {
  const toast = useToast();
  const d = order.dispatch || {};
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({});
  const [saving, setSaving] = useState(false);
  const closed = order.status === 'CANCELLED';

  function edit() {
    setF({
      ...Object.fromEntries(FIELDS.map(([k]) => [k, d[k] ?? ''])), note: d.note || '', deliveredTo: d.deliveredTo || '',
      expectedDeliveryAt: order.expectedDeliveryAt ? String(order.expectedDeliveryAt).slice(0, 10) : '',
    });
    setOpen(true);
  }
  async function save() {
    setSaving(true);
    try {
      const res = await api.put(`/orders/${order._id}/dispatch`, {
        ...f, packages: Number(f.packages || 0), expectedDeliveryAt: f.expectedDeliveryAt ? new Date(f.expectedDeliveryAt).toISOString() : null,
      });
      toast.success(res.message);
      onSaved(res.data);
      setOpen(false);
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  }
  const has = d.challanNo;
  return (
    <Card className="mb-5 no-print">
      <CardHeader title={<span className="flex items-center gap-2"><Truck size={16} className="text-brand-700" />{t('Dispatch & delivery challan')}</span>}
        subtitle={has ? `${t('Challan')} ${d.challanNo}` : t('Add vehicle and transporter details to issue a delivery challan')}
        action={!closed && (
          <div className="flex gap-2">
            {has && <Button size="sm" variant="secondary" icon={Printer} onClick={onPrint}>{t('Print challan')}</Button>}
            <Button size="sm" variant={has ? 'ghost' : 'primary'} icon={Pencil} onClick={edit}>{has ? t('Edit') : t('Add dispatch details')}</Button>
          </div>
        )} />
      {(has || order.expectedDeliveryAt) && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          {FIELDS.filter(([k]) => d[k]).map(([k, l]) => <div key={k}><dt className="text-xs text-slate-500">{t(l)}</dt><dd className="font-medium text-slate-900">{d[k]}</dd></div>)}
          {order.expectedDeliveryAt && <div><dt className="text-xs text-slate-500">{t('Expected delivery')}</dt><dd className="font-medium">{formatDate(order.expectedDeliveryAt)}</dd></div>}
          {d.dispatchedAt && <div><dt className="text-xs text-slate-500">{t('Dispatched')}</dt><dd className="font-medium">{formatDateTime(d.dispatchedAt)}</dd></div>}
          {d.deliveredAt && <div><dt className="text-xs text-slate-500">{t('Delivered')}</dt><dd className="font-medium">{formatDateTime(d.deliveredAt)}{d.deliveredTo ? ` · ${d.deliveredTo}` : ''}</dd></div>}
        </dl>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={t('Dispatch details')}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('Cancel')}</Button><Button loading={saving} onClick={save}>{t('Save')}</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map(([k, l]) => <Input key={k} label={t(l)} type={k === 'packages' ? 'number' : k === 'driverPhone' ? 'tel' : 'text'} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />)}
          <Input label={t('Expected delivery')} type="date" value={f.expectedDeliveryAt || ''} onChange={(e) => setF({ ...f, expectedDeliveryAt: e.target.value })} />
          <Input label={t('Received by')} value={f.deliveredTo || ''} onChange={(e) => setF({ ...f, deliveredTo: e.target.value })} />
          <Input containerClassName="sm:col-span-2" label={t('Note')} value={f.note || ''} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </div>
      </Modal>
    </Card>
  );
}
