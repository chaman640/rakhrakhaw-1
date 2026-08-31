import { useRef, useState } from 'react';
import {
  Upload, FileSpreadsheet, FileText, Camera, AlertTriangle, Check, X,
} from 'lucide-react';
import api from '@/lib/api';
import { Modal, Button, Spinner, useToast } from '@/components/ui';
import { t } from '@/lib/i18n';

/**
 * EXCEL / PDF / PHOTO SE EK SAATH MAAL ADD KARNA.
 *
 * Do kadam, aur ye alag hona zaroori hai:
 *
 *   1. File padhi jati hai — kuch SAVE NAHI hota.
 *   2. Har line aadmi ke saamne aati hai. Wahi bechne ka rate bharta hai, aur
 *      jo naam pehle se hai uspe wahi tay karta hai ki stock badhana hai ya
 *      naya item banana hai.
 *
 * Ek hi kadam me karne ka matlab hota: OCR ek "0" chhod de aur ₹450 ka maal
 * ₹45 ka chadh jaye — aur wo galti bill banne ke baad pakdi jati.
 */
export default function BulkImportModal({ open, onClose, onDone }) {
  const toast = useToast();
  const fileRef = useRef(null);

  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState(null);
  const [kaise, setKaise] = useState('');

  const reset = () => { setRows(null); setKaise(''); setBusy(false); };
  const band = () => { reset(); onClose(); };

  async function padho(file) {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/items/bulk/parse', fd);
      setKaise(res.data.kaise);
      setRows(res.data.rows.map((r) => ({
        ...r,
        salePrice: r.rate ? Math.round(r.rate * 1.2) : 0,
        kya: r.milaHua ? 'stock' : 'naya',
      })));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const set = (id, patch) => setRows((old) => old.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  async function daalo() {
    const chune = rows.filter((r) => r.kya !== 'chhodo');
    if (!chune.length) { toast.error(t('Ek bhi item chuna nahi gaya')); return; }

    setBusy(true);
    try {
      const res = await api.post('/items/bulk/commit', {
        rows: chune.map((r) => ({
          kya: r.kya,
          itemId: r.milaHua?._id,
          name: r.name,
          unit: r.unit,
          hsn: r.hsn,
          qty: r.qty,
          rate: r.rate,
          mrp: r.mrp,
          salePrice: r.salePrice,
        })),
      });
      toast.success(res.message);
      if (res.data.gadbad?.length) {
        toast.error(t('{n} line nahi chadhi', { n: res.data.gadbad.length }));
      }
      onDone?.();
      band();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const gine = rows ? rows.filter((r) => r.kya !== 'chhodo').length : 0;

  return (
    <Modal open={open} onClose={band} title={t('File se maal add karein')} size="xl">
      {!rows ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {t('Supplier ka bill Excel, PDF ya photo — jo bhi ho, yahan daal dijiye. App usme se maal ki list nikal dega, aur aap dekh kar add karenge.')}
          </p>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv,.pdf,image/*"
            className="hidden"
            onChange={(e) => padho(e.target.files?.[0])}
          />

          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="focus-ring flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-10 hover:border-brand-500 hover:bg-brand-50/40 disabled:opacity-60"
          >
            {busy ? <Spinner size={26} /> : <Upload size={26} className="text-slate-400" />}
            <span className="font-semibold text-slate-700">
              {busy ? t('Padha ja raha hai...') : t('File chunein ya photo lein')}
            </span>
            <span className="text-xs text-slate-500">{t('Excel, CSV, PDF ya photo — 10 MB tak')}</span>
          </button>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {[
              [FileSpreadsheet, t('Excel / CSV'), t('Sabse pakka')],
              [FileText, t('PDF bill'), t('Achha chalta hai')],
              [Camera, t('Photo'), t('Saaf photo lein')],
            ].map(([Icon, a, b]) => (
              <div key={a} className="rounded-lg border border-slate-200 p-2.5">
                <Icon size={16} className="mx-auto mb-1 text-slate-400" />
                <p className="font-medium text-slate-700">{a}</p>
                <p className="text-slate-500">{b}</p>
              </div>
            ))}
          </div>

          {busy && (
            <p className="text-center text-xs text-slate-500">
              {t('Photo se padhne me 20-30 second lag sakte hain')}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-700">
              {t('{n} line mili', { n: rows.length })}
              {' · '}
              <span className="font-semibold text-brand-700">{t('{n} add hongi', { n: gine })}</span>
            </p>
            <button type="button" onClick={reset} className="text-sm font-semibold text-slate-600 underline">
              {t('Doosri file')}
            </button>
          </div>

          {kaise !== 'excel' && (
            <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {t('Ye file padh kar nikala gaya hai — har line ek baar dekh lijiye, khaas kar rate.')}
            </p>
          )}

          <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {rows.map((r) => (
              <div
                key={r.id}
                className={`rounded-lg border p-3 ${
                  r.kya === 'chhodo' ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-slate-200'}`}
              >
                <div className="mb-2 flex items-start gap-2">
                  <input
                    value={r.name}
                    onChange={(e) => set(r.id, { name: e.target.value })}
                    className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm font-medium outline-none focus:border-brand-600"
                  />
                  <button
                    type="button"
                    onClick={() => set(r.id, { kya: r.kya === 'chhodo' ? (r.milaHua ? 'stock' : 'naya') : 'chhodo' })}
                    className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
                    aria-label={t('Chhod dein')}
                  >
                    {r.kya === 'chhodo' ? <Check size={15} /> : <X size={15} />}
                  </button>
                </div>

                {/* Wahi naam pehle se hai — faisla aadmi ka */}
                {r.milaHua && r.kya !== 'chhodo' && (
                  <div className="mb-2 rounded-md bg-sky-50 p-2">
                    <p className="mb-1.5 text-xs text-sky-900">
                      {t('"{name}" pehle se hai (stock {n})', { name: r.milaHua.name, n: r.milaHua.stock })}
                    </p>
                    <div className="flex gap-1">
                      {[
                        ['stock', t('Isi ka stock badha do')],
                        ['naya', t('Naya item bana do')],
                      ].map(([v, label]) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => set(r.id, { kya: v })}
                          className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                            r.kya === v ? 'bg-sky-700 text-white' : 'bg-white text-sky-800 ring-1 ring-sky-200'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {r.kya === 'naya' && (
                      <p className="mt-1.5 text-[11px] text-sky-800">
                        {t('Upar naam badal dijiye — wahi naam do baar nahi ho sakta.')}
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['qty', t('Kitna aaya')],
                    ['rate', t('Kitne ka pada')],
                    ['salePrice', t('Kitne ka bechenge')],
                  ].map(([f, label]) => (
                    <label key={f} className="block">
                      <span className="mb-0.5 block text-[11px] text-slate-500">{label}</span>
                      <input
                        type="number"
                        min="0"
                        value={r[f] || ''}
                        onChange={(e) => set(r.id, { [f]: Number(e.target.value) })}
                        disabled={r.kya === 'chhodo'}
                        className={`w-full rounded-md border px-2 py-1.5 text-sm outline-none focus:border-brand-600 ${
                          f === 'salePrice' && r.kya !== 'chhodo' && !r[f]
                            ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`}
                      />
                    </label>
                  ))}
                </div>

                {r.kya !== 'chhodo' && r.salePrice > 0 && r.rate > 0 && r.salePrice < r.rate && (
                  <p className="mt-1.5 text-[11px] font-medium text-red-700">
                    {t('Ye rate lagat se kam hai — har bikri pe nuksaan hoga')}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 border-t border-slate-200 pt-3">
            <Button variant="secondary" onClick={band} className="flex-1">{t('Rehne dein')}</Button>
            <Button onClick={daalo} loading={busy} disabled={!gine} className="flex-1">
              {t('{n} item add karein', { n: gine })}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
