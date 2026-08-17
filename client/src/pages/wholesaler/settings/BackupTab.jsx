import { useCallback, useEffect, useState } from 'react';
import {
  Download, Database, ShieldCheck, FileSpreadsheet, HardDriveDownload,
} from 'lucide-react';
import api from '@/lib/api';
import { downloadText } from '@/lib/download';
import { Card, CardHeader, Button, Spinner, useToast } from '@/components/ui';
import { t } from '@/lib/i18n';

const CSV_KINDS = [
  { kind: 'parties', label: 'Retailers aur suppliers', note: 'Naam, phone, address, balance' },
  { kind: 'invoices', label: 'Saare bill', note: 'Bill number, party, GST, total, baaki' },
  { kind: 'khata', label: 'Poora khata', note: 'Har lena-dena, running balance ke saath' },
  { kind: 'payments', label: 'Payments', note: 'Cash, UPI, bank — sab' },
  { kind: 'purchases', label: 'Purchases', note: 'Supplier ke bill' },
  { kind: 'returns', label: 'Returns', note: 'Credit aur debit note' },
];

const COUNT_LABEL = {
  parties: 'Party', items: 'Item', purchases: 'Purchase', orders: 'Order',
  invoices: 'Bill', payments: 'Payment', returns: 'Return', staff: 'Login',
};

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function BackupTab() {
  const toast = useToast();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/backup/summary');
      setSummary(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function downloadBackup() {
    setBusy('full');
    try {
      const data = await api.get('/backup/download');
      // api interceptor JSON parse kar chuka hai — wapas string bana kar file bana do
      const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      downloadText(`rakhrakhav-backup-${todayStr()}.json`, text, 'application/json');
      toast.success('Backup download ho gaya — sambhal kar rakhein');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  }

  async function downloadCsv(kind, label) {
    setBusy(kind);
    try {
      const text = await api.get(`/backup/csv/${kind}`, { responseType: 'text' });
      // Server BOM laga chuka hai, downloadText dobara lagata hai — ek hata do
      downloadText(`${kind}-${todayStr()}.csv`, String(text ?? '').replace(/^﻿/, ''));
      toast.success(`${label} download ho gaya`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  }

  if (loading) {
    return <div className="flex justify-center py-16 text-slate-400"><Spinner size={24} /></div>;
  }

  return (
    <div className="space-y-5">
      {/* ---- Poora backup ---- */}
      <Card className="border-brand-200 bg-brand-50/30">
        <CardHeader
          title={t('Poora backup')}
          subtitle={t('Aapka saara data ek file me — mahine me ek baar le lena achhi aadat hai')}
        />

        {summary && (
          <div className="mb-4 grid gap-2 sm:grid-cols-4">
            {Object.entries(summary).map(([key, count]) => (
              <div key={key} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="tabular text-lg font-semibold text-slate-900">{count}</p>
                <p className="text-xs text-slate-500">{COUNT_LABEL[key] || key}</p>
              </div>
            ))}
          </div>
        )}

        <Button icon={HardDriveDownload} loading={busy === 'full'} onClick={downloadBackup} size="lg">
          {t('Poora data download karein')}
        </Button>

        <div className="mt-4 flex items-start gap-2 rounded-lg bg-white px-3 py-2.5 text-xs text-slate-600">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-slate-400" />
          <span>
            {t('Ye file aapke computer me download hogi — kahin upload nahi hoti. Password kabhi is file me nahi jata. File ko Google Drive ya pendrive me rakh dijiye.')}
          </span>
        </div>
      </Card>

      {/* ---- CSV ---- */}
      <Card padding={false}>
        <CardHeader
          className="p-5 pb-0"
          title={t('Excel me kholne ke liye')}
          subtitle={t('Alag alag CSV — CA ko dena ho ya khud dekhna ho')}
        />
        <div className="mt-3">
          {CSV_KINDS.map((c) => (
            <div key={c.kind}
              className="flex items-center gap-3 border-t border-slate-100 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <FileSpreadsheet size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{c.label}</p>
                <p className="truncate text-xs text-slate-500">{c.note}</p>
              </div>
              <Button size="sm" variant="secondary" icon={Download}
                loading={busy === c.kind} onClick={() => downloadCsv(c.kind, c.label)}>
                CSV
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title={t('Ye data kahan rehta hai')} />
        <div className="flex items-start gap-3 text-sm text-slate-600">
          <Database size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <div className="space-y-2">
            <p>
              {t('Aapka saara data aapke apne MongoDB database me hai — hamare paas uski koi copy nahi. Iska matlab: database ka backup on rakhna aapki zimmedari hai.')}
            </p>
            <p className="text-xs text-slate-500">
              {t('MongoDB Atlas use kar rahe hain to wahan settings me automatic backup on kar dijiye. Uske alawa mahine me ek baar upar wali JSON file bhi le liya karein — dono alag alag cheezein hain.')}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
