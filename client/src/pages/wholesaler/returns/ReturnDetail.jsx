import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Printer, Trash2, Undo2, FileText } from 'lucide-react';
import api from '@/lib/api';
import { formatMoney, formatDate, formatQty } from '@/lib/format';
import { Card, Button, Badge, Spinner, ConfirmModal, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';

const TYPE_LABEL = { SALE_RETURN: 'Maal wapas aaya', PURCHASE_RETURN: 'Maal wapas bheja' };
const NOTE_LABEL = { SALE_RETURN: 'CREDIT NOTE', PURCHASE_RETURN: 'DEBIT NOTE' };

export default function ReturnDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/returns/${id}`);
      setNote(res.data);
    } catch (err) {
      toast.error(err.message);
      navigate('/returns', { replace: true });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function remove() {
    setBusy(true);
    try {
      const res = await api.delete(`/returns/${id}`);
      toast.success(res.message);
      navigate('/returns', { replace: true });
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20 text-slate-400"><Spinner size={28} /></div>;
  }
  if (!note) return null;

  const isSale = note.type === 'SALE_RETURN';
  const gst = note.gstEnabled;
  const isIgst = note.taxType === 'IGST';
  const biz = note.businessSnapshot || {};
  const party = note.partySnapshot || {};

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-end gap-3">
        <div className="flex gap-2">
          <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button>
          <Button variant="danger" icon={Trash2} onClick={() => setConfirmDelete(true)}>Delete</Button>
        </div>
      </div>

      <div className="no-print mb-5 flex flex-wrap items-center gap-2">
        <Badge tone={isSale ? 'amber' : 'blue'}>{TYPE_LABEL[note.type]}</Badge>
        {note.againstNo && (
          <button onClick={() => navigate(isSale ? `/invoices/${note.invoiceId}` : `/purchases/${note.purchaseId}`)}
            className="flex items-center gap-1 text-sm text-brand-700 underline-offset-2 hover:underline">
            <FileText size={13} /> {note.againstNo}
          </button>
        )}
      </div>

      {/* ---- Chhapne wala note ---- */}
      <Card className="invoice-sheet mx-auto max-w-3xl text-sm">
        <div className="flex items-start justify-between gap-4 border-b border-slate-300 pb-4">
          <div className="flex gap-3">
            {biz.logoUrl && <img src={biz.logoUrl} alt="" className="h-12 w-12 rounded object-cover" />}
            <div>
              <h2 className="text-base font-bold text-slate-900">{biz.name}</h2>
              {biz.address?.line1 && <p className="text-xs text-slate-600">{biz.address.line1}</p>}
              <p className="text-xs text-slate-600">
                {[biz.address?.city, biz.address?.state, biz.address?.pincode].filter(Boolean).join(', ')}
              </p>
              {biz.phone && <p className="text-xs text-slate-600">Phone: {biz.phone}</p>}
              {gst && biz.gstin && <p className="text-xs font-medium text-slate-700">GSTIN: {biz.gstin}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold tracking-wide text-slate-900">{NOTE_LABEL[note.type]}</p>
            <p className="mt-1 text-xs text-slate-600">No: <strong>{note.returnNo}</strong></p>
            <p className="text-xs text-slate-600">Date: {formatDate(note.returnDate)}</p>
            {note.againstNo && (
              <p className="text-xs text-slate-600">Against: {note.againstNo}</p>
            )}
          </div>
        </div>

        <div className="border-b border-slate-300 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {isSale ? 'Maal wapas karne wale' : 'Maal wapas bhejne wale'}
          </p>
          <p className="font-semibold text-slate-900">{party.shopName || party.name}</p>
          {party.shopName && party.name && <p className="text-xs text-slate-600">{party.name}</p>}
          {party.phone && <p className="text-xs text-slate-600">Phone: {party.phone}</p>}
          {gst && party.gstin && <p className="text-xs text-slate-600">GSTIN: {party.gstin}</p>}
        </div>

        {/* Phone pe ginti wali table apne dabbe me khiskati hai — warna
            column ek doosre se chipak jate the. Print pe ye hat jata hai. */}
        <div className={cn('sheet-scroll mt-3 overflow-x-auto', gst && 'sm:overflow-visible')}>
        <table className={cn('w-full text-xs [&_td]:pr-2 [&_th]:pr-2',
          '[&_td:last-child]:pr-0 [&_th:last-child]:pr-0',
          gst ? 'min-w-[600px]' : 'min-w-[340px]')}>
          <thead>
            <tr className="border-b border-slate-300 text-left">
              <th className="w-8 py-2 font-semibold">#</th>
              <th className="py-2 font-semibold">Item</th>
              {gst && <th className="py-2 font-semibold">HSN</th>}
              <th className="py-2 text-right font-semibold">Qty</th>
              <th className="py-2 text-right font-semibold">Rate</th>
              {gst && <th className="py-2 text-right font-semibold">Taxable</th>}
              {gst && !isIgst && <th className="py-2 text-right font-semibold">CGST</th>}
              {gst && !isIgst && <th className="py-2 text-right font-semibold">SGST</th>}
              {gst && isIgst && <th className="py-2 text-right font-semibold">IGST</th>}
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {note.items.map((it, i) => (
              <tr key={i} className="border-b border-slate-200 align-top">
                <td className="py-2">{i + 1}</td>
                <td className="py-2">
                  <span className="font-medium">{it.name}</span>
                  {it.reason && <span className="block text-[10px] text-slate-500">{it.reason}</span>}
                </td>
                {gst && <td className="py-2">{it.hsn || '—'}</td>}
                <td className="tabular py-2 text-right">{formatQty(it.qty, it.unit)}</td>
                <td className="tabular py-2 text-right">{formatMoney(it.rate)}</td>
                {gst && <td className="tabular py-2 text-right">{formatMoney(it.taxableValue)}</td>}
                {gst && !isIgst && <td className="tabular py-2 text-right">{formatMoney(it.cgst)}</td>}
                {gst && !isIgst && <td className="tabular py-2 text-right">{formatMoney(it.sgst)}</td>}
                {gst && isIgst && <td className="tabular py-2 text-right">{formatMoney(it.igst)}</td>}
                <td className="tabular py-2 text-right font-medium">{formatMoney(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {gst && (
          <p className="no-print mt-1 text-[10px] text-slate-400 sm:hidden">
            GST ke khaane dekhne ke liye table ko ungli se side me khiskayein →
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <dl className="w-full max-w-xs space-y-1.5 text-xs">
            <Line label="Taxable" value={formatMoney(note.taxableTotal)} />
            {gst && !isIgst && (
              <>
                <Line label="CGST" value={formatMoney(note.cgstTotal)} />
                <Line label="SGST" value={formatMoney(note.sgstTotal)} />
              </>
            )}
            {gst && isIgst && <Line label="IGST" value={formatMoney(note.igstTotal)} />}
            {note.roundOff !== 0 && <Line label="Round off" value={formatMoney(note.roundOff)} />}
            <div className="border-t border-slate-300 pt-1.5">
              <div className="flex justify-between">
                <dt className="text-sm font-bold text-slate-900">Kul</dt>
                <dd className="tabular text-sm font-bold text-slate-900">{formatMoney(note.grandTotal)}</dd>
              </div>
            </div>
          </dl>
        </div>

        {note.amountInWords && (
          <p className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-600">
            <span className="font-medium">Rupees in words:</span> {note.amountInWords}
          </p>
        )}

        {note.reason && (
          <p className="mt-2 text-xs text-slate-600">
            <span className="font-medium">Karan:</span> {note.reason}
          </p>
        )}
        {note.notes && <p className="mt-1 text-xs text-slate-600">{note.notes}</p>}

        <p className="mt-4 border-t border-slate-200 pt-3 text-[10px] text-slate-500">
          {isSale
            ? 'Ye credit note hai — itni raqam aapke khate se kam kar di gayi hai.'
            : 'Ye debit note hai — itni raqam supplier ke khate se kam kar di gayi hai.'}
        </p>

        <div className="mt-8 flex justify-end">
          <div className="text-center text-xs">
            <div className="mb-1 h-10" />
            <p className="border-t border-slate-400 px-8 pt-1 text-slate-600">
              {biz.name} ke liye
            </p>
          </div>
        </div>
      </Card>

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        loading={busy}
        title={`${note.returnNo} delete karein?`}
        message={isSale
          ? 'Stock wapas ghat jayega aur retailer ka udhaar dobara badh jayega. Ye wapas nahi hota.'
          : 'Stock wapas badh jayega aur supplier ko dena dobara badh jayega. Ye wapas nahi hota.'}
        confirmLabel="Haan, delete karein"
      />
    </>
  );
}

function Line({ label, value }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-600">{label}</dt>
      <dd className="tabular text-slate-900">{value}</dd>
    </div>
  );
}
