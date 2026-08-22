import { useCallback, useEffect, useState } from 'react';
import { t } from '@/lib/i18n';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Smartphone, Receipt, ChevronRight, Copy, Check, Clock,
  CircleCheck, CircleX, RotateCcw } from
'lucide-react';
import api from '@/lib/api';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { formatMoney, formatDate } from '@/lib/format';
import {
  PageHeader, Card, CardHeader, Button, Input, Badge, Modal, Textarea,
  Spinner, EmptyState, useToast } from
'@/components/ui';
import LedgerTable from '@/pages/wholesaler/khata/LedgerTable';

const statusTone = { pending: 'amber', confirmed: 'green', failed: 'red' };
const statusLabel = {
  pending: 'Confirm hona baaki',
  confirmed: 'Confirm ho gaya',
  failed: 'Reject ho gaya'
};
const statusIcon = { pending: Clock, confirmed: CircleCheck, failed: CircleX };

/** UPI deep link — GPay/PhonePe/Paytm sab isi format ko samajhte hain */
function upiLink({ id, name, amount, note }) {
  const p = new URLSearchParams({ pa: id, pn: name || 'Wholesaler', cu: 'INR' });
  if (amount > 0) p.set('am', String(Number(amount).toFixed(2)));
  if (note) p.set('tn', note);
  return `upi://pay?${p.toString()}`;
}

