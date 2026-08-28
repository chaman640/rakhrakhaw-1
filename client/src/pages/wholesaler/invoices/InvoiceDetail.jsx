import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { Printer, XCircle, Share2, ShoppingCart, Undo2 } from 'lucide-react';
import api from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { Card, Button, Badge, Spinner, Modal, Textarea, useToast } from '@/components/ui';
import InvoicePrint from '@/components/invoice/InvoicePrint';
import { useBillActions } from '@/hooks/useBillActions';
import { t } from '@/lib/i18n';

// Kis-kis cheez ki kami bataani hai — server sirf naam bhejta hai
const MISSING_LABEL = {
  name: 'naam', phone: 'phone number', address: 'pata', gstin: 'GSTIN',
};

const payTone = { unpaid: 'red', partial: 'amber', paid: 'green' };
const payLabel = { unpaid: 'Poora udhaar', partial: 'Kuch mila', paid: 'Poora mil gaya' };

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { shareBill, busyId } = useBillActions();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/invoices/${id}`);
      setInvoice(res.data);
    } catch (err) {
      toast.error(err.message);
      navigate('/invoices', { replace: true });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function cancel() {
    setBusy(true);
    try {
      const res = await api.post(`/invoices/${id}/cancel`, { reason });
      toast.success(res.message);
      setCancelOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  /*
    Home ki list se "Print" dabane par yahi page `?print=1` ke saath khulta
    hai. Wajah: chhapna hamesha ASLI bill ke sheet se hota hai — list me to
    sirf ek line hoti hai. Ek pal ruk kar chhapte hain, warna kabhi kabhi
    print ka parda aadhe bane page ka photo le leta hai.
  */
  useEffect(() => {
    if (!invoice || params.get('print') !== '1') return undefined;
    const timer = setTimeout(() => {
      window.print();
      params.delete('print');
      setParams(params, { replace: true });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice, params]);

  if (loading) return <div className="flex justify-center py-20 text-slate-400"><Spinner size={28} /></div>;
  if (!invoice) return null;

  return (
    <>
      <div className="no-print">
        <Card className="mb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-slate-900">{invoice.invoiceNo}</h1>
                {invoice.isCancelled
                  ? <Badge tone="red">{t('Cancelled')}</Badge>
                  : <Badge tone={payTone[invoice.paymentStatus]}>{payLabel[invoice.paymentStatus]}</Badge>}
                <Badge tone={invoice.gstEnabled ? 'brand' : 'slate'}>
                  {invoice.documentType === 'TAX_INVOICE' ? 'Tax Invoice' : 'Bill of Supply'}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {invoice.partySnapshot?.shopName || invoice.partySnapshot?.name}
                {' · '}{formatMoney(invoice.grandTotal)}
                {invoice.dueAmount > 0 && <> · {t('baaki {amt}', { amt: formatMoney(invoice.dueAmount) })}</>}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {invoice.orderId && (
                <Link to={`/orders/${invoice.orderId}`}>
                  <Button variant="secondary" size="sm" icon={ShoppingCart}>{t('Order')}</Button>
                </Link>
              )}
              {!invoice.isCancelled && (
                <Button variant="secondary" size="sm" icon={Undo2}
                  onClick={() => navigate(`/returns/new?type=SALE_RETURN&doc=${invoice._id}`)}>
                  {t('Maal wapas aaya')}
                </Button>
              )}
              <Button variant="secondary" size="sm" icon={Share2}
                loading={busyId === invoice._id} onClick={() => shareBill(invoice)}>
                {t('WhatsApp')}
              </Button>
              <Button size="sm" icon={Printer} onClick={() => window.print()}>{t('Print / PDF')}</Button>
              {!invoice.isCancelled && (
                <Button variant="danger" size="sm" icon={XCircle} onClick={() => setCancelOpen(true)}>
                  {t('Cancel')}
                </Button>
              )}
            </div>
          </div>

          {/*
            ───────────── BILL PE KHARIDAAR KI DETAIL ADHOORI HAI (item 7) ─────────────

            GST wale bill pe kharidaar ka pata kanoonan zaroori hai. Link se
            juda hua retailer sirf naam aur number deta hai — pata kabhi nahi.
            Bill ban jata tha, chhap bhi jata tha, aur adhoora hi chala jata
            tha; galti CA ke paas mahine baad pakdi jati thi.

            Bill ROKTE nahi hain — bahut si dukaano ka kaam bina pate ke hi
            chalta hai. Bas bata dete hain, aur theek karne ka rasta wahin
            khol dete hain.

            Dhyan: warning bill ke SNAPSHOT se aati hai. Pata ab bhar denge to
            YE purana bill nahi badlega (bill ek jama hua kagaz hai) — par
            aage ke sab bill poore banenge.
          */}
          {invoice.partyMissing?.length > 0 && !invoice.isCancelled && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-xs font-medium text-amber-900">
                {t('Is bill pe kharidaar ki poori detail nahi hai')}
                {' — '}
                {invoice.partyMissing.map((k) => MISSING_LABEL[k] || k).join(', ')}
              </p>
              <p className="mt-0.5 text-xs text-amber-800">
                {invoice.gstEnabled
                  ? t('GST wale bill pe kharidaar ka pata zaroori hai. Bhar dijiye — aage ke bill poore banenge.')
                  : t('Bhar dijiye — aage ke bill poore banenge.')}
              </p>
              {invoice.partyId && (
                <Link to={`/retailers/${invoice.partyId}`}>
                  <Button size="sm" variant="secondary" className="mt-2">
                    {t('Detail bhar dein')}
                  </Button>
                </Link>
              )}
            </div>
          )}

          {/*
            ───────────── DOOSRA SIRA — usne stock me daala ya nahi (item 11) ─────────────

            "Maine jo maal bheja, usne apne stock me daala ya nahi?" — ye
            rozana ka sawal hai. Jawab app me tha hi, par doosri dukaan ke
            andar, jahan bechne wala dekh hi nahi sakta tha.

            Sirf haalat dikhti hai — uski purchase ka number, rate ya rakam
            nahi. Wo uski dukaan ka andaruni hisaab hai.
          */}
          {invoice.buyerIntake && (
            <p className={`mt-4 rounded-lg px-3 py-2 text-xs ${
              invoice.buyerIntake.status === 'DONE'
                ? 'bg-emerald-50 text-emerald-800'
                : invoice.buyerIntake.status === 'CANCELLED'
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-brand-50 text-brand-800'}`}
            >
              {invoice.buyerIntake.status === 'DONE'
                ? t('Kharidaar ne ye maal apne stock me daal liya hai')
                : invoice.buyerIntake.status === 'CANCELLED'
                  ? t('Kharidaar ke yahan ka kaam ruk gaya tha (bill cancel hua tha)')
                  : t('Kharidaar ke yahan ye maal stock me daalna abhi baaki hai')}
            </p>
          )}

          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {t('"WhatsApp" dabate hi bill ki PDF ban kar share ka parda khulta hai — wahan se seedha retailer ko bhej dein. "Print" se kagaz ya PDF, dono ho jate hain.')}
          </p>
        </Card>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <InvoicePrint invoice={invoice} />
      </div>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        size="sm"
        title={`${invoice.invoiceNo} cancel karein?`}
        description={t('Bill delete nahi hoga — number record me rahega, par stock wapas aa jayega aur khata ulta ho jayega.')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>{t('Rehne dein')}</Button>
            <Button variant="danger" loading={busy} onClick={cancel}>{t('Haan, cancel karein')}</Button>
          </>
        }
      >
        <Textarea label={t('Wajah (marzi)')} rows={2} value={reason}
          onChange={(e) => setReason(e.target.value)} placeholder={t('Galat rate lag gaya tha')} />
      </Modal>
    </>
  );
}
