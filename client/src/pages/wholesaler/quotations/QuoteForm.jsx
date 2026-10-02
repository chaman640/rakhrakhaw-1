import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { bust } from '@/hooks/useQuery';
import { useAuth } from '@/context/AuthContext';
import { formatMoney, formatPhone, dayStr } from '@/lib/format';
import {
  PageHeader, Card, Button, Input, Textarea, Combobox, Spinner, useToast,
} from '@/components/ui';
import LineEditor, { newLine, lineTotals } from '@/components/sales/LineEditor';
import { t } from '@/lib/i18n';

const inDays = (n) => dayStr(Date.now() + n * 86400000);

export default function QuoteForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { gstEnabled } = useAuth();
  const [who, setWho] = useState({ partyId: params.get('partyId') || '', leadId: params.get('leadId') || '', label: '' });
  const [lines, setLines] = useState([newLine()]);
  const [f, setF] = useState({ validUntil: inDays(15), paymentTerms: '', deliveryTerms: '', notes: '', terms: '' });
  const [loading, setLoading] = useState(Boolean(id || who.partyId || who.leadId));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (id) {
          const q = (await api.get(`/quotations/${id}`)).data;
          if (!alive) return;
          setWho({ partyId: q.partyId || '', leadId: q.leadId || '', label: q.customer?.shopName || q.customer?.name });
          setLines(q.items.map((l) => ({ ...newLine(), itemId: l.itemId, name: l.name, unit: l.unit, qty: String(l.qty), rate: String(l.rate), discountPct: l.discountPct ? String(l.discountPct) : '', gstRate: l.gstRate })));
          setF({ validUntil: q.validUntil ? String(q.validUntil).slice(0, 10) : '', paymentTerms: q.paymentTerms, deliveryTerms: q.deliveryTerms, notes: q.notes, terms: q.terms });
        } else if (who.partyId) {
          const p = (await api.get(`/parties/${who.partyId}`)).data;
          if (alive) setWho((w) => ({ ...w, label: p.shopName || p.name }));
        } else if (who.leadId) {
          const l = (await api.get(`/crm/leads/${who.leadId}`)).data;
          if (alive) setWho((w) => ({ ...w, label: `${l.shopName || l.name} (${t('lead')})` }));
        }
      } catch (e) { toast.error(e.message); } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchParties = useCallback(async (q) => {
    const r = await api.get('/parties', { params: { type: 'retailer', q, limit: 15 } });
    return r.data.map((p) => ({ value: p._id, label: p.shopName || p.name, sublabel: formatPhone(p.phone) }));
  }, []);

  const tot = lineTotals(lines, gstEnabled);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function save() {
    const items = lines.filter((l) => l.itemId && Number(l.qty) > 0).map((l) => ({ itemId: l.itemId, qty: Number(l.qty), rate: Number(l.rate || 0), discountPct: Number(l.discountPct || 0) }));
    if (!items.length) { toast.error(t('Add at least one item')); return; }
    setSaving(true);
    try {
      const body = { items, ...f, validUntil: f.validUntil ? new Date(`${f.validUntil}T23:59:00`).toISOString() : null };
      const res = id ? await api.put(`/quotations/${id}`, body)
        : await api.post('/quotations', { ...body, partyId: who.partyId || null, leadId: who.partyId ? null : (who.leadId || null) });
      toast.success(res.message);
      bust('quotations', 'crm');
      navigate(`/quotations/${res.data._id}`, { replace: true });
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size={28} /></div>;
  return (
    <>
      <PageHeader title={id ? t('Edit quotation') : t('New quotation')} subtitle={t('Prices are the customer’s own rates unless you change them')} />
      <div className="space-y-4">
        <Card>
          {id || who.leadId ? <p className="text-sm"><span className="text-slate-500">{t('Customer')}:</span> <b>{who.label}</b></p> : (
            <Combobox label={t('Customer')} required value={who.partyId} display={who.label} fetchOptions={fetchParties} placeholder={t('Search customer')}
              onChange={(o) => setWho({ partyId: o?.value || '', leadId: '', label: o?.label || '' })} />
          )}
        </Card>
        <Card><LineEditor lines={lines} setLines={setLines} partyId={who.partyId} withGst={gstEnabled} /></Card>
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input label={t('Valid until')} type="date" value={f.validUntil} onChange={set('validUntil')} />
              <Input label={t('Payment terms')} value={f.paymentTerms} onChange={set('paymentTerms')} placeholder={t('e.g. 50% advance, rest on delivery')} />
              <Input label={t('Delivery terms')} value={f.deliveryTerms} onChange={set('deliveryTerms')} placeholder={t('e.g. Within 7 days, freight extra')} />
            </div>
            <div className="mt-3"><Textarea label={t('Note to customer')} rows={2} value={f.notes} onChange={set('notes')} /></div>
            <div className="mt-3"><Textarea label={t('Terms & conditions')} rows={2} value={f.terms} onChange={set('terms')} /></div>
          </Card>
          <Card>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">{t('Sub-total')}</dt><dd className="tabular-nums">{formatMoney(tot.sub)}</dd></div>
              {tot.discount > 0 && <div className="flex justify-between"><dt className="text-slate-500">{t('Discount')}</dt><dd className="tabular-nums">−{formatMoney(tot.discount)}</dd></div>}
              {tot.tax > 0 && <div className="flex justify-between"><dt className="text-slate-500">GST</dt><dd className="tabular-nums">{formatMoney(tot.tax)}</dd></div>}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold"><dt>{t('Total')}</dt><dd className="tabular-nums">{formatMoney(tot.total)}</dd></div>
            </dl>
            <Button className="mt-4 w-full" loading={saving} disabled={!id && !who.partyId && !who.leadId} onClick={save}>{id ? t('Save changes') : t('Save quotation')}</Button>
          </Card>
        </div>
      </div>
    </>
  );
}