export default function MyKhata() {
  const toast = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [payOpen, setPayOpen] = useState(false);

  const load = useCallback(async (chupChaap = false) => {
    // `chupChaap` — apne aap taaza hote waqt skeleton mat dikhao (useAutoRefresh.js)
    if (!chupChaap) setLoading(true);
    try {
      const [khata, pays] = await Promise.all([
      api.get('/my/khata', { params: { from: from || undefined, to: to || undefined } }),
      api.get('/my/payments', { params: { limit: 10 } })]
      );
      setData(khata.data);
      setPayments(pays.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  useEffect(() => {load();}, [load]);
  // Bina refresh dabaye screen khud taaza — wajah useAutoRefresh.js me
  useAutoRefresh(load);

  if (loading && !data) {
    return <div className="flex justify-center py-20 text-slate-400"><Spinner size={28} /></div>;
  }
  if (!data) return null;

  const due = Number(data.party?.balance || 0);

  return (
    <>
      <PageHeader
        title={t("Mera Khata")}
        subtitle={`${data.shopName || 'Wholesaler'} ke saath poora hisaab`} />
      

      {/* ---- Balance card ---- */}
      <Card className={`mb-5 ${due > 0 ? 'border-amber-200 bg-amber-50/50' : 'border-emerald-200 bg-emerald-50/40'}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-600">
              {due > 0.01 ? 'Aapko dena hai' : due < -0.01 ? 'Aapka advance jama hai' : 'Hisaab barabar hai'}
            </p>
            <p className={`tabular mt-1 text-3xl font-bold ${
            due > 0.01 ? 'text-amber-700' : due < -0.01 ? 'text-emerald-700' : 'text-slate-500'}`}>
              {formatMoney(Math.abs(due))}
            </p>
            {data.openInvoices?.length > 0 &&
            <p className="mt-1 text-xs text-slate-500">{t("{a0} bill ke paise baaki hain", { a0:
                data.openInvoices.length })}
            </p>
            }
          </div>

          {due > 0.01 && (
          data.upi ?
          <Button size="lg" icon={Smartphone} onClick={() => setPayOpen(true)}>{t("Paisa bhejein")}</Button> :

          <p className="max-w-56 rounded-lg bg-white px-3 py-2 text-xs text-slate-500">{t("Online paise bhejne ke liye wholesaler ko apni UPI ID app me daalni hogi.")}

          </p>)

          }
        </div>
      </Card>

      {/* ---- Bills jinke paise baaki hain ---- */}
      {data.openInvoices?.length > 0 &&
      <Card className="mb-5" padding={false}>
          <CardHeader className="p-5 pb-0" title={t("Ye bill baaki hain")}
        subtitle={t("Paisa bhejenge to sabse purana bill pehle clear hoga")} />
          <div className="mt-2">
            {data.openInvoices.map((inv) =>
          <button key={inv._id} onClick={() => navigate(`/my-bills/${inv._id}`)}
          className="flex w-full items-center gap-3 border-t border-slate-100 p-4 text-left hover:bg-slate-50">
                <Receipt size={16} className="shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{inv.invoiceNo}</p>
                  <p className="text-xs text-slate-500">{formatDate(inv.invoiceDate)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular text-sm font-semibold text-amber-700">{formatMoney(inv.dueAmount)}</p>
                  {inv.paidAmount > 0 &&
              <p className="text-[11px] text-slate-400">{t("{a0} de chuke", { a0: formatMoney(inv.paidAmount) })}</p>
              }
                </div>
                <ChevronRight size={16} className="shrink-0 text-slate-300" />
              </button>
          )}
          </div>
        </Card>
      }

      {/* ---- Maine jo paise bheje ---- */}
      {payments.length > 0 &&
      <Card className="mb-5" padding={false}>
          <CardHeader className="p-5 pb-0" title={t("Maine jo bheja")} />
          <div className="mt-2">
            {payments.map((p) => {
            const Icon = statusIcon[p.status] || Clock;
            return (
              <div key={p._id} className="flex items-center gap-3 border-t border-slate-100 p-4">
                  <Icon size={16} className={`shrink-0 ${
                p.status === 'confirmed' ? 'text-emerald-600' :
                p.status === 'failed' ? 'text-red-500' : 'text-amber-500'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {formatMoney(p.amount)} · {p.mode}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {formatDate(p.date)}{p.reference && ` · ${p.reference}`}
                    </p>
                  </div>
                  <Badge tone={statusTone[p.status]}>{statusLabel[p.status]}</Badge>
                </div>);

          })}
          </div>
        </Card>
      }

      {/* ---- Poora khata ---- */}
      <Card padding={false}>
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4">
          <div className="w-36">
            <Input label={t("Kab se")} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="w-36">
            <Input label={t("Kab tak")} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {(from || to) &&
          <Button variant="ghost" size="sm" icon={RotateCcw}
          onClick={() => {setFrom('');setTo('');}}>{t("Hatayein")}</Button>
          }
        </div>

        {!loading && !data.entries?.length ?
        <EmptyState icon={BookOpen} title={t("Abhi koi hisaab nahi")}
        message={t("Pehla bill banega tab yahan dikhega.")} /> :

        <LedgerTable data={data} loading={loading} onRowClick={(to2) =>
        navigate(to2.replace('/invoices/', '/my-bills/'))} />
        }
      </Card>

      <UpiPayModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        upi={data.upi}
        due={due}
        onSent={load} />
      
    </>);

}

/* ------------------------------------------------------------- UPI modal */

function UpiPayModal({ open, onClose, upi, due, onSent }) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setAmount(due > 0 ? String(Math.round(due * 100) / 100) : '');
    setReference('');setNote('');setStep(1);setError('');setCopied(false);
  }, [open, due]);

  // QR library bhaari hai — sirf tab load hoti hai jab modal khulta hai,
  // taaki baaki app fatafat khule.
  useEffect(() => {
    if (!open || !upi?.id) return;
    let alive = true;
    const link = upiLink({ id: upi.id, name: upi.name, amount: Number(amount) || 0, note: 'Khata payment' });
    import('qrcode').
    then(({ default: QRCode }) => QRCode.toDataURL(link, { width: 240, margin: 1 })).
    then((url) => {if (alive) setQr(url);}).
    catch(() => {if (alive) setQr('');});
    return () => {alive = false;};
  }, [open, upi, amount]);

  if (!upi) return null;

  const link = upiLink({ id: upi.id, name: upi.name, amount: Number(amount) || 0, note: 'Khata payment' });

  function copyId() {
    navigator.clipboard?.writeText(upi.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function markSent() {
    if (!(Number(amount) > 0)) return setError('Amount daaliye');
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/my/payments', {
        amount: Number(amount), reference: reference.trim(), note: note.trim()
      });
      toast.success(res.message);
      onSent?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === 1 ? 'UPI se paisa bhejein' : 'Bhej diya?'}
      description={step === 1 ? `${upi.name} ko` : 'Wholesaler ko bata dete hain, wo confirm karega'}
      footer={step === 1 ?
      <>
          <Button variant="secondary" onClick={onClose}>{t("Rehne dein")}</Button>
          <Button onClick={() => setStep(2)} disabled={!(Number(amount) > 0)}>{t("Bhej diya, aage badhein")}

        </Button>
        </> :

      <>
          <Button variant="secondary" onClick={() => setStep(1)}>{t("Peeche")}</Button>
          <Button onClick={markSent} loading={saving}>{t("Haan, bhej diya")}</Button>
        </>
      }>
      
      {step === 1 ?
      <div className="space-y-4">
          <Input
          label={t("Kitna bhejna hai")} required type="number" min="0" step="0.01" prefix="₹"
          value={amount} onChange={(e) => setAmount(e.target.value)}
          hint={due > 0 ? `Poora ${formatMoney(due)} baaki hai` : undefined} />
        

          {qr &&
        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 p-4">
              <img src={qr} alt={t("UPI QR code — scan karke paisa bhejein")}
          className="h-44 w-44 rounded-lg bg-white p-1.5" />
              <p className="mt-2 text-xs text-slate-500">{t("Kisi bhi UPI app se scan karein")}</p>
            </div>
        }

          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">{t("UPI ID")}</p>
              <p className="truncate text-sm font-medium text-slate-900">{upi.id}</p>
            </div>
            <button onClick={copyId}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-ring">
              {copied ? <><Check size={13} /> {t('Copy hua')}</> : <><Copy size={13} /> {t('Copy')}</>}
            </button>
          </div>

          <a href={link}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-700 text-sm font-medium text-white hover:bg-brand-800 focus-ring">
            <Smartphone size={16} /> {t('UPI app kholein')}
          </a>

          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{t("Phone pe ho to upar wala button seedha GPay/PhonePe khol dega. Computer pe ho to QR scan karein.")}

        </p>
        </div> :

      <div className="space-y-4">
          <div className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">{t("{a0} bhejne ki baat likh rahe hain", { a0:
            formatMoney(Number(amount) || 0) })}
        </div>

          <Input
          label={t("UPI transaction / UTR number")}
          value={reference} onChange={(e) => setReference(e.target.value)}
          placeholder={t("4xxxxxxxxxxx")}
          hint={t("App me 'transaction ID' likha milega — daal denge to confirm jaldi hoga")} />
        

          <Textarea label={t("Kuch kehna ho to")} rows={2} value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("Jaise: bill RB/26-27/0004 ka paisa")} />

          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{t("Ye abhi khate me nahi lagega. Wholesaler apna account dekh kar confirm karega, tabhi aapka udhaar kam hoga.")}


        </p>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      }
    </Modal>);

}
