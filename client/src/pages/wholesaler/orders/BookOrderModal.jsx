import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { bust } from '@/hooks/useQuery';
import { formatMoney, formatPhone } from '@/lib/format';
import {
  Modal, Button, Input, Select, Combobox, useToast,
} from '@/components/ui';
import LineEditor, { newLine, lineTotals } from '@/components/sales/LineEditor';
import { t } from '@/lib/i18n';

/** Seller books an order taken on phone / WhatsApp / visit */
export default function BookOrderModal({ open, onClose }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [party, setParty] = useState({ value: '', label: '' });
  const [lines, setLines] = useState([newLine()]);
  const [f, setF] = useState({ paymentMode: 'UDHAAR', expectedDeliveryAt: '', note: '' });
  const [saving, setSaving] = useState(false);
  const fetchParties = useCallback(async (q) => {
    const r = await api.get('/parties', { params: { type: 'retailer', q, limit: 15 } });
    return r.data.map((p) => ({ value: p._id, label: p.shopName || p.name, sublabel: formatPhone(p.phone) }));
  }, []);
  const total = lineTotals(lines, false).total;

  async function save() {
    const items = lines.filter((l) => l.itemId && Number(l.qty) > 0).map((l) => ({ itemId: l.itemId, qty: Number(l.qty), rate: Number(l.rate || 0) }));
    if (!items.length) { toast.error(t('Add at least one item')); return; }
    setSaving(true);
    try {
      const res = await api.post('/orders', { partyId: party.value, items, paymentMode: f.paymentMode, note: f.note, expectedDeliveryAt: f.expectedDeliveryAt ? new Date(f.expectedDeliveryAt).toISOString() : null });
      toast.success(res.message);
      bust('orders', 'crm');
      onClose();
      navigate(`/orders/${res.data._id}`);
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title={t('Book an order')} description={t('For orders taken on phone, WhatsApp or a visit')}
      footer={<><span className="mr-auto text-sm font-semibold tabular-nums">{t('Total')} {formatMoney(total)}</span><Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button><Button loading={saving} disabled={!party.value} onClick={save}>{t('Book order')}</Button></>}>
      <div className="space-y-4">
        <Combobox label={t('Customer')} required value={party.value} display={party.label} fetchOptions={fetchParties} placeholder={t('Search customer')}
          onChange={(o) => setParty({ value: o?.value || '', label: o?.label || '' })} />
        <LineEditor lines={lines} setLines={setLines} partyId={party.value} withDiscount={false} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Select label={t('Payment')} value={f.paymentMode} onChange={(e) => setF({ ...f, paymentMode: e.target.value })}
            options={[{ value: 'UDHAAR', label: t('Credit') }, { value: 'CASH', label: t('Cash') }, { value: 'UPI', label: 'UPI' }]} />
          <Input label={t('Expected delivery')} type="date" value={f.expectedDeliveryAt} onChange={(e) => setF({ ...f, expectedDeliveryAt: e.target.value })} />
          <Input label={t('Note')} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </div>
      </div>
    </Modal>
  );
}
