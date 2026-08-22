import { useRef, useState } from 'react';
import { Upload, Download, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { downloadText, readFileAsText } from '@/lib/download';
import { Modal, Button, Badge, Spinner, useToast } from '@/components/ui';
import { t } from '@/lib/i18n';

export default function ImportModal({ open, onClose, onImported }) {
  const toast = useToast();
  const fileRef = useRef(null);

  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);

  function reset() {
    setCsv('');setFileName('');setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function downloadSample() {
    try {
      const res = await api.get('/items/import/sample');
      downloadText('rakhrakhav-items-sample.csv', res.data.csv);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function pickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    try {
      const text = await readFileAsText(file);
      setCsv(text);
      const res = await api.post('/items/import', { csv: text, commit: false });
      setPreview(res.data);
    } catch (err) {
      toast.error(err.message);
      reset();
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    setCommitting(true);
    try {
      const res = await api.post('/items/import', { csv, commit: true });
      toast.success(res.message);
      onImported();
      onClose();
      reset();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCommitting(false);
    }
  }

  const s = preview?.summary;
  const errorRows = (preview?.rows || []).filter((r) => r.errors?.length);
  const canImport = s && s.willCreate + s.willUpdate > 0;

  return (
    <Modal
      open={open}
      onClose={() => {onClose();reset();}}
      size="lg"
      title={t('CSV se items import karein')}
      description={t('Excel/Google Sheet se seedha 500 item ek saath')}
      footer={
      <>
          <Button variant="secondary" onClick={() => {onClose();reset();}}>{t('Cancel')}</Button>
          {preview &&
        <Button onClick={commit} loading={committing} disabled={!canImport}>
              {canImport ? `${s.willCreate + s.willUpdate} item import karein` : 'Kuch import nahi ho sakta'}
            </Button>
        }
        </>
      }>
      
      <div className="space-y-5">
        {/* Step 1 */}
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="mb-2 text-sm font-medium text-slate-900">{t('1. Sample file download karein')}</p>
          <p className="mb-3 text-sm text-slate-500">
            {t('Isi format me apne items bhar kar wapas upload karein. Column: name (zaroori), sku, category, unit, purchasePrice, salePrice, wholesalePrice, stockQty, lowStockAt, hsn, gstRate.')}
          </p>
          <Button type="button" variant="secondary" size="sm" icon={Download} onClick={downloadSample}>
            {t('Sample CSV')}
          </Button>
        </div>

        {/* Step 2 */}
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="mb-3 text-sm font-medium text-slate-900">{t('2. Apni file upload karein')}</p>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
          onChange={pickFile} data-testid="csv-input" />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" size="sm" icon={Upload} loading={loading}
            onClick={() => fileRef.current?.click()}>
              {t('CSV chunein')}
            </Button>
            {fileName &&
            <span className="flex items-center gap-1.5 text-sm text-slate-600">
                <FileText size={14} /> {fileName}
              </span>
            }
          </div>
        </div>

        {loading &&
        <div className="flex items-center justify-center gap-2 py-6 text-slate-400">
            <Spinner /> <span className="text-sm">{t('File padhi ja rahi hai...')}</span>
          </div>
        }

        {/* Step 3 — preview */}
        {preview && s &&
        <div className="rounded-lg border border-slate-200 p-4">
            <p className="mb-3 text-sm font-medium text-slate-900">{t('3. Check karein, phir import')}</p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={t('Kul rows')} value={s.total} />
              <Stat label={t('Naye')} value={s.willCreate} tone="green" />
              <Stat label={t('Update')} value={s.willUpdate} tone="blue" />
              <Stat label={t('Error')} value={s.withErrors} tone={s.withErrors ? 'red' : 'slate'} />
            </div>

            {s.newCategories?.length > 0 &&
          <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">{t("{a0} nayi category bhi ban jayegi: {a1}", { a0:
              s.newCategories.length, a1: s.newCategories.join(', ') })}
          </p>
          }

            {errorRows.length > 0 ?
          <div className="mt-4">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-red-700">
                  <AlertTriangle size={15} /> {t('Ye rows skip ho jayengi')}
                </p>
                <ul className="max-h-48 divide-y divide-red-100 overflow-y-auto rounded-lg border border-red-200 bg-red-50">
                  {errorRows.slice(0, 20).map((r) =>
              <li key={r.line} className="px-3 py-2 text-sm">
                      <span className="font-medium text-red-900">{t("Line {a0}", { a0: r.line })}</span>
                      {r.name && <span className="text-red-800"> · {r.name}</span>}
                      <span className="text-red-700"> — {r.errors.join(', ')}</span>
                    </li>
              )}
                </ul>
                {errorRows.length > 20 &&
            <p className="mt-1 text-xs text-slate-500">{t("...aur {a0} rows", { a0: errorRows.length - 20 })}</p>
            }
              </div> :

          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <CheckCircle2 size={15} /> {t('Saari rows sahi hain')}
              </p>
          }

            {preview.truncated &&
          <p className="mt-2 text-xs text-slate-500">
                {t('Preview me sirf pehli 200 rows dikhayi hain — import saari hongi.')}
              </p>
          }
          </div>
        }
      </div>
    </Modal>);

}

function Stat({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-50 text-slate-900',
    green: 'bg-emerald-50 text-emerald-800',
    blue: 'bg-blue-50 text-blue-800',
    red: 'bg-red-50 text-red-800'
  };
  return (
    <div className={`rounded-lg px-3 py-2 ${tones[tone]}`}>
      <p className="text-xs opacity-70">{label}</p>
      <p className="tabular text-lg font-semibold">{value}</p>
    </div>);

}

export { Stat };
